import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaPen, FaTrash, FaWallet } from "react-icons/fa";
import "./index.css";

const API_URL = "http://localhost:5000/api/notes";

function App() {
  const [notes, setNotes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);
  const [currentNote, setCurrentNote] = useState({ title: "", content: "" });
  const [blockchainTx, setBlockchainTx] = useState(null);
  const [txDetails, setTxDetails] = useState(null);
  
  // Wallet State
    const [wallet, setWallet] = useState(() => {
    const savedWallet = localStorage.getItem('walletState');
    return savedWallet ? JSON.parse(savedWallet) : {
      connected: false,
      address: "",
      name: "",
      balance: "0 ADA"
    };
  });
  const [isConnecting, setIsConnecting] = useState(false);

  // Check for Cardano wallets on component mount
   useEffect(() => {
    localStorage.setItem('walletState', JSON.stringify(wallet));
  }, [wallet]);
  

  const checkForWallets = () => {
    // Check if any Cardano wallet is available
    const hasWallet = window.cardano && (
      window.cardano.lace || 
      window.cardano.eternl || 
      window.cardano.nami ||
      window.cardano.flint
    );
    
    console.log("Cardano wallets detected:", {
      lace: !!window.cardano?.lace,
      eternl: !!window.cardano?.eternl,
      nami: !!window.cardano?.nami,
      flint: !!window.cardano?.flint
    });
  };

  const fetchNotes = async () => {
    try {
      const res = await axios.get(API_URL);
      setNotes(res.data);
    } catch (err) {
      console.error("Error fetching notes:", err);
    }
  };

  // SIMPLIFIED WALLET CONNECTION
const connectWallet = async () => {
  setIsConnecting(true);
  
  // Simulate connection delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    // YOUR REAL LACE WALLET ADDRESS
    const realLaceAddress = "addr_test1qzvm86qhp7urr3c3cx0cnv75jzf66c6ckymklvac8stae7snytz2v66nhn7qffp7lln5xw427rlmup4ng6u5ejywaa0qwgxfn5";
    
    setWallet({
      connected: true,
      address: realLaceAddress, // YOUR REAL ADDRESS
      name: "Lace Wallet",
      balance: "100.50 ADA"
    });
    
    console.log("✅ Wallet connected (simulation with real address):", realLaceAddress);
    
  } catch (error) {
    console.error("Wallet connection failed:", error);
  } finally {
    setIsConnecting(false);
  }
};

  const disconnectWallet = () => {
    setWallet({
      connected: false,
      address: "",
      name: "",
      balance: "0 ADA"
    });
    localStorage.removeItem('walletState');
    console.log("Wallet disconnected");
  };

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
  const updateWalletBalance = (fees) => {
  if (wallet.connected) {
    // Extract the fee amount from string like "1.42 ADA"
    const feeAmount = parseFloat(fees.split(' ')[0]);
    const currentBalance = parseFloat(wallet.balance.split(' ')[0]);
    const newBalance = (currentBalance - feeAmount).toFixed(2);
    
    setWallet(prev => ({
      ...prev,
      balance: `${newBalance} ADA`
    }));
  }
};

  const handleSave = async () => {
  if (!currentNote.title.trim() || !currentNote.content.trim()) return;

  try {
    let result;
    const noteData = {
      ...currentNote,
      walletAddress: wallet.address
    };

    if (isEditMode) {
      const res = await axios.put(`${API_URL}/${currentNote.id}`, noteData);
      result = res.data;
      setNotes(notes.map((n) => (n.id === currentNote.id ? result : n)));
    } else {
      const res = await axios.post(API_URL, noteData);
      result = res.data;
      setNotes([result, ...notes]);
    }
    
    // Show blockchain transaction result
    if (result.blockchain) {
      setBlockchainTx(result.blockchain);
      // UPDATE BALANCE WITH FEES
      updateWalletBalance(result.blockchain.fees);
      setTimeout(() => setBlockchainTx(null), 5000);
    }
    
    closeModal();
  } catch (err) {
    console.error("Error saving note:", err);
    alert("Error saving note. Please try again.");
  }
};

// Do the same for handleDelete
const handleDelete = async () => {
  try {
    const res = await axios.delete(`${API_URL}/${currentNote.id}`);
    
    // Show blockchain transaction result
    if (res.data.blockchain) {
      setBlockchainTx(res.data.blockchain);
      // UPDATE BALANCE WITH FEES
      updateWalletBalance(res.data.blockchain.fees);
      setTimeout(() => setBlockchainTx(null), 5000);
    }
    
    setNotes(notes.filter((n) => n.id !== currentNote.id));
    closeModal();
  } catch (err) {
    console.error("Error deleting note:", err);
  }
};

  const closeModal = () => {
    setIsModalOpen(false);
    setIsViewMode(false);
    setIsDeleteConfirm(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const options = {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    };
    return new Date(dateStr)
      .toLocaleString("en-US", options)
      .replace(",", " at");
  };

  // Check if any Cardano wallets are available
  const hasWallets = window.cardano && (
    window.cardano.lace || 
    window.cardano.eternl || 
    window.cardano.nami ||
    window.cardano.flint
  );

  return (
    <div className="app-wrapper">
      {/* Header */}
      <div className="header">
        <h1>Quick Notes + Blockchain</h1>
        <div className="header-actions">

{/* WALLET CONNECTION */}
{!wallet.connected ? (
  <div className="wallet-connection">
    <button 
      className={`connect-wallet-btn ${isConnecting ? 'connecting' : ''}`}
      onClick={connectWallet}
      disabled={isConnecting}
    >
      {isConnecting ? (
        <>
          <div className="spinner"></div>
          Connecting...
        </>
      ) : (
        <>
          <FaWallet /> Connect Lace Wallet
        </>
      )}
    </button>
  </div>
) : (
  <div className="wallet-info real-wallet">
    <div className="wallet-header">
      <span className="wallet-name">🟣 {wallet.name}</span>
      <button className="disconnect-btn" onClick={disconnectWallet}>
        Disconnect
      </button>
    </div>
    <div className="wallet-details">
      <span className="wallet-address">
        {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}
      </span>
      <span className="wallet-balance">{wallet.balance}</span>
    </div>
  </div>
)}
          
          <button 
            className={`add-note-btn ${!wallet.connected ? 'disabled' : ''}`}
            onClick={openAddModal}
            disabled={!wallet.connected}
          >
            + Add Note
          </button>
        </div>
      </div>


      {/* Notes Grid */}
      <div className="notes-grid">
        {notes.length === 0 ? (
          <div className="no-notes-container">
            <p className="no-notes">
              {wallet.connected 
                ? "No notes yet. Create your first note!" 
                : "Connect your wallet to view and create notes"}
            </p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="note-card"
              onClick={() => openViewModal(note)}
            >
              <div className="note-card-header">
                <h3 className="note-title">{note.title}</h3>
                <div
                  className="note-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Blockchain Verification Badge */}
                  {note.blockchain?.success && (
                    <span 
                      className="blockchain-badge" 
                      title="Verified on Cardano Blockchain"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTxDetails(note.blockchain);
                      }}
                    >
                      🔗 Verified
                    </span>
                  )}
                  <button onClick={() => openEditModal(note)} title="Edit">
                    <FaPen />
                  </button>
                  <button
                    onClick={() => {
                      setCurrentNote(note);
                      setIsDeleteConfirm(true);
                    }}
                    title="Delete"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>

              <p className="note-content">
                {note.content.length > 100
                  ? note.content.substring(0, 100) + "..."
                  : note.content}
              </p>
              <div className="note-dates">
                <span>Created: {formatDate(note.created_at)}</span>
                <br />
                <span>Updated: {formatDate(note.updated_at)}</span>
              </div>
              {note.blockchain && (
                <div className="note-wallet-info">
                  <small>From: {note.blockchain.walletAddress?.slice(0, 10)}...{note.blockchain.walletAddress?.slice(-8)}</small>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Rest of your modals remain the same */}
      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{isEditMode ? "Edit Note" : "Add Note"}</h2>
            <div className="wallet-indicator">
              <small>Saving to blockchain from: {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}</small>
            </div>
            <input
              type="text"
              className="note-input"
              placeholder="Title"
              value={currentNote.title}
              onChange={(e) =>
                setCurrentNote({ ...currentNote, title: e.target.value })
              }
            />
            <textarea
              className="note-textarea"
              placeholder="Content"
              value={currentNote.content}
              onChange={(e) =>
                setCurrentNote({ ...currentNote, content: e.target.value })
              }
            />
            <div className="modal-buttons">
              <button className="save-btn" onClick={handleSave}>
                Save to Blockchain
              </button>
              <button className="cancel-btn" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewMode && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{currentNote.title}</h2>
            <p>{currentNote.content}</p>
            <div className="note-dates">
              <span>Created: {formatDate(currentNote.created_at)}</span>
              <br />
              <span>Updated: {formatDate(currentNote.updated_at)}</span>
            </div>
            <div className="modal-buttons">
              <button
                className="save-btn"
                onClick={() => openEditModal(currentNote)}
              >
                Edit
              </button>
              <button className="cancel-btn" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {isDeleteConfirm && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Note</h2>
            <p>Are you sure you want to delete this note?</p>
            <div className="modal-buttons">
              <button className="confirm-btn" onClick={handleDelete}>
                Yes, Delete
              </button>
              <button className="cancel-btn" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blockchain Transaction Notification */}
      {blockchainTx && (
        <div className={`blockchain-notification ${blockchainTx.success ? 'success' : 'error'}`}>
          <div className="blockchain-header">
            <strong>🔗 Blockchain Transaction {blockchainTx.success ? 'Successful' : 'Failed'}</strong>
            <button 
              className="view-details-btn" 
              onClick={() => setTxDetails(blockchainTx)}
            >
              View Details
            </button>
          </div>
          <div className="blockchain-details">
            <div>Action: {blockchainTx.action}</div>
            <div>TX Hash: {blockchainTx.txHash}</div>
            <div>Note: "{blockchainTx.noteTitle}"</div>
            {blockchainTx.block && <div>Block: #{blockchainTx.block}</div>}
            {blockchainTx.fees && <div>Fees: {blockchainTx.fees}</div>}
            {blockchainTx.walletAddress && (
              <div>From: {blockchainTx.walletAddress.slice(0, 10)}...{blockchainTx.walletAddress.slice(-8)}</div>
            )}
            {blockchainTx.error && <div>Error: {blockchainTx.error}</div>}
          </div>
          <button className="close-tx-btn" onClick={() => setBlockchainTx(null)}>×</button>
        </div>
      )}
      

      {/* Transaction Details Modal */}
      {txDetails && (
        <div className="modal-overlay" onClick={() => setTxDetails(null)}>
          <div className="modal-content tx-details-modal" onClick={(e) => e.stopPropagation()}>
            <h2>🔗 Blockchain Transaction Details</h2>
            <div className="tx-details">
              <div className="tx-field">
                <strong>Action:</strong> 
                <span className={`tx-action ${txDetails.action.toLowerCase()}`}>
                  {txDetails.action}
                </span>
              </div>
              <div className="tx-field">
                <strong>Transaction Hash:</strong> 
                <code>{txDetails.txHash}</code>
              </div>
              <div className="tx-field">
                <strong>Block:</strong> 
                <span className="block-number">#{txDetails.block}</span>
              </div>
              <div className="tx-field">
                <strong>Fees:</strong> 
                <span className="fees">{txDetails.fees}</span>
              </div>
              <div className="tx-field">
                <strong>Timestamp:</strong> 
                <span>{new Date(txDetails.timestamp).toLocaleString()}</span>
              </div>
              <div className="tx-field">
                <strong>Wallet:</strong> 
                <span className="wallet-address-display">
                  {txDetails.walletAddress || "Unknown"}
                </span>
              </div>
              <div className="tx-field">
                <strong>Status:</strong> 
                <span className={`status ${txDetails.success ? 'confirmed' : 'failed'}`}>
                  {txDetails.success ? '✅ Confirmed' : '❌ Failed'}
                </span>
              </div>
              {txDetails.metadata && (
                <div className="metadata-section">
                  <strong>On-Chain Metadata:</strong>
                  <pre className="metadata-json">
                    {JSON.stringify(txDetails.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="modal-buttons">
              <button className="cancel-btn" onClick={() => setTxDetails(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  
}

export default App;