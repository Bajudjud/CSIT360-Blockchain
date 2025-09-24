import { useEffect, useState } from "react";

export default function Home() {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editText, setEditText] = useState("");

  // Mock data to preview UI without backend
  useEffect(() => {
    setNotes([
      { id: 1, content: "Buy groceries" },
      { id: 2, content: "Finish React project" },
    ]);
  }, []);

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    const fakeNote = { id: Date.now(), content: newNote };
    setNotes((prev) => [...prev, fakeNote]);
    setNewNote("");
  };

  const handleDeleteNote = (id) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
  };

  const handleEditNote = (id, content) => {
    setEditingNoteId(id);
    setEditText(content);
  };

  const handleSaveEdit = (id) => {
    setNotes((prev) =>
      prev.map((note) =>
        note.id === id ? { ...note, content: editText } : note
      )
    );
    setEditingNoteId(null);
    setEditText("");
  };

  return (
    <div className="home-container">
      <h1 className="home-title">Notes App</h1>

      {/* Add Note Form */}
      <form onSubmit={handleAddNote} className="note-form">
        <input
          type="text"
          placeholder="Write a note..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          className="note-input"
        />
        <button type="submit" className="note-button">
          Add
        </button>
      </form>

      {/* Notes List */}
      <ul className="note-list">
        {notes.length === 0 && (
          <p style={{ textAlign: "center", color: "#6b7280" }}>
            No notes yet. Add one!
          </p>
        )}
        {notes.map((note) => (
          <li key={note.id} className="note-item">
            {editingNoteId === note.id ? (
              <>
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="note-input"
                  style={{ flex: 1, marginRight: "10px" }}
                />
                <button
                  onClick={() => handleSaveEdit(note.id)}
                  className="note-button"
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <span>{note.content}</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => handleEditNote(note.id, note.content)}
                    className="note-button"
                    style={{ backgroundColor: "#10b981" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="note-delete"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
