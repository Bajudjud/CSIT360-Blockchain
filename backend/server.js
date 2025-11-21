// server.js - UPDATED FOR FILE-BASED DATABASE
const express = require("express");
const cors = require("cors");
const db = require("./database");
const cardanoService = require("./cardanoService");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Initialize blockchain service when server starts
cardanoService.initialize = () => {
  console.log("🔄 Blockchain service ready for note transactions...");
};
cardanoService.initialize();

// GET all notes
app.get("/api/notes", (req, res) => {
  try {
    const notes = db.all();
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single note
app.get("/api/notes/:id", (req, res) => {
  try {
    const note = db.get(req.params.id);
    res.json(note || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE note - WITH BLOCKCHAIN INTEGRATION
app.post("/api/notes", async (req, res) => {
  const { title, content } = req.body;
  try {
    const newNote = db.insert({ title, content });
    
    // ✅ BLOCKCHAIN INTEGRATION: Send CREATE transaction
    const txResult = await cardanoService.sendNoteTransaction("CREATE", newNote.id, title);
    newNote.blockchain = txResult;
    
    res.json(newNote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE note - WITH BLOCKCHAIN INTEGRATION
app.put("/api/notes/:id", async (req, res) => {
  const { title, content } = req.body;
  try {
    const updatedNote = db.update(req.params.id, { title, content });
    
    if (!updatedNote) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    // ✅ BLOCKCHAIN INTEGRATION: Send UPDATE transaction
    const txResult = await cardanoService.sendNoteTransaction("UPDATE", req.params.id, title);
    updatedNote.blockchain = txResult;
    
    res.json(updatedNote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE note - WITH BLOCKCHAIN INTEGRATION
app.delete("/api/notes/:id", async (req, res) => {
  try {
    // Get note before deleting to use in transaction
    const noteToDelete = db.get(req.params.id);
    
    if (!noteToDelete) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    const deleted = db.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    // ✅ BLOCKCHAIN INTEGRATION: Send DELETE transaction
    const txResult = await cardanoService.sendNoteTransaction("DELETE", req.params.id, noteToDelete.title);
    
    res.json({ 
      message: "Note deleted successfully",
      blockchain: txResult 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add blockchain history endpoint
app.get("/api/blockchain-history", (req, res) => {
  try {
    const history = db.getBlockchainHistory ? db.getBlockchainHistory() : [];
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});