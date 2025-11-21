import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { buildUnsignedTxMetadata, submitSignedTx } from "./cardanoService.js";

dotenv.config();
const app = express();
app.use(express.json({ limit: "4mb" }));
app.use(cors());

const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(process.cwd(), "notes.db");

// --- File DB helpers ---
function readNotesFile() {
  try {
    if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]), "utf8");
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.error("readNotesFile error:", err);
    return [];
  }
}
function writeNotesFile(notes) {
  fs.writeFileSync(DB_PATH, JSON.stringify(notes, null, 2), "utf8");
}

// --- CRUD routes ---

// GET all notes
app.get("/notes", (req, res) => {
  try {
    const notes = readNotesFile();
    const sorted = notes.slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    res.json(sorted);
  } catch (err) {
    console.error("GET /notes error:", err);
    res.status(500).json({ error: "Server error fetching notes" });
  }
});

// CREATE note
app.post("/notes", (req, res) => {
  try {
    const { title, content, walletAddress } = req.body;
    if (!title || !content) return res.status(400).json({ error: "Missing title or content" });

    const newNote = {
      _id: randomUUID().replace(/-/g, ""),
      title,
      content,
      walletAddress: walletAddress || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const notes = readNotesFile();
    notes.unshift(newNote);
    writeNotesFile(notes);
    res.json(newNote);
  } catch (err) {
    console.error("POST /notes error:", err);
    res.status(500).json({ error: "Error saving note" });
  }
});

// UPDATE note
app.put("/notes/:id", (req, res) => {
  try {
    const { title, content } = req.body;
    const notes = readNotesFile();
    const idx = notes.findIndex(n => n._id === req.params.id || n.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Note not found" });

    notes[idx] = {
      ...notes[idx],
      title: title || notes[idx].title,
      content: content || notes[idx].content,
      updated_at: new Date().toISOString(),
    };
    writeNotesFile(notes);
    res.json(notes[idx]);
  } catch (err) {
    console.error("PUT /notes/:id error:", err);
    res.status(500).json({ error: "Error updating note" });
  }
});

// DELETE note
app.delete("/notes/:id", (req, res) => {
  try {
    const notes = readNotesFile();
    const idx = notes.findIndex(n => n._id === req.params.id || n.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Note not found" });

    const deleted = notes.splice(idx, 1)[0];
    writeNotesFile(notes);
    res.json({ message: "Note deleted", deletedNote: deleted });
  } catch (err) {
    console.error("DELETE /notes/:id error:", err);
    res.status(500).json({ error: "Error deleting note" });
  }
});

// --- Cardano on-chain routes ---

// Build unsigned transaction
app.post("/buildUnsignedTx", async (req, res) => {
  try {
    const { noteId, hash, walletAddress } = req.body;
    if (!noteId || !hash || !walletAddress)
      return res.status(400).json({ error: "Missing noteId, hash, or walletAddress" });

    const metadata = {
      noteId,
      hash,
      timestamp: new Date().toISOString(),
      source: "NoteBuddyOptionB",
    };

    const unsignedTxHex = await buildUnsignedTxMetadata(walletAddress, metadata);
    res.json({ unsignedTxHex });
  } catch (err) {
    console.error("POST /buildUnsignedTx error:", err.message || err);
    res.status(400).json({
      error: err.message.includes("UTxO") ? err.message : "Error building unsigned tx",
    });
  }
});

// Submit signed transaction
app.post("/submitTx", async (req, res) => {
  try {
    const { signedTxHex, noteId } = req.body;
    if (!signedTxHex) return res.status(400).json({ error: "Missing signedTxHex" });

    const txHash = await submitSignedTx(signedTxHex);

    if (noteId) {
      const notes = readNotesFile();
      const idx = notes.findIndex(n => n._id === noteId || n.id === noteId);
      if (idx !== -1) {
        notes[idx] = {
          ...notes[idx],
          txHash,
          onchain_proof: { txHash, attached_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        };
        writeNotesFile(notes);
      }
    }

    res.json({ success: true, txHash });
  } catch (err) {
    console.error("POST /submitTx error:", err);
    res.status(500).json({ error: err.message || "Error submitting tx" });
  }
});

// Attach proof manually
app.post("/attachOnChainProof", (req, res) => {
  try {
    const { noteId, txHash } = req.body;
    if (!noteId || !txHash) return res.status(400).json({ error: "Missing noteId or txHash" });

    const notes = readNotesFile();
    const idx = notes.findIndex(n => n._id === noteId || n.id === noteId);
    if (idx === -1) return res.status(404).json({ error: "Note not found" });

    notes[idx] = {
      ...notes[idx],
      txHash,
      onchain_proof: { txHash, attached_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    };
    writeNotesFile(notes);
    res.json({ success: true, note: notes[idx] });
  } catch (err) {
    console.error("POST /attachOnChainProof error:", err);
    res.status(500).json({ error: "Error attaching proof" });
  }
});

// Raw DB view
app.get("/rawNotesDb", (req, res) => {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    res.type("json").send(raw);
  } catch (err) {
    res.status(500).json({ error: "Could not read notes.db" });
  }
});

// --- Start server ---
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
