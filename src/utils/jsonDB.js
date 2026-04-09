/**
 * Simple JSON file-based database
 * Used instead of MongoDB for development/testing
 */

const fs = require('fs');
const path = require('path');
const { getCurrentISO } = require('./dateFormatter');

// Detect Vercel environment more reliably
const isVercel = process.env.VERCEL === '1' || 
                 process.env.VERCEL_ENV || 
                 process.env.AWS_LAMBDA_FUNCTION_NAME || // Also works on Lambda
                 __dirname.includes('/var/task'); // Vercel uses /var/task

// Get data directory - use /tmp on Vercel, local directory otherwise
const getDataDir = () => {
  if (isVercel) {
    return '/tmp/hungerwood-data';
  }
  return path.join(__dirname, '../../data');
};

const DATA_DIR = getDataDir();

// Ensure data directory exists (lazy initialization to avoid blocking)
let dataDirInitialized = false;
const ensureDataDir = () => {
    if (!dataDirInitialized) {
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }
            dataDirInitialized = true;
        } catch (error) {
            console.error(`Failed to create data directory ${DATA_DIR}:`, error);
            // Don't throw - allow app to continue
        }
    }
};

class JsonDB {
    constructor(filename) {
        ensureDataDir(); // Ensure directory exists before using it
        this.filepath = path.join(DATA_DIR, filename);
        this.ensureFile();
    }

    ensureFile() {
        try {
            if (!fs.existsSync(this.filepath)) {
                fs.writeFileSync(this.filepath, JSON.stringify([], null, 2));
            }
        } catch (error) {
            console.error(`Failed to ensure file ${this.filepath}:`, error);
            // Don't throw - allow read() to handle missing file
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
