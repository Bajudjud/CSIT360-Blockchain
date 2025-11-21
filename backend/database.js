// backend/database.js - SIMPLIFIED FILE-BASED DATABASE
const fs = require('fs');
const path = require('path');
const PORT = 5000;
const dbFile = path.join(__dirname, 'notes-data.json');

// Initialize empty database file if it doesn't exist
if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify([]));
}

class SimpleDB {
    constructor() {
        this.data = this.loadData();
        this.nextId = this.data.length > 0 ? Math.max(...this.data.map(n => n.id)) + 1 : 1;
    }

    loadData() {
        try {
            const data = fs.readFileSync(dbFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading database:', error);
            return [];
        }
    }

    saveData() {
        try {
            fs.writeFileSync(dbFile, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving database:', error);
        }
    }

    all() {
        return [...this.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    get(id) {
        return this.data.find(note => note.id === parseInt(id));
    }

    insert(note) {
        const newNote = {
            id: this.nextId++,
            title: note.title,
            content: note.content,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        this.data.push(newNote);
        this.saveData();
        return newNote;
    }

    update(id, updates) {
        const noteIndex = this.data.findIndex(note => note.id === parseInt(id));
        if (noteIndex === -1) return null;

        this.data[noteIndex] = {
            ...this.data[noteIndex],
            ...updates,
            updated_at: new Date().toISOString()
        };
        this.saveData();
        return this.data[noteIndex];
    }

    delete(id) {
        const noteIndex = this.data.findIndex(note => note.id === parseInt(id));
        if (noteIndex === -1) return false;

        this.data.splice(noteIndex, 1);
        this.saveData();
        return true;
    }
}

console.log("Simple file-based database connected!");
module.exports = new SimpleDB();