import React, { useState, useEffect } from "react";
import axios from "axios";
// Ensure you have: npm install react-icons
import { FaPen, FaTrash, FaWallet, FaCheckCircle, FaPlus, FaLock, FaFeatherAlt, FaCube } from "react-icons/fa";
import "./index.css";

const API_URL = "http://localhost:5000/api";

function App() {
  const [notes, setNotes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);
  const [currentNote, setCurrentNote] = useState({ title: "", content: "" });
  const [blockchainTx, setBlockchainTx] = useState(null);
  const [error, setError] = useState('');
  
  const [wallet, setWallet] = useState({
    connected: false,
    address: "",
    balance: "",
    network: "",
    api: null
  });
  const [isConnecting, setIsConnecting] = useState(false);

  // --- 1. INIT & WALLET LOGIC ---

  useEffect(() => {
    fetchNotes();
    const wasConnected = localStorage.getItem('walletConnected');
    if (wasConnected === 'true') {
      setTimeout(() => connectWallet(true), 500);
    }
  }, []);

  const fetchNotes = async () => {
    try {
      const response = await axios.get(`${API_URL}/notes`);
      setNotes(response.data);
    } catch (err) { console.error(err); }
  };

  const connectWallet = async (silent = false) => {
    if (!silent) setIsConnecting(true);
    setError('');

    try {
      if (!window.cardano || !window.cardano.lace) {
        if (!silent) throw new Error('Lace wallet not found. Please install it.');
        return;
      }

      const walletAPI = await window.cardano.lace.enable();
      
      // NETWORK CHECK
      const networkId = await walletAPI.getNetworkId();
      const networkLabel = networkId === 0 ? "Preview Testnet" : "Mainnet";

      // --- BALANCE FIX START ---
      const balanceHex = await walletAPI.getBalance();
      
      // 1. Parse the Hex string to a number (Base 16)
      let balanceLovelace = parseInt(balanceHex, 16);

      // 2. CBOR Fix: If the number is impossibly large (due to CBOR header), strip the header
      // (Total ADA supply is ~45 billion. If we see more, it's a parsing error).
      if (balanceLovelace > 45000000000000000) {
         balanceLovelace = parseInt(balanceHex.substring(2), 16);
      }
      
      const adaBalance = (balanceLovelace / 1000000).toFixed(2);
      // --- BALANCE FIX END ---
      
      let addresses = await walletAPI.getUsedAddresses();
      if (addresses.length === 0) addresses = await walletAPI.getUnusedAddresses();

      setWallet({
        connected: true,
        address: addresses[0],
        name: 'Lace Wallet',
        balance: adaBalance,
        network: networkLabel,
        api: walletAPI
      });

      localStorage.setItem('walletConnected', 'true');
    } catch (err) {
      console.error(err);
      if (!silent) setError(err.message || "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWallet({ connected: false, address: "", balance: "", network: "", api: null });
    localStorage.removeItem('walletConnected');
  };

  // --- 2. TRANSACTION LOGIC (Build -> Sign -> Assemble -> Submit) ---

  const createBlockchainTransaction = async (noteData, action) => {
    try {
      if (!wallet.api) throw new Error("Wallet not connected.");

      // A. Get UTXOs
      const changeAddress = await wallet.api.getChangeAddress();
      const utxos = await wallet.api.getUtxos();
      if (!utxos || utxos.length === 0) throw new Error("No UTXOs. Please request funds from Faucet.");

      // B. BUILD
      const buildRes = await axios.post(`${API_URL}/build-transaction`, {
        changeAddress,
        utxos,
        meta: { title: noteData.title, content: noteData.content, action }
      });

      // C. SIGN
      const witnessHex = await wallet.api.signTx(buildRes.data.cborHex, true);

      // D. ASSEMBLE
      const assembleRes = await axios.post(`${API_URL}/assemble-transaction`, {
        txCbor: buildRes.data.cborHex,
        witnessCbor: witnessHex
      });

      // E. SUBMIT
      const txHash = await wallet.api.submitTx(assembleRes.data.signedTxHex);
      
      return { success: true, txHash, action };
    } catch (error) {
      console.error(error);
      const msg = error.info || error.message || "Transaction failed";
      return { success: false, error: msg };
    }
  };

  // --- 3. CRUD HANDLERS ---

  const handleSave = async () => {
    if (!currentNote.title.trim()) return alert("Title required");
    try {
      const action = isEditMode ? 'UPDATE_NOTE' : 'CREATE_NOTE';
      const txResult = await createBlockchainTransaction(currentNote, action);

      if (!txResult.success) throw new Error(txResult.error);

      // Optimistic Update / DB Save
      if (isEditMode) {
        const res = await axios.put(`${API_URL}/notes/${currentNote.id}`, { ...currentNote, blockchain: txResult });
        setNotes(notes.map(n => n.id === currentNote.id ? res.data : n));
      } else {
        const res = await axios.post(`${API_URL}/notes`, { ...currentNote, blockchain: txResult });
        setNotes([res.data, ...notes]);
      }

      setBlockchainTx(txResult);
      closeModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      const txResult = await createBlockchainTransaction(currentNote, 'DELETE_NOTE');
      if (!txResult.success) throw new Error(txResult.error);

      await axios.delete(`${API_URL}/notes/${currentNote.id}`);
      setNotes(notes.filter(n => n.id !== currentNote.id));
      
      setBlockchainTx(txResult);
      closeModal();
    } catch (err) {
      setError(err.message);
    }
  };

  // --- 4. UI HELPERS ---
  const openAddModal = () => { setCurrentNote({title:"", content:""}); setIsEditMode(false); setIsModalOpen(true); };
  const openEditModal = (note) => { setCurrentNote(note); setIsEditMode(true); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setIsViewMode(false); setIsDeleteConfirm(false); setError(''); };

  // ==========================================
  // VIEW 1: LANDING PAGE (GATEKEEPER)
  // ==========================================
  if (!wallet.connected) {
    return (
      <div className="landing-container">
        <div className="hero-card">
          <span className="hero-icon">🦪</span>
          <h1 className="hero-title">Note Buddy</h1>
          <p className="hero-subtitle">
            Your thoughts, secured forever on the <br/>Cardano Blockchain.
          </p>
          
          <button className="big-connect-btn" onClick={() => connectWallet(false)} disabled={isConnecting}>
            {isConnecting ? (
               "Connecting..." 
            ) : (
               <>
                 <FaWallet style={{color:'#d4af37'}} /> 
                 Connect Lace Wallet
               </>
            )}
          </button>
        </div>

        {/* Descriptions as requested */}
        <div className="info-section">
          <div className="info-item">
            <h4><FaLock style={{color:'#d4af37'}} /> Secure</h4>
            <p>Every note is cryptographically signed by your unique wallet key, ensuring ownership.</p>
          </div>
          <div className="info-item">
            <h4><FaCube style={{color:'#d4af37'}} /> Immutable</h4>
            <p>Data is permanently hashed onto the Cardano Preview network. History never lies.</p>
          </div>
          <div className="info-item">
            <h4><FaFeatherAlt style={{color:'#d4af37'}} /> Lightweight</h4>
            <p>A minimalist "Pearl & Glass" design to keep you focused on your ideas.</p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: DASHBOARD (APP)
  // ==========================================
  return (
    <div className="app-wrapper">
      {/* HEADER */}
      <div className="header">
        <div>
          <h2 style={{margin:0, fontSize:'2rem'}}>Note Buddy</h2>
          <span style={{fontSize:'0.8rem', color:'#999', letterSpacing:1, textTransform:'uppercase'}}>
             {wallet.network}
          </span>
        </div>
        
        <div className="wallet-badge">
           <span style={{color: '#d4af37', fontSize:'1.2rem'}}>●</span>
           <strong>{wallet.balance} ₳</strong>
           <span style={{opacity:0.3}}>|</span>
           <span style={{fontFamily:'monospace', color:'#7f8c8d'}}>
             {wallet.address.substring(0,6)}...{wallet.address.substring(wallet.address.length-4)}
           </span>
           <button onClick={disconnectWallet} style={{background:'none', border:'none', cursor:'pointer', marginLeft:5, color:'#e74c3c', fontSize:'1.2rem'}} title="Disconnect">
             &times;
           </button>
        </div>
      </div>

      {error && <div className="blockchain-notification error">{error}</div>}

      {/* GRID */}
      <div className="notes-grid">
        {notes.length === 0 && (
          <div style={{gridColumn: '1/-1', textAlign:'center', color:'#ccc', marginTop: 50}}>
            <p>No notes yet. Create your first immutable thought.</p>
          </div>
        )}

        {notes.map((note) => (
          <div key={note.id} className="note-card" onClick={() => { setCurrentNote(note); setIsViewMode(true); }}>
            <div className="note-card-header">
              <h3 style={{margin:0, fontSize:'1.1rem'}}>{note.title}</h3>
              {note.blockchain?.success && <FaCheckCircle color="#27ae60" title="Verified on Chain" />}
            </div>
            <p className="note-content">
              {note.content.length > 120 ? note.content.substring(0, 120) + "..." : note.content}
            </p>
            
            <div style={{marginTop:'auto', paddingTop:15, display:'flex', justifyContent:'flex-end', gap:10}}>
               <button onClick={(e)=>{e.stopPropagation(); openEditModal(note)}} style={{border:'none', background:'none', cursor:'pointer', color:'#bdc3c7'}}><FaPen /></button>
               <button onClick={(e)=>{e.stopPropagation(); setCurrentNote(note); setIsDeleteConfirm(true)}} style={{border:'none', background:'none', cursor:'pointer', color:'#bdc3c7'}}><FaTrash /></button>
            </div>
          </div>
        ))}
      </div>

      <button className="add-note-fab" onClick={openAddModal}>
        <FaPlus />
      </button>

      {/* --- MODALS --- */}
      {(isModalOpen || isViewMode || isDeleteConfirm) && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            
            {/* DELETE */}
            {isDeleteConfirm ? (
              <div style={{textAlign:'center'}}>
                 <h2 style={{color:'#e74c3c'}}>Delete Note?</h2>
                 <p>This action will record a DELETE transaction on the blockchain.</p>
                 <div className="modal-buttons" style={{justifyContent:'center', marginTop:20}}>
                   <button className="cancel-btn" onClick={closeModal}>Cancel</button>
                   <button className="save-btn" style={{background:'#e74c3c'}} onClick={handleDelete}>Confirm Delete</button>
                 </div>
              </div>
            ) : isViewMode ? (
              /* VIEW */
              <>
                <h2 style={{fontSize:'2rem'}}>{currentNote.title}</h2>
                <div style={{height:1, background:'#eee', width:'100%', marginBottom:20}}></div>
                <p style={{whiteSpace:'pre-wrap', lineHeight:1.8, color:'#2c3e50'}}>{currentNote.content}</p>
                {currentNote.blockchain && (
                  <div style={{marginTop:30, padding:15, background:'#f8f9fa', borderRadius:10, fontSize:'0.8rem', color:'#999'}}>
                    <strong>Blockchain Receipt:</strong><br/>
                    <span style={{fontFamily:'monospace'}}>{currentNote.blockchain.txHash}</span>
                  </div>
                )}
                <div className="modal-buttons" style={{marginTop:20}}>
                  <button className="cancel-btn" onClick={closeModal}>Close</button>
                </div>
              </>
            ) : (
              /* ADD / EDIT */
              <>
                 <h2>{isEditMode ? "Edit Note" : "New Note"}</h2>
                 <input className="note-input" value={currentNote.title} onChange={e => setCurrentNote({...currentNote, title: e.target.value})} placeholder="Title..." />
                 <textarea className="note-textarea" value={currentNote.content} onChange={e => setCurrentNote({...currentNote, content: e.target.value})} placeholder="Write your thoughts..." />
                 <div className="modal-buttons">
                   <button className="cancel-btn" onClick={closeModal}>Cancel</button>
                   <button className="save-btn" onClick={handleSave}>
                      {isEditMode ? "Sign Update" : "Sign & Create"}
                   </button>
                 </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SUCCESS TOAST */}
      {blockchainTx && (
        <div className="blockchain-notification success">
           <h4 style={{margin:'0 0 5px 0', color:'#27ae60'}}>Transaction Sent!</h4>
           <small style={{color:'#666'}}>Hash: {blockchainTx.txHash.substring(0,15)}...</small>
           <button onClick={() => setBlockchainTx(null)} style={{position:'absolute', top:5, right:10, border:'none', background:'none', cursor:'pointer'}}>&times;</button>
        </div>
      )}
    </div>
  );
}

export default App;