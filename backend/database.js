const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "notes.db");
const db = new Database(dbPath);

// Create notes table
db.exec(`CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

console.log("SQLite database connected with better-sqlite3!");
module.exports = db;
