const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// GET all notes
app.get('/api/notes', (req, res) => {
    db.all('SELECT * FROM notes ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// GET single note by ID
app.get('/api/notes/:id', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM notes WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row);
    });
});

// CREATE new note
app.post('/api/notes', (req, res) => {
    const { title, content } = req.body;
    db.run('INSERT INTO notes (title, content) VALUES (?, ?)', [title, content], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, title, content });
    });
});

// UPDATE note
app.put('/api/notes/:id', (req, res) => {
    const id = req.params.id;
    const { title, content } = req.body;
    db.run('UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
        [title, content, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Note updated successfully' });
    });
});

// DELETE note
app.delete('/api/notes/:id', (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM notes WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Note deleted successfully' });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});