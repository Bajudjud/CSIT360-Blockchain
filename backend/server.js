// server.js
const express = require("express");
const cors = require("cors");
const db = require("./database");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Helper: normalize a DB timestamp string (SQLite "YYYY-MM-DD HH:MM:SS") to ISO UTC "YYYY-MM-DDTHH:MM:SSZ"
function normalizeDateToISOZ(val) {
  if (!val) return null;
  // If it's already an ISO (contains 'T'), return as-is
  if (typeof val === "string" && val.includes("T")) {
    // if it has no timezone at end, assume it's already correct ISO; otherwise return
    return val.endsWith("Z") ? val : val;
  }
  // If it's the SQLite format "YYYY-MM-DD HH:MM:SS" -> convert to "YYYY-MM-DDTHH:MM:SSZ" (UTC)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(val)) {
    return val.replace(" ", "T") + "Z";
  }
  // Fallback: try building a Date and returning ISO
  const d = new Date(val);
  if (!isNaN(d)) return d.toISOString();
  return val;
}

function normalizeRowDates(row) {
  if (!row) return row;
  return {
    ...row,
    created_at: normalizeDateToISOZ(row.created_at),
    updated_at: normalizeDateToISOZ(row.updated_at),
  };
}

// GET all notes
app.get("/api/notes", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM notes ORDER BY created_at DESC").all();
    const normalized = rows.map(normalizeRowDates);
    res.json(normalized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single note
app.get("/api/notes/:id", (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM notes WHERE id = ?").get(req.params.id);
    res.json(normalizeRowDates(row) || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE note
app.post("/api/notes", (req, res) => {
  const { title, content } = req.body;
  try {
    const stmt = db.prepare("INSERT INTO notes (title, content) VALUES (?, ?)");
    const result = stmt.run(title, content);

    const newNote = db.prepare("SELECT * FROM notes WHERE id = ?").get(result.lastInsertRowid);
    res.json(normalizeRowDates(newNote));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE note
app.put("/api/notes/:id", (req, res) => {
  const { title, content } = req.body;
  try {
    const stmt = db.prepare(
      "UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    );
    stmt.run(title, content, req.params.id);

    const updatedNote = db.prepare("SELECT * FROM notes WHERE id = ?").get(req.params.id);
    res.json(normalizeRowDates(updatedNote));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE note
app.delete("/api/notes/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM notes WHERE id = ?").run(req.params.id);
    res.json({ message: "Note deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
