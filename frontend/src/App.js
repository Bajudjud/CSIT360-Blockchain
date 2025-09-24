import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:5000/api/notes';

function App() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState([]); // Para sa display

  // Function para create note - WORKING
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      const response = await axios.post(API_URL, { title, content });
      
      // I-display dayon ang bag-ong note
      setNotes([response.data, ...notes]);
      
      setTitle('');
      setContent('');
    } catch (error) {
      console.error('Sayop sa pag-create sa note:', error);
    }
  };

  return (
    <div className="App">
      <div className="container">
        <h1>Notes App</h1>
        
        {/* Form para create note - WORKING */}
        <form onSubmit={handleSubmit} className="note-form">
          <input
            type="text"
            placeholder="Title sa note"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="title-input"
          />
          <textarea
            placeholder="Content sa note"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="content-input"
          />
          <button type="submit" className="save-btn">
            Create Note ✓
          </button>
        </form>

        {/* Display sa notes - READ ONLY, walay edit/delete */}
        <div className="notes-list">
          <h2>Imong Notes ({notes.length})</h2>
          {notes.length === 0 ? (
            <p className="no-notes">Wala pay notes. Create sa una!</p>
          ) : (
            notes.map(note => (
              <div key={note.id} className="note-card">
                <h3>{note.title}</h3>
                <p className="note-content">{note.content}</p>
                <small className="note-date">
                  Gihimo: {new Date().toLocaleString()} {/* Fake date kay simple lang */}
                </small>
                {/* Walay edit/delete buttons dinhi! */}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;