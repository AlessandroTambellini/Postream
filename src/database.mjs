import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const DB_PATH = join(import.meta.dirname, '..', 'data', 'letters.db');
const db_dir = dirname(DB_PATH);

const PAGE_LIMIT = 100;

// INIT_DB
if (!existsSync(db_dir)) {
    mkdirSync(db_dir, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

const create_table = `
    CREATE TABLE IF NOT EXISTS letters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL,
        email VARCHAR(255),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`;

const create_indexes = `
    -- Index on timestamp for chronological queries (ASC and DESC)
    CREATE INDEX IF NOT EXISTS idx_letters_timestamp ON letters(timestamp);
`;

db.exec(create_table);
db.exec(create_indexes);
// end INIT_DB

const select_letter_by_id = db.prepare('SELECT * FROM letters WHERE id = ?');
const insert_letter = db.prepare('INSERT INTO letters (message, email) VALUES (?, ?)');
const delete_letter_by_id = db.prepare('DELETE FROM letters WHERE id = ?');
const select_all_letters = db.prepare('SELECT id, message, timestamp FROM letters ORDER BY timestamp DESC');
const select_letters_page_desc = db.prepare('SELECT id, message, timestamp FROM letters ORDER BY timestamp DESC LIMIT ? OFFSET ?');
const select_letters_page_asc = db.prepare('SELECT id, message, timestamp FROM letters ORDER BY timestamp ASC LIMIT ? OFFSET ?');
const select_letters_page_rand = db.prepare('SELECT id, message, timestamp FROM letters ORDER BY RANDOM() LIMIT ?');
const select_letters_count = db.prepare('SELECT COUNT(*) as count FROM letters');

async function db_store_letter(letter_obj) {
    try {
        const res = insert_letter.run(letter_obj.message, letter_obj.email);
        return { id: res.lastInsertRowid };
    } catch (error) {
        return { Error: `Can't store letter: ${error.message}` };
    }
}

async function db_get_letter_by_id(id, hide_email = true) {
    try {
        const letter = select_letter_by_id.get(id);
        if (hide_email) delete letter.email;
        return letter || { Error: `Letter with id '${id}' not found`, status: 404 };
    } catch (error) {
        return { Error: `Can't retrieve letter from db: ${error.message}`, status: 500 };
    }
}

async function db_delete_letter_by_id(id) {
    try {
        const res = delete_letter_by_id.run(id);
        return res.changes > 0 ? { id } : { Error: `Letter with id '${id}' not found'`, status: 404 }; 
    } catch (error) {
        return { Error: `Can't delete letter with id '${id}': ${error.message}`, status: 500 };
    }
}

// I leave this function for testing
async function db_get_all_letters() {
    try {
        const num_of_letters = count_letters();
        if (num_of_letters > 1000) {
            console.warn(`WARN: Retrieving ${num_of_letters} letters at once. Consider using pagination.`);
        }

        return select_all_letters.all();
    } catch (error) {
        return { Error: `Can't retrieve letters from database: ${error.message}` };
    }
}

async function db_get_letters_page(page = 1, limit = 50, sort = 'asc') {
    try {
        const offset = (page - 1) * limit;    
        
        let letters;
        if (sort === 'asc') letters = select_letters_page_asc.all(limit, offset);
        else if (sort === 'desc') letters = select_letters_page_desc.all(limit, offset);
        else letters = select_letters_page_rand.all(limit);
        
        return { 
            letters, 
            page, 
            num_of_letters: count_letters()
        };
    } catch (error) {
        return { Error: `Can't retrieve letters page: ${error.message}` };
    }
}

function count_letters() {
    const { count } = select_letters_count.get();
    return count;
}

function db_close() {
    db.close();
}

export {
    PAGE_LIMIT,
    db_get_letter_by_id,
    db_store_letter,
    db_delete_letter_by_id,
    db_get_all_letters,
    db_get_letters_page,
    count_letters,
    db_close
};

