import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for getting directory name in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFile = path.join(__dirname, 'notes-data.json');

class Database {
  constructor() {
    // Create file if it doesn't exist
    if (!fs.existsSync(dbFile)) {
      fs.writeFileSync(dbFile, JSON.stringify([], null, 2));
    }
  }

  _read() {
    try {
      return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  _write(data) {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
  }

  getAll() {
    return this._read().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  getPending() {
    return this._read().filter(n => n.status === 'pending');
  }

  add(note) {
    const notes = this._read();
    notes.unshift(note);
    this._write(notes);
    return note;
  }

  update(id, updates) {
    const notes = this._read();
    const index = notes.findIndex(n => n.id == id);
    if (index !== -1) {
      notes[index] = { ...notes[index], ...updates, updated_at: new Date().toISOString() };
      this._write(notes);
      return notes[index];
    }
    return null;
  }

  updateStatus(txHash, status) {
    const notes = this._read();
    const index = notes.findIndex(n => n.blockchain && n.blockchain.txHash === txHash);
    
    if (index !== -1) {
      console.log(`📝 Updating note status to: ${status}`);
      notes[index].status = status;
      this._write(notes);
      return true;
    }
    return false;
  }

  delete(id) {
    let notes = this._read();
    const newNotes = notes.filter(n => n.id != id);
    this._write(newNotes);
    return true;
  }
}

export default new Database();