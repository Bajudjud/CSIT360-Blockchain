import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaPen, FaTrash } from "react-icons/fa";
import "./index.css";

const API_URL = "http://localhost:5000/api/notes";

function App() {
  const [notes, setNotes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);
  const [currentNote, setCurrentNote] = useState({ title: "", content: "" });

  // Fetch all notes on mount
  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await axios.get(API_URL);
      setNotes(res.data);
    } catch (err) {
      console.error("Error fetching notes:", err);
    }
  };

  const openAddModal = () => {
    setCurrentNote({ title: "", content: "" });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const openEditModal = (note) => {
    setCurrentNote(note);
    setIsEditMode(true);
    setIsModalOpen(true);
    setIsViewMode(false); // close view if open
  };

  const openViewModal = (note) => {
    setCurrentNote(note);
    setIsViewMode(true);
  };

  const handleSave = async () => {
    if (!currentNote.title.trim() || !currentNote.content.trim()) return;

    const now = new Date().toISOString(); // still save ISO, backend-friendly

    try {
      if (isEditMode) {
        const updatedNote = { ...currentNote, updated_at: now };
        const res = await axios.put(`${API_URL}/${currentNote.id}`, updatedNote);
        setNotes(notes.map((n) => (n.id === currentNote.id ? res.data : n)));
      } else {
        const newNote = { ...currentNote, created_at: now, updated_at: now };
        const res = await axios.post(API_URL, newNote);
        setNotes([res.data, ...notes]);
      }
      closeModal();
    } catch (err) {
      console.error("Error saving note:", err);
    }
  };


  const handleDelete = async () => {
    try {
      await axios.delete(`${API_URL}/${currentNote.id}`);
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
      timeZone: "Asia/Manila", // force PH time
    };
    return new Date(dateStr)
      .toLocaleString("en-US", options)
      .replace(",", " at");
  };





  return (
    <div className="app-wrapper">
      {/* Header */}
      <div className="header">
        <h1>Quick Notes</h1>
        <button className="add-note-btn" onClick={openAddModal}>
          + Add Note
        </button>
      </div>

      {/* Notes Grid */}
      <div className="notes-grid">
        {notes.length === 0 ? (
          <p className="no-notes">No notes yet. Create one!</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="note-card"
              onClick={() => openViewModal(note)} // whole card clickable
            >
              <div className="note-card-header">
                <h3 className="note-title">{note.title}</h3>
                <div
                  className="note-actions"
                  onClick={(e) => e.stopPropagation()} // prevent triggering view
                >
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
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{isEditMode ? "Edit Note" : "Add Note"}</h2>
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
                Save
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
    </div>
  );
}

export default App;