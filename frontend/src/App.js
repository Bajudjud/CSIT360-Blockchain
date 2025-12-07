import React, { useState, useEffect } from "react";
import axios from "axios";
// Ensure you installed these: npm install react-icons
import { FaPen, FaTrash, FaWallet, FaCheckCircle } from "react-icons/fa";
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
  const [txDetails, setTxDetails] = useState(null);
  const [error, setError] = useState('');

  const [wallet, setWallet] = useState({
    connected: false,
    address: "",
    name: "",
    balance: "",
    network: "",
    api: null
  });
  const [isConnecting, setIsConnecting] = useState(false);

  // 1. Initial Load & Persistence Check
  useEffect(() => {
    fetchNotes();
    
    // Check if we were connected before
    const wasConnected = localStorage.getItem('walletConnected');
    if (wasConnected === 'true') {
      // Give Lace a moment to inject into the window
      setTimeout(() => {
        connectWallet(true); // true = silent mode
      }, 500);
    }
  }, []);

  const fetchNotes = async () => {
    try {
      const response = await axios.get(`${API_URL}/notes`);
      setNotes(response.data);
    } catch (err) {
      console.error("Error fetching notes:", err);
    }
  };

  const decodeBalance = (balance) => {
    if (!balance) return "0.00";
    // Usually balances come in Lovelace (1 ADA = 1,000,000 Lovelace)
    // Lace might return hex or string
    try {
       // Simple heuristic: if it looks like hex, parse it
       let val = typeof balance === 'string' && !/^\d+$/.test(balance) 
         ? parseInt(balance, 16) 
         : parseInt(balance);
         
       return (val / 1000000).toFixed(2);
    } catch (e) {
       return "0.00";
    }
  };

  const connectWallet = async (silent = false) => {
    if (!silent) setIsConnecting(true);
    setError('');

    try {
      if (!window.cardano || !window.cardano.lace) {
        if (!silent) throw new Error('Lace wallet not found.');
        return;
      }

      const walletAPI = await window.cardano.lace.enable();
      const networkId = await walletAPI.getNetworkId();
      const network = networkId === 0 ? "Preprod Testnet" : "Mainnet";
      
      const balanceVal = await walletAPI.getBalance();
      const adaBalance = decodeBalance(balanceVal);
      
      let addresses = await walletAPI.getUsedAddresses();
      if (addresses.length === 0) addresses = await walletAPI.getUnusedAddresses();
      
      if (addresses.length === 0) {
        if(!silent) throw new Error('No addresses found');
        return;
      }

      setWallet({
        connected: true,
        address: addresses[0],
        name: 'Lace Wallet',
        balance: `${adaBalance} ADA`,
        network: network,
        api: walletAPI
      });

      // Save connection state
      localStorage.setItem('walletConnected', 'true');

    } catch (err) {
      console.error("Connection failed", err);
      if (!silent) setError(err.message);
      localStorage.removeItem('walletConnected');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWallet({
      connected: false,
      address: "",
      name: "",
      balance: "",
      network: "",
      api: null
    });
    localStorage.removeItem('walletConnected');
  };

  // 2. FIXED TRANSACTION LOGIC (Build -> Sign -> Assemble -> Submit)
  const createBlockchainTransaction = async (noteData, action) => {
  try {
    if (!wallet.api) throw new Error("Wallet not connected.");
    console.log(`🔄 Processing ${action}...`);

    // 1. Get Wallet Data
    const changeAddress = await wallet.api.getChangeAddress();
    const utxos = await wallet.api.getUtxos();
    if (!utxos || utxos.length === 0) throw new Error("No UTXOs. Please add funds to your wallet.");

    // 2. Request Backend to Build Transaction
    const buildRes = await axios.post(`${API_URL}/build-transaction`, {
      changeAddress,
      utxos,
      meta: { title: noteData.title, content: noteData.content, action }
    });

    // 3. Sign with Wallet (Lace)
    const witnessHex = await wallet.api.signTx(buildRes.data.cborHex, true);

    // 4. Request Backend to Assemble
    const assembleRes = await axios.post(`${API_URL}/assemble-transaction`, {
      txCbor: buildRes.data.cborHex,
      witnessCbor: witnessHex
    });

    // 5. Submit to Blockchain
    const txHash = await wallet.api.submitTx(assembleRes.data.signedTxHex);
    console.log("✅ Transaction Submitted:", txHash);

    return { success: true, txHash, action };

  } catch (error) {
    console.error("TX Failed:", error);
    // Extract readable error message
    const msg = error.info || error.message || "Transaction failed";
    return { success: false, error: msg };
  }
};

  // --- CRUD OPERATIONS ---

  const handleSave = async () => {
    if (!currentNote.title.trim()) return alert("Title required");

    try {
      // 1. Do Blockchain Tx
      const action = isEditMode ? 'UPDATE_NOTE' : 'CREATE_NOTE';
      const txResult = await createBlockchainTransaction(currentNote, action);

      if (!txResult.success) throw new Error(txResult.error);

      // 2. If successful, save to DB
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
      // 1. Do Blockchain Tx
      const txResult = await createBlockchainTransaction(currentNote, 'DELETE_NOTE');
      
      if (!txResult.success) throw new Error(txResult.error);

      // 2. If successful, delete from DB
      await axios.delete(`${API_URL}/notes/${currentNote.id}`);
      setNotes(notes.filter(n => n.id !== currentNote.id));
      
      setBlockchainTx(txResult);
      closeModal();
    } catch (err) {
      setError(err.message);
    }
  };

  // --- UI HELPERS ---

  const openAddModal = () => {
    if (!wallet.connected) return alert("Please connect wallet first");
    setCurrentNote({ title: "", content: "" });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const openEditModal = (note) => {
    if (!wallet.connected) return alert("Please connect wallet first");
    setCurrentNote(note);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsViewMode(false);
    setIsDeleteConfirm(false);
    setCurrentNote({ title: "", content: "" });
    setError('');
  };

  const formatAddress = (addr) => addr ? `${addr.substring(0,8)}...${addr.substring(addr.length-6)}` : '';

  return (
    <div className="app-wrapper">
      <div className="header">
        <h1>Note Buddy</h1>
        <div className="header-actions">
          {!wallet.connected ? (
            <button className="connect-wallet-btn" onClick={() => connectWallet(false)} disabled={isConnecting}>
              {isConnecting ? "Connecting..." : <><FaWallet /> Connect Lace</>}
            </button>
          ) : (
            <div className="wallet-info real-wallet">
               <span className="wallet-balance">{wallet.balance}</span>
               <span className="wallet-address">{formatAddress(wallet.address)}</span>
               <button className="disconnect-btn" onClick={disconnectWallet}>Disconnect</button>
            </div>
          )}
          <button className="add-note-btn" onClick={openAddModal}>+ Add Note</button>
        </div>
      </div>

      {error && <div className="blockchain-notification error" style={{position:'static', marginBottom: 20}}>
         <strong>Error:</strong> {error}
      </div>}

      <div className="notes-grid">
        {notes.map((note) => (
          <div key={note.id} className="note-card" onClick={() => { setCurrentNote(note); setIsViewMode(true); }}>
            <div className="note-card-header">
              <h3 className="note-title">{note.title}</h3>
              <div className="note-actions" onClick={e => e.stopPropagation()}>
                 {note.blockchain?.success && <FaCheckCircle color="#10b981" title="Verified on Chain" />}
                 <button onClick={() => openEditModal(note)}><FaPen /></button>
                 <button onClick={() => { setCurrentNote(note); setIsDeleteConfirm(true); }}><FaTrash /></button>
              </div>
            </div>
            <p className="note-content">{note.content.substring(0, 100)}...</p>
          </div>
        ))}
      </div>

      {/* MODALS */}
      {(isModalOpen || isViewMode || isDeleteConfirm) && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            
            {/* DELETE CONFIRM */}
            {isDeleteConfirm ? (
              <>
                <h2>Delete Note?</h2>
                <p>This will record a DELETE transaction on Cardano.</p>
                <div className="modal-buttons">
                  <button className="confirm-btn" style={{background:'#ef4444'}} onClick={handleDelete}>Yes, Delete</button>
                  <button className="cancel-btn" onClick={closeModal}>Cancel</button>
                </div>
              </>
            ) : isViewMode ? (
              /* VIEW MODE */
              <>
                <h2>{currentNote.title}</h2>
                <p style={{whiteSpace: 'pre-wrap'}}>{currentNote.content}</p>
                {currentNote.blockchain && <div style={{marginTop: 20, fontSize: 12, color: '#666'}}>
                  TX: {currentNote.blockchain.txHash}
                </div>}
                <button className="cancel-btn" onClick={closeModal}>Close</button>
              </>
            ) : (
              /* ADD/EDIT MODE */
              <>
                 <h2>{isEditMode ? "Edit Note" : "New Note"}</h2>
                 <input className="note-input" value={currentNote.title} onChange={e => setCurrentNote({...currentNote, title: e.target.value})} placeholder="Title" />
                 <textarea className="note-textarea" value={currentNote.content} onChange={e => setCurrentNote({...currentNote, content: e.target.value})} placeholder="Content" />
                 <div className="modal-buttons">
                   <button className="save-btn" onClick={handleSave}>Sign & Save</button>
                   <button className="cancel-btn" onClick={closeModal}>Cancel</button>
                 </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* NOTIFICATION */}
      {blockchainTx && (
        <div className="blockchain-notification success">
           <div><strong>✅ Transaction Sent!</strong></div>
           <small>Hash: {formatAddress(blockchainTx.txHash)}</small>
           <button className="close-tx-btn" onClick={() => setBlockchainTx(null)}>×</button>
        </div>
      )}
    </div>
  );
}

export default App;