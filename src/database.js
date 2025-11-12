import * as path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import * as repl from 'node:repl';
import { loadEnvFile } from 'node:process';
import Database from 'better-sqlite3';

import { log_error } from './utils.js';
import { generate_password, hash_password } from "./utils.js";

const DB_DIR = path.join(import.meta.dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'postream.db');
const db_ops = {};
const PAGE_SIZE = 20;
const queries = {};

if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
}

let db = new Database(DB_PATH);


/*
 *
 *  DB Operations
 */

db_ops.insert_user = (password_hash) => (
    insert_data('insert_user', password_hash)
);

db_ops.insert_token = (user_id) => (
    insert_data('insert_token', user_id, get_token_expiration())
);

db_ops.insert_post = (user_id, content) => (
    insert_data('insert_post', user_id, content, new Date().toISOString())
);

db_ops.insert_reply = (post_id, content) => (
    insert_data('insert_reply', post_id, content, new Date().toISOString())
);

db_ops.insert_notification = (user_id, post_id, first_new_reply_id) => (
    insert_data('insert_notification', user_id, post_id, first_new_reply_id, new Date().toISOString(), 1)
);

db_ops.select_token = (user_id) => (
    select_data('select_token', user_id)
);

db_ops.select_user = (password_hash) => (
    select_data('select_user', password_hash)
);

db_ops.select_post = (id) => (
    select_data('select_post', id)
);

db_ops.select_notification = (post_id) => (
    select_data('select_notification', post_id)
);

db_ops.count_posts = () => (
    count_data('count_posts')
);

db_ops.count_user_posts = (user_id) => (
    count_data('count_user_posts', user_id)
);

db_ops.count_user_notifications = (user_id) => (
    count_data('count_user_notifications', user_id)
);

db_ops.count_post_replies = (post_id) => (
    count_data('count_post_replies', post_id)
);

db_ops.select_posts_page = (page = 1) => (
    select_data_page('select_posts_page', page)
);

db_ops.select_user_posts_page = (user_id, page = 1) => (
    select_data_page('select_user_posts_page', page, user_id)
);

db_ops.select_user_notifications_page = (user_id, page = 1) => (
    select_data_page('select_user_notifications_page', page, user_id)
);

db_ops.select_post_replies_page = (post_id, page = 1) => (
    select_data_page('select_post_replies_page', page, post_id)
);

db_ops.select_user_posts_match = (user_id, search_term) => (
    select_data_match('select_user_posts_match', user_id, search_term)
);

db_ops.select_user_notifications_match = (user_id, search_term) => (
    select_data_match('select_user_notifications_match', user_id, search_term)
);

db_ops.update_token = (user_id) => (
    update_data('update_token', 'run', get_token_expiration(), user_id)
);

db_ops.update_notification = (post_id) => (
    update_data('update_notification', post_id)
);

db_ops.delete_post = (post_id, user_id) => (
    delete_data('delete_post', post_id, user_id)
);

db_ops.delete_user = (user_id) => (
    delete_data('delete_user', user_id)
);

db_ops.delete_notification = (notification_id, user_id) => (
    delete_data('delete_notification', notification_id, user_id)
);

function get_token_expiration()
{
    let expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 24*7);
    expires_at = expires_at.toISOString();
    return expires_at;
}

function insert_data(query, ...args)
{
    const { 
        data, 
        query_error 
    } = exec_query(query, 'run', ...args);

    return query_error ? null : data.lastInsertRowid;
}

function select_data(query, ...args)
{
    const {
        data,
        query_error,
    } = exec_query(query, 'get', ...args);

    return { 
        data, 
        db_error: query_error 
    };
}

function update_data(query, ...args)
{
    const {
        data,
        query_error,
    } = exec_query(query, 'run', ...args);
   
    return {
        is_data_updated: data?.changes > 0,
        db_error: query_error,
    };
}

function delete_data(query, ...args) 
{
    const {
        data,
        query_error,
    } = exec_query(query, 'run', ...args);

    return {
        is_data_deleted: data?.changes > 0,
        db_error: query_error,
    };
}

function count_data(query, ...args) 
{
    const { data, db_error } = select_data(query, ...args);

    return {
        count: data?.count,
        db_error,
    };
}

function select_data_page(query, page, ...args)
{
    const {
        data,
        query_error,
    } = exec_query(query, 'all', ...args, (page-1) * PAGE_SIZE);

    return { 
        data,
        db_error: query_error,
    };
}

function select_data_match(query, ...args)
{
    const {
        data,
        query_error,
    } = exec_query(query, 'all', ...args);

    return { 
        data, 
        db_error: query_error 
    };
}

function exec_query(query, action, ...args)
{
    let data = null, query_error = false;
    
    try {
        data = queries[query][action](...args);
    } catch (error) {
        query_error = true;
        log_error(error);
    }

    return { data, query_error };
}

function init_db()
{
    db.pragma('journal_mode = WAL');

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            password_hash TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            expires_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS replies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            post_id INTEGER NOT NULL,
            first_new_reply_id INTEGER NOT NULL,
            num_of_replies INTEGER NOT NULL,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
        );
        
        -- Usage: retrieve posts in index and profile pages
        CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
    `);

    queries.insert_user = db.prepare('INSERT INTO users (password_hash) VALUES (?)');
    queries.select_user = db.prepare('SELECT * FROM users WHERE password_hash = ?');
    queries.delete_user = db.prepare('DELETE FROM users WHERE id = ?');

    queries.insert_token = db.prepare('INSERT INTO tokens (user_id, expires_at) VALUES (?, ?)');
    queries.select_token = db.prepare('SELECT * FROM tokens WHERE user_id = ?');
    queries.update_token = db.prepare('UPDATE tokens SET expires_at = ? WHERE user_id = ?');

    queries.insert_post = db.prepare('INSERT INTO posts (user_id, content, created_at) VALUES (?, ?, ?)');
    queries.select_post = db.prepare('SELECT * FROM posts WHERE id = ?');
    queries.delete_post = db.prepare('DELETE FROM posts WHERE id = ? AND user_id = ?');
    
    queries.insert_reply = db.prepare('INSERT INTO replies (post_id, content, created_at) VALUES (?, ?, ?)');
    queries.select_post_replies = db.prepare('SELECT * FROM replies WHERE post_id = ? ORDER BY created_at DESC');
    
    queries.insert_notification = db.prepare(`
        INSERT INTO notifications (user_id, post_id, first_new_reply_id, created_at, num_of_replies) 
        VALUES (?, ?, ?, ?, ?)
    `);
    queries.select_notification = db.prepare('SELECT * FROM notifications WHERE post_id = ?');
    queries.update_notification = db.prepare(`
        UPDATE notifications 
        SET num_of_replies = num_of_replies + 1 
        WHERE post_id = ?
    `);
    queries.delete_notification = db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?');
    
    queries.count_posts = db.prepare('SELECT COUNT(*) as count FROM posts');
    queries.count_user_posts = db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ?');
    queries.count_user_notifications = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?');
    queries.count_post_replies = db.prepare('SELECT COUNT(*) as count FROM replies WHERE post_id = ?');

    queries.select_posts_page = db.prepare(`
        SELECT * FROM posts 
        ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ?
    `);
    queries.select_user_posts_page = db.prepare(`
        SELECT * FROM posts 
        WHERE user_id = ? 
        ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ?
    `);
    queries.select_post_replies_page = db.prepare(`
        SELECT * FROM replies
        WHERE post_id = ?
        ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ?
    `);
    queries.select_user_notifications_page = db.prepare(`
        SELECT n.*, posts.content AS post_content FROM notifications n
        JOIN posts ON n.post_id = posts.id
        WHERE n.user_id = ? 
        ORDER BY n.created_at DESC LIMIT ${PAGE_SIZE} OFFSET ?
    `);

    queries.select_user_posts_match = db.prepare(`
        SELECT p.* FROM posts p
        WHERE p.user_id = ? AND LOWER(p.content) LIKE '%' || ? || '%'
        LIMIT ${PAGE_SIZE}
    `);
    queries.select_user_notifications_match = db.prepare(`
        SELECT n.*, posts.content AS post_content FROM notifications n
        JOIN posts ON n.post_id = posts.id
        WHERE n.user_id = ? AND LOWER(posts.content) LIKE '%' || ? || '%'
        ORDER BY n.created_at DESC
        LIMIT ${PAGE_SIZE}
    `);
}

function close_db() {
    db.close();
}

if (process.argv[1] === import.meta.filename)
{
    // -s stands for seed
    if (process.argv.includes('-s'))
    {
        repl.start({
            prompt: 'This operation will erase the existing database and create a new one with the seed data. ' +
                'Do you want to continue? (y/n) ',
            eval: async answer => {
                if (answer.trim().toLowerCase() === 'y') {
                    await rebuild_db();
                } else {
                    console.log('Operation aborted.');
                }
                process.exit(0);
            },
        });
    } else {
        init_db();

        // Usually I do tests here.
    }
}

async function rebuild_db()
{
    try {
        await unlink(DB_PATH);
        db = new Database(DB_PATH);
        loadEnvFile();
        init_db();
    } catch (error) {
        log_error(error);
        console.log('The database may be in usage by the server.');
        return;
    }

    /* Each of the underlying posts shows a nuance of the post-card. */

    const lorem_ipsum =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." +
        "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat." +
        "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur." +
        "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum"
    ;

    const long_post_chunks = new Array(100);
    for (let i = 0; i < long_post_chunks.length; i++) {
        long_post_chunks[i] = lorem_ipsum;
    }

    const list = 'Pros:\n✅ ...\n✅ ...\n✅ ...\n\nCons:\n❌ ...\n❌ ...\n';

    const code = '&lt;!DOCTYPE html&gt;\n&lt;html lang="en"&gt;\n' +
        '&lt;head&gt;\n\t&lt;meta charset="UTF-8"&gt;\n' +
        '\t&lt;title&gt;Document&lt;/title&gt;\n&lt;/head&gt;\n' +
        '&lt;body&gt;\n\t&lt;script&gt;\n\t\tconsole.log("&lt;/script&gt;");\n' +
        '\t&lt;/script&gt;\n&lt;/body&gt;\n&lt;/html&gt;';

    const firefox_releases = '144.0_\n143.0_ 143.0.1 143.0.3 143.0.4\n142.0_ 142.0.1' +
        '\n141.0_ 141.0.2 141.0.3\n140.0_ 140.0.1 140.0.2 140.0.4 140.1.0 140.2.0 140.3.0 140.3.1 140.4.0\n' +
        '139.0_ 139.0.1 139.0.4\n138.0_ 138.0.1 138.0.3 138.0.4\n137.0_';

    const users = new Array(3);

    console.log('Users:');
    for (let i = 0; i < users.length; i++) {
        const password = generate_password();
        const { password_hash, hash_error } = hash_password(password, true);
        if (hash_error) {
            return;
        }
        const user = db_ops.insert_user(password_hash);
        users[i] = user;

        console.log(`- password_${i}:`, password);
    }

    // 40 posts are crated to show the pagination feature
    for (let i = 0; i < 40; i++) {
        db_ops.insert_post(users[0], 'post ' + i);
    }

    db_ops.insert_post(users[0], long_post_chunks.join(''));
    db_ops.insert_post(users[0], list);
    
    let post_id = db_ops.insert_post(users[1], code);
    db_ops.insert_post(users[1], long_post_chunks.join(''));
    db_ops.insert_post(users[1], firefox_releases);

    for (let i = 0; i < 45; i++) {
        db_ops.insert_reply(post_id, `console.log('Hello World');`);
    }

    console.log('\nDatabase rebuilt successfully ✅');
    console.log('\nThings I suggest to do to fully experience the website:');
    console.log('- Create looong posts');
    console.log('- Create looong replies');
    console.log('- Look at the notifications');
    console.log('- Create a lot of posts and replies to see the pagination in action');
}

export {
    PAGE_SIZE,
    init_db,
    close_db,
    db_ops,
};

