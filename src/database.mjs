import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = join(import.meta.dirname, 'messages.db');

const PAGE_LIMIT = 100;

// INIT_DB
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

const create_table = `
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`;

db.exec(create_table);
// end INIT_DB

const insert_msg = db.prepare('INSERT INTO messages (content) VALUES (?)');
const select_all_msgs = db.prepare('SELECT * FROM messages ORDER BY timestamp DESC');
const select_msgs_count = db.prepare('SELECT COUNT(*) as count FROM messages');
const select_msg_by_id = db.prepare('SELECT * FROM messages WHERE id = ?');
const select_msgs_page_desc = db.prepare('SELECT * FROM messages ORDER BY timestamp DESC LIMIT ? OFFSET ?');
const select_msgs_page_asc = db.prepare('SELECT * FROM messages ORDER BY timestamp ASC LIMIT ? OFFSET ?');
const select_msgs_page_rand = db.prepare('SELECT * FROM messages ORDER BY RANDOM() LIMIT ?');

async function db_store_msg(msg) {
    try {
        const res = insert_msg.run(msg);
        return { 
            'Success': 'Msg stored.',
            // 'id': res.lastInsertRowid
        };
    } catch (error) {
        return { Error: `Can't store msg: ${error.message}.` };
    }
}

// I leave this function for testing
async function db_get_msgs_all() {
    try {
        const { count: num_of_msgs } = select_msgs_count.get();
        if (num_of_msgs > 1000) {
            console.warn(`WARN: Retrieving ${num_of_msgs} messages at once. Consider using pagination.`);
        }

        return select_all_msgs.all();
    } catch (error) {
        return { Error: `Can't retrieve messages from database: ${error.message}.` };
    }
}

async function db_get_msgs_page(page = 1, limit = 50, sort = 'asc') {
    try {
        const offset = (page - 1) * limit;    
        
        let msgs;
        if (sort === 'asc') msgs = select_msgs_page_asc.all(limit, offset);
        else if (sort === 'desc') msgs = select_msgs_page_desc.all(limit, offset);
        else msgs = select_msgs_page_rand.all(limit);

        const { count } = select_msgs_count.get();
        
        return { 
            msgs, 
            page, 
            num_of_msgs: count
        };
    } catch (error) {
        return { Error: `Can't retrieve msgs page: ${error.message}.` };
    }
}

async function db_get_msg_by_id(id) {
    try {
        const msg = select_msg_by_id.get(id);
        return msg || { Error: `Msg with id ${id} not found.` };
    } catch (error) {
        return { Error: `Can't retrieve msg from db: ${error.message}.` };
    }
}

function db_close() {
    db.close();
}

export {
    PAGE_LIMIT,
    db_store_msg,
    db_get_msgs_all,
    db_get_msgs_page,
    db_get_msg_by_id,
    db_close
};

