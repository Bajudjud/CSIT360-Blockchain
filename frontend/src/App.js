import React, { useEffect, useState } from "react";
import axios from "axios";
import "./index.css";

const API_URL = "http://localhost:5000/api/notes";

const App = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await axios.get(API_URL);
        // Map backend timestamps to UI-friendly fields
        const mapped = res.data.map((n) => ({
          id: n.id,
          title: n.title,
          content: n.content,
          createdAt: n.created_at || n.createdAt,
          updatedAt: n.updated_at || n.updatedAt,
        }));
        setNotes(mapped);
      } catch (err) {
        console.error("Error fetching notes:", err);
      }
    };
    fetchNotes();
  }, []);

  const showNotification = (type, nTitle, subtitle) => {
    setNotification({ type, title: nTitle, subtitle });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      if (editingNote) {
        // Update existing note in backend
        await axios.put(`${API_URL}/${editingNote.id}`, { title, content });
        const updatedNotes = notes.map((note) =>
          note.id === editingNote.id
            ? { ...note, title, content, updatedAt: new Date().toLocaleString() }
            : note
        );
        setNotes(updatedNotes);
        showNotification("success", "Note updated", "your change was saved");
        setEditingNote(null);
      } else {
        // Create new note in backend
        const res = await axios.post(API_URL, { title, content });
        const newNote = {
          id: res.data.id,
          title: res.data.title,
          content: res.data.content,
          createdAt: new Date().toLocaleString(),
        };
        setNotes([newNote, ...notes]);
        showNotification("success", "Note added", "your note has been saved successfully");
      }

      setTitle("");
      setContent("");
      setShowAddForm(false);
    } catch (error) {
      console.error("Error saving note:", error);
    }
  };

  const handleEdit = (note) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setShowAddForm(true);
  };

  const handleDelete = async (noteId) => {
    try {
      await axios.delete(`${API_URL}/${noteId}`);
      setNotes(notes.filter((note) => note.id !== noteId));
      showNotification("success", "Note removed", "the note has been removed");
    } catch (err) {
      console.error("Error deleting note:", err);
    }
  };

  const closeModal = () => {
    setShowAddForm(false);
    setEditingNote(null);
    setTitle("");
    setContent("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "24px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
        }}
      >
        <h1
          style={{
            fontSize: "32px",
            fontWeight: "700",
            color: "#1e293b",
            margin: 0,
          }}
        >
          Quick Notes
        </h1>
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "#ffffff",
            border: "none",
            borderRadius: "12px",
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
          }}
          onMouseOver={(e) => {
            e.target.style.transform = "translateY(-1px)";
            e.target.style.boxShadow = "0 10px 25px 0 rgba(99, 102, 241, 0.3)";
          }}
          onMouseOut={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 1px 3px 0 rgba(0, 0, 0, 0.1)";
          }}
        >
          + Add Note
        </button>
      </div>

      {/* Add/Edit Note Modal */}
      {showAddForm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "32px",
              width: "500px",
              maxWidth: "90vw",
              boxShadow: "0 10px 25px 0 rgba(0, 0, 0, 0.15)",
            }}
          >
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "600",
                marginBottom: "20px",
                color: "#1e293b",
              }}
            >
              {editingNote ? "Edit Note" : "Add New Note"}
            </h2>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Note title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "16px",
                  marginBottom: "16px",
                  outline: "none",
                  transition: "border-color 0.2s ease",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#6366f1";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0";
                }}
              />
              <textarea
                placeholder="Write your note content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "14px",
                  marginBottom: "20px",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                  transition: "border-color 0.2s ease",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#6366f1";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0";
                }}
              />
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    padding: "10px 20px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    backgroundColor: "transparent",
                    color: "#64748b",
                    cursor: "pointer",
                    fontSize: "14px",
                    transition: "all 0.2s ease",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = "#f1f5f9";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = "transparent";
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "10px 20px",
                    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    transition: "all 0.2s ease",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = "translateY(-1px)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = "translateY(0)";
                  }}
                >
                  {editingNote ? "Update Note" : "Save Note"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {notification && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            backgroundColor: "#ffffff",
            color: "#1e293b",
            padding: "16px 20px",
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            fontSize: "14px",
            zIndex: 1001,
            animation: "slideInRight 0.3s ease-out",
            border: "1px solid #e2e8f0",
            minWidth: "280px",
            maxWidth: "320px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                backgroundColor: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: "1px",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: "600",
                  fontSize: "14px",
                  color: "#1e293b",
                  marginBottom: "2px",
                  lineHeight: "1.3",
                }}
              >
                {notification.title}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: "#64748b",
                  lineHeight: "1.4",
                }}
              >
                {notification.subtitle}
              </div>
            </div>
          </div>
          <style>
            {`
              @keyframes slideInRight {
                from {
                  transform: translateX(100%);
                  opacity: 0;
                }
                to {
                  transform: translateX(0);
                  opacity: 1;
                }
              }
            `}
          </style>
        </div>
      )}

      {/* Notes Grid - Changed to exactly 4 columns */}
      <div
        style={{
          padding: "32px",
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        {notes.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
              color: "#64748b",
            }}
          >
            <div
              style={{
                fontSize: "48px",
                marginBottom: "16px",
              }}
            >
              📝
            </div>
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "500",
                marginBottom: "8px",
                color: "#1e293b",
              }}
            >
              No notes yet
            </h3>
            <p
              style={{
                fontSize: "16px",
                margin: 0,
              }}
            >
              Create your first note by clicking the "+ Add Note" button above.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)", // Keep 4 columns as requested
              gap: "24px", // Restored original gap size
            }}
          >
            <style>
              {`
                @media (max-width: 1200px) {
                  .notes-grid {\n                    grid-template-columns: repeat(3, 1fr) !important;\n                  }\n                }\n                @media (max-width: 900px) {\n                  .notes-grid {\n                    grid-template-columns: repeat(2, 1fr) !important;\n                  }\n                }\n                @media (max-width: 600px) {\n                  .notes-grid {\n                    grid-template-columns: 1fr !important;\n                  }\n                }
              `}
            </style>
            {notes.map((note) => (
              <div
                key={note.id}
                className="notes-grid"
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "24px", // Restored original padding
                  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  height: "fit-content",
                  position: "relative",
                  minHeight: "200px", // Restored original minimum height
                  display: "flex",
                  flexDirection: "column",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.boxShadow = "0 10px 25px 0 rgba(0, 0, 0, 0.1)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.boxShadow = "0 1px 3px 0 rgba(0, 0, 0, 0.05)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    display: "flex",
                    gap: "4px",
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(note);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      borderRadius: "4px",
                      color: "#64748b",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = "#f1f5f9";
                      e.target.style.color = "#6366f1";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = "transparent";
                      e.target.style.color = "#64748b";
                    }}
                    title="Edit note"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(note.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      borderRadius: "4px",
                      color: "#64748b",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = "#fef2f2";
                      e.target.style.color = "#ef4444";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = "transparent";
                      e.target.style.color = "#64748b";
                    }}
                    title="Delete note"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3,6 5,6 21,6" />
                      <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>

                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#1e293b",
                    marginBottom: "12px",
                    lineHeight: "1.4",
                    margin: "0 0 12px 0",
                    paddingRight: "60px",
                  }}
                >
                  {note.title}
                </h3>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#64748b",
                    lineHeight: "1.5",
                    margin: "0 0 auto 0",
                    display: "-webkit-box",
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    flex: "1",
                  }}
                >
                  {note.content}
                </p>
                <small
                  style={{
                    fontSize: "12px",
                    color: "#94a3b8",
                    fontWeight: "400",
                    marginTop: "auto",
                    display: "block",
                    paddingTop: "16px",
                  }}
                >
                  Created: {note.createdAt}
                  {note.updatedAt && (
                    <>
                      <br />
                      Updated: {note.updatedAt}
                    </>
                  )}
                </small>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
