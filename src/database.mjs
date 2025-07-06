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
const select_msgs_page = db.prepare('SELECT * FROM messages ORDER BY timestamp DESC LIMIT ? OFFSET ?');
const select_msgs_count = db.prepare('SELECT COUNT(*) as count FROM messages');

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
async function db_retrieve_all_msgs() {
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

async function db_get_msgs_page(page = 1, limit = 50) {
    try {
        const offset = (page - 1) * limit;
        
        const { count: num_of_msgs } = select_msgs_count.get();
        
        const msgs = select_msgs_page.all(limit, offset);
        
        return {
            msgs,
            pagination: {
                page,
                // I don't use this data for now
                // limit,
                // num_of_msgs,
                // num_of_pages: Math.ceil(num_of_msgs / limit),
                // has_next: page < Math.ceil(num_of_msgs / limit),
                // has_prev: page > 1
            }
        };
    } catch (error) {
        return { Error: `Can't retrieve messages page: ${error.message}.` };
    }
}

function db_close() {
    db.close();
}

export {
    PAGE_LIMIT,
    db_store_msg,
    db_retrieve_all_msgs,
    db_get_msgs_page,
    db_close
};

/*
export async function get_num_of_messages() {
    return select_msgs_count.get().count;
}

export async function get_message_by_id(id) {
    try {
        const getMessage = db.prepare('SELECT * FROM messages WHERE id = ?');
        const message = getMessage.get(id);
        return message || { Error: 'Message not found' };
    } catch (error) {
        return { Error: `Can't retrieve message: ${error.message}.` };
    }
}

export async function delete_message(id) {
    try {
        const deleteMessage = db.prepare('DELETE FROM messages WHERE id = ?');
        const result = deleteMessage.run(id);
        
        if (result.changes === 0) {
            return { Error: 'Message not found' };
        }
        
        return { Success: 'Message deleted' };
    } catch (error) {
        return { Error: `Can't delete message: ${error.message}.` };
    }
}

// This function is sugar on top of db_get_msgs_page.
export async function get_recent_messages(limit = 50) {
    try {
        const get_recent_messages = db.prepare('SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?');
        return get_recent_messages.all(limit);
    } catch (error) {
        return { Error: `Can't retrieve recent messages: ${error.message}.` };
    }
}
*/
