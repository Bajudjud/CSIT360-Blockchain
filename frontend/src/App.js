import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaPen, FaTrash, FaWallet } from "react-icons/fa";
import "./index.css";
import { enableLace, buildSignSubmitNoteHash } from "./cardano";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function App() {
  const [notes, setNotes] = useState(() => {
    const savedNotes = localStorage.getItem("notesData");
    return savedNotes ? JSON.parse(savedNotes) : [];
  });

  const [wallet, setWallet] = useState(() => {
    const savedWallet = localStorage.getItem("walletState");
    return savedWallet
      ? JSON.parse(savedWallet)
      : { connected: false, address: "", name: "", balance: "0 ADA" };
  });

  const [isConnecting, setIsConnecting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);
  const [currentNote, setCurrentNote] = useState({ title: "", content: "" });
  const [blockchainTx, setBlockchainTx] = useState(null);
  const [txDetails, setTxDetails] = useState(null);

  useEffect(() => {
    localStorage.setItem("walletState", JSON.stringify(wallet));
  }, [wallet]);

  useEffect(() => {
    if (notes.length > 0) localStorage.setItem("notesData", JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await axios.get(`${API_URL}/notes`);
      setNotes(res.data || []);
    } catch (err) {
      console.error("Error fetching notes:", err);
      setNotes([]);
    }
  };

  // -------- Wallet --------
  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const api = await enableLace();
      let addr = "";
      try {
        const used = await api.getUsedAddresses?.();
        if (used && used.length > 0) {
          addr = typeof used[0] === "string" ? used[0] : used[0].toString();
        } else {
          const change = await api.getChangeAddress?.();
          addr = change && typeof change === "string" ? change : (change ? change.toString() : "");
        }
      } catch (e) {
        console.warn("Could not get addresses:", e);
      }

      setWallet({ connected: true, address: addr || "", name: "Lace Wallet (Preview)", balance: "100.50 ADA" });
      console.log("Wallet connected:", addr || "unknown");
    } catch (err) {
      console.error("connectWallet error:", err);
      alert("Failed to connect to Lace. Ensure Lace is installed and in Preview mode.");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWallet({ connected: false, address: "", name: "", balance: "0 ADA" });
    localStorage.removeItem("walletState");
    console.log("Wallet disconnected");
  };

  // -------- Notes Modals --------
  const openAddModal = () => {
    if (!wallet.connected) {
      alert("Please connect your wallet first to save notes to the blockchain!");
      return;
    }
    setCurrentNote({ title: "", content: "" });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const openEditModal = (note) => {
    setCurrentNote(note);
    setIsEditMode(true);
    setIsModalOpen(true);
    setIsViewMode(false);
  };

  const openViewModal = (note) => {
    setCurrentNote(note);
    setIsViewMode(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const options = { month: "2-digit", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" };
    return new Date(dateStr).toLocaleString("en-US", options).replace(",", " at");
  };

  // -------- SHA-256 Hash --------
  async function sha256Hex(message) {
    const enc = new TextEncoder();
    const data = enc.encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // -------- Send + Save Note --------
  async function sendAndSaveNoteOnChain(actionType, notePayload) {
    try {
      // 1) Save/Update note locally
      let savedNote;
      if (actionType === "create") {
        const res = await axios.post(`${API_URL}/notes`, notePayload);
        savedNote = res.data;
        setNotes(prev => [savedNote, ...prev]);
      } else if (actionType === "update") {
        const id = notePayload._id || notePayload.id;
        const res = await axios.put(`${API_URL}/notes/${id}`, notePayload);
        savedNote = res.data;
        setNotes(prev => prev.map(n => (n._id === id || n.id === id ? savedNote : n)));
      }

      // 2) Compute SHA-256 of note content
      const toHash = JSON.stringify({ title: savedNote.title, content: savedNote.content });
      const hashHex = await sha256Hex(toHash);

      // 3) Enable Lace wallet freshly
      const api = await enableLace();

      setBlockchainTx({ success: null, action: "sending", txHash: null });
      const submitResp = await buildSignSubmitNoteHash(api, savedNote._id, hashHex, wallet.address);
      const txHash = submitResp.txHash;

      // 4) Attach proof on server
      await axios.post(`${API_URL}/attachOnChainProof`, { noteId: savedNote._id, txHash });

      // 5) Update local state with txHash
      setNotes(prev => prev.map(n => (n._id === savedNote._id ? { ...n, txHash, onchain_proof: { txHash, attached_at: new Date().toISOString() } } : n)));
      setBlockchainTx({ success: true, action: actionType, txHash, walletAddress: wallet.address, timestamp: new Date().toISOString() });
      setTimeout(() => setBlockchainTx(null), 6000);
    } catch (err) {
      console.error("sendAndSaveNoteOnChain error:", err);
      setBlockchainTx({ success: false, action: actionType, error: err.message || String(err) });
      alert("Failed to complete on-chain flow: " + (err.message || String(err)));
      setTimeout(() => setBlockchainTx(null), 6000);
    }
  }

  const handleSave = async () => {
    if (!currentNote.title.trim() || !currentNote.content.trim()) return;
    try {
      const noteData = { ...currentNote, walletAddress: wallet.address };
      if (isEditMode) await sendAndSaveNoteOnChain("update", noteData);
      else await sendAndSaveNoteOnChain("create", noteData);
      closeModal();
    } catch (err) {
      console.error("handleSave error:", err);
      alert("Error saving note. Please try again.");
    }
  };

  const handleDelete = async () => {
    try {
      if (!currentNote || !(currentNote._id || currentNote.id)) return alert("No note selected");
      const id = currentNote._id || currentNote.id;

      await axios.delete(`${API_URL}/notes/${id}`);
      setNotes(prev => prev.filter(n => (n._id || n.id) !== id));
      setBlockchainTx({ success: true, action: "delete", txHash: null });
      setTimeout(() => setBlockchainTx(null), 3000);
      closeModal();
    } catch (err) {
      console.error("handleDelete error:", err);
      alert("Error deleting note. Please try again.");
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsViewMode(false);
    setIsDeleteConfirm(false);
  };

  return (
    <div className="app-wrapper">
      {/* Header */}
      <div className="header">
        <h1>Note Buddy</h1>
        <div className="header-actions">
          {!wallet.connected ? (
            <div className="wallet-connection">
              <button className={`connect-wallet-btn ${isConnecting ? "connecting" : ""}`} onClick={connectWallet} disabled={isConnecting}>
                {isConnecting ? (<><div className="spinner"></div> Connecting...</>) : (<><FaWallet /> Connect Lace Wallet</>)}
              </button>
            </div>
          ) : (
            <div className="wallet-info real-wallet">
              <div className="wallet-header">
                <span className="wallet-name">🟣 {wallet.name}</span>
                <button className="disconnect-btn" onClick={disconnectWallet}>Disconnect</button>
              </div>
              <div className="wallet-details">
                <span className="wallet-address">{wallet.address ? `${wallet.address.slice(0,10)}...${wallet.address.slice(-8)}` : "—"}</span>
                <span className="wallet-balance">{wallet.balance}</span>
              </div>
            </div>
          )}
          <button className={`add-note-btn ${!wallet.connected ? "disabled" : ""}`} onClick={openAddModal} disabled={!wallet.connected}>+ Add Note</button>
        </div>
      </div>

      {/* Notes Grid */}
      <div className="notes-grid">
        {notes.length === 0 ? (
          <div className="no-notes-container">
            <p className="no-notes">{wallet.connected ? "No notes yet. Create your first note!" : "Connect your wallet to view and create notes"}</p>
          </div>
        ) : (
          notes.map((note) => (
            <div key={note._id || note.id} className="note-card" onClick={() => openViewModal(note)}>
              <div className="note-card-header">
                <h3 className="note-title">{note.title}</h3>
                <div className="note-actions" onClick={(e) => e.stopPropagation()}>
                  {note.txHash && (
                    <span className="blockchain-badge" title="Signed proof" onClick={(e) => { e.stopPropagation(); setTxDetails(note); }}>🔗 Verified</span>
                  )}
                  <button onClick={() => openEditModal(note)} title="Edit"><FaPen /></button>
                  <button onClick={() => { setCurrentNote(note); setIsDeleteConfirm(true); }} title="Delete"><FaTrash /></button>
                </div>
              </div>
              <p className="note-content">{note.content.length > 100 ? note.content.substring(0,100) + "..." : note.content}</p>
              <div className="note-dates">
                <span>Created: {formatDate(note.created_at)}</span><br />
                <span>Updated: {formatDate(note.updated_at)}</span>
              </div>
              {note.txHash && <div className="note-wallet-info"><small>Proof: {note.txHash}</small></div>}
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e)=>e.stopPropagation()}>
            <h2>{isEditMode ? "Edit Note" : "Add Note"}</h2>
            <div className="wallet-indicator"><small>Signing with: {wallet.address ? `${wallet.address.slice(0,10)}...${wallet.address.slice(-8)}` : "Unknown"}</small></div>
            <input type="text" className="note-input" placeholder="Title" value={currentNote.title} onChange={(e)=>setCurrentNote({...currentNote, title:e.target.value})} />
            <textarea className="note-textarea" placeholder="Content" value={currentNote.content} onChange={(e)=>setCurrentNote({...currentNote, content:e.target.value})} />
            <div className="modal-buttons">
              <button className="save-btn" onClick={handleSave}>Save (Sign with Lace)</button>
              <button className="cancel-btn" onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {isViewMode && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e)=>e.stopPropagation()}>
            <h2>{currentNote.title}</h2>
            <p>{currentNote.content}</p>
            <div className="note-dates"><span>Created: {formatDate(currentNote.created_at)}</span><br /><span>Updated: {formatDate(currentNote.updated_at)}</span></div>
            <div className="modal-buttons">
              <button className="save-btn" onClick={() => openEditModal(currentNote)}>Edit</button>
              <button className="cancel-btn" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {isDeleteConfirm && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e)=>e.stopPropagation()}>
            <h2>Delete Note</h2>
            <p>Are you sure you want to delete this note?</p>
            <div className="modal-buttons">
              <button className="confirm-btn" onClick={handleDelete}>Yes, Delete</button>
              <button className="cancel-btn" onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {blockchainTx && (
        <div className={`blockchain-notification ${blockchainTx.success ? "success" : "error"}`}>
          <div className="blockchain-header">
            <strong>🔗 {blockchainTx.success ? "Signed" : blockchainTx.success === null ? "Processing..." : "Failed"}</strong>
            <button className="view-details-btn" onClick={() => setTxDetails(blockchainTx)}>View Details</button>
          </div>
          <div className="blockchain-details">
            <div>Action: {blockchainTx.action}</div>
            <div>Proof: {blockchainTx.txHash}</div>
            {blockchainTx.walletAddress && <div>From: {blockchainTx.walletAddress.slice(0,10)}...{blockchainTx.walletAddress.slice(-8)}</div>}
            {blockchainTx.error && <div>Error: {blockchainTx.error}</div>}
          </div>
          <button className="close-tx-btn" onClick={() => setBlockchainTx(null)}>×</button>
        </div>
      )}

      {txDetails && (
        <div className="modal-overlay" onClick={() => setTxDetails(null)}>
          <div className="modal-content tx-details-modal" onClick={(e)=>e.stopPropagation()}>
            <h2>🔗 Proof Details</h2>
            <div className="tx-details">
              <div><strong>Proof / Signature:</strong><pre style={{whiteSpace:"break-spaces", maxHeight:200, overflow:"auto"}}>{txDetails.txHash}</pre></div>
              <div><strong>Saved Note:</strong><pre>{JSON.stringify(txDetails, null, 2)}</pre></div>
            </div>
            <div className="modal-buttons"><button className="cancel-btn" onClick={() => setTxDetails(null)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
