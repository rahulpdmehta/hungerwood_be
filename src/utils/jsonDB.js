/**
 * Simple JSON file-based database
 * Used instead of MongoDB for development/testing
 */

const fs = require('fs');
const path = require('path');
const { getCurrentISO } = require('./dateFormatter');

const DATA_DIR = path.join(__dirname, '../../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

class JsonDB {
    constructor(filename) {
        this.filepath = path.join(DATA_DIR, filename);
        this.ensureFile();
    }

    ensureFile() {
        if (!fs.existsSync(this.filepath)) {
            fs.writeFileSync(this.filepath, JSON.stringify([], null, 2));
        }
    }

    read() {
        try {
            const data = fs.readFileSync(this.filepath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading ${this.filepath}:`, error);
            return [];
        }
    }

    write(data) {
        try {
            fs.writeFileSync(this.filepath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error(`Error writing ${this.filepath}:`, error);
            return false;
        }
    }

    findAll() {
        return this.read();
    }

    findById(id) {
        const data = this.read();
        return data.find(item => item._id === id || item.id === id);
    }

    findOne(query) {
        const data = this.read();
        return data.find(item => {
            return Object.keys(query).every(key => item[key] === query[key]);
        });
    }

    find(query = {}) {
        const data = this.read();
        if (Object.keys(query).length === 0) {
            return data;
        }
        return data.filter(item => {
            return Object.keys(query).every(key => item[key] === query[key]);
        });
    }

    create(newItem) {
        const data = this.read();
        const id = newItem._id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const item = { ...newItem, _id: id, createdAt: getCurrentISO() };
        data.push(item);
        this.write(data);
        return item;
    }

    update(id, updates) {
        const data = this.read();
        const index = data.findIndex(item => item._id === id || item.id === id);
        if (index === -1) return null;

        data[index] = { ...data[index], ...updates, updatedAt: getCurrentISO() };
        this.write(data);
        return data[index];
    }

    delete(id) {
        const data = this.read();
        const filtered = data.filter(item => item._id !== id && item.id !== id);
        this.write(filtered);
        return filtered.length < data.length;
    }
}

module.exports = JsonDB;
