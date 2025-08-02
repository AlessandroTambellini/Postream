import { join, dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';

import { log_error } from './utils.mjs';

const DB_PATH = join(import.meta.dirname, '..', 'data', 'poststream.db');
const db_dir = dirname(DB_PATH);

const PAGE_LIMIT = 100;

// INIT_DB
if (!existsSync(db_dir)) {
    mkdirSync(db_dir, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

const create_tables = `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_password_hash TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );
`;

const created_at_index = `
    -- Index on timestamp for chronological queries (ASC and DESC)
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
`;

db.exec(create_tables);
db.exec(created_at_index);
// end INIT_DB

function db_close() {
    db.close();
}

/*
 * 
 *  Statements
 */
const insert_user = db.prepare('INSERT INTO users (password_hash) VALUES (?)');
const select_user = db.prepare('SELECT * FROM users WHERE password_hash = ?');
const delete_user = db.prepare('DELETE FROM users WHERE id = ?');
const select_user_posts = db.prepare('SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC');

const insert_token = db.prepare('INSERT INTO tokens (user_id, user_password_hash, expires_at) VALUES (?, ?, ?)');
const select_token = db.prepare('SELECT * FROM tokens WHERE user_password_hash = ?');
const update_token = db.prepare('UPDATE tokens SET expires_at = ? WHERE user_password_hash = ?');

const insert_post  = db.prepare('INSERT INTO posts (user_id, content) VALUES (?, ?)');
const select_post = db.prepare('SELECT * FROM posts WHERE id = ?');
const delete_post = db.prepare('DELETE FROM posts WHERE id = ? AND user_id = ?');

const insert_reply = db.prepare('INSERT INTO replies (post_id, content) VALUES (?, ?)');
const select_post_replies = db.prepare('SELECT * FROM replies WHERE post_id = ? ORDER BY created_at DESC');

// Used just for testing
const select_reply = db.prepare('SELECT * FROM replies WHERE id = ?');

const select_posts_count = db.prepare('SELECT COUNT(*) as count FROM posts');
const select_all_posts = db.prepare('SELECT id, content, created_at FROM posts ORDER BY created_at DESC');
const select_posts_page_asc = db.prepare('SELECT id, content, created_at FROM posts ORDER BY created_at ASC LIMIT ? OFFSET ?');
const select_posts_page_desc = db.prepare('SELECT id, content, created_at FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?');
const select_posts_page_rand = db.prepare('SELECT id, content, created_at FROM posts ORDER BY RANDOM() LIMIT ?');

/*
NOTES:
- The 'db_op' methods are just wrappers around the statements.
They don't do anything more than that.

- Both users(password_hash) and tokens(id) are unique,
but I don't find convenient to specify with 'UNIQUE' and instead I prefer to check it manually.

- I don't think it's useful to report to the user the exact error message in case of a
database exception because it's not releted wiht its request. 
Therefore, I simply return a 500 status code and a made up message.
*/

/*
 * 
 *  DB Operations 
 */

const db_op = {};

/*
 * 
 *  DB Operations - INSERT
 */

db_op.insert_user = function(password_hash)
{
    try {
        const res = insert_user.run(password_hash);
        return res.lastInsertRowid;
    } catch (error) {
        log_error(error);
        return null;
    }
};

db_op.insert_token = function(user_id, password_hash)
{    
    try {
        let expires_at = new Date();
        expires_at.setHours(expires_at.getHours() + 24);
        expires_at = expires_at.toISOString();
    
        const res = insert_token.run(user_id, password_hash, expires_at);
        return res.lastInsertRowid;

    } catch (error) {
        log_error(error);
        return null;
    }
};

db_op.insert_post = function(user_id, content) {
    try {
        const res = insert_post.run(user_id, content);
        return res.lastInsertRowid;
    } catch (error) {
        log_error(error);
        return null;
    }
};

db_op.insert_reply = function(post_id, content) 
{
    try {
        const res = insert_reply.run(post_id, content);
        return res.lastInsertRowid;
    } catch (error) {
        log_error(error);
        return null;
    }
};

/*
 * 
 *  DB Operations - SELECT
 */

db_op.select_token = function(password_hash)
{
    let token = null, db_error = null;
    try {
        token = select_token.get(password_hash);
    } catch (error) {
        db_error = true;
        log_error(error); 
    } 

    return { token, db_error };
};

db_op.select_user = function(password_hash)
{
    let user = null, db_error = null;
    try {
        user = select_user.get(password_hash);
    } catch (error) {
        db_error = true;
        log_error(error);
    } 
    
    return { user, db_error };
};

db_op.select_post = function(id) 
{    
    let post = null, db_error = null;
    try {
        post = select_post.get(id);
    } catch (error) {
        db_error = true;
        log_error(error);
    } 

    return { post, db_error };
};

db_op.select_post_replies = function(post_id)
{
    let replies = null, db_error = null;
    try {
        replies = select_post_replies.all(post_id);
    } catch (error) {
        db_error = true;
        log_error(error);
    } 

    return { replies, db_error };
}

db_op.select_user_posts = function(user_id)
{
    let posts = null, db_error = null;
    try {
        posts = select_user_posts.all(user_id);
    } catch (error) {
        db_error = true;
        log_error(error);
    } 

    return { posts, db_error };
};

db_op.select_posts_page = function(page = 1, limit = 50, sort = 'asc') 
{
    const offset = (page - 1) * limit;    
    let posts = null, db_error = null;

    try {
        if (sort === 'asc') posts = select_posts_page_asc.all(limit, offset);
        else if (sort === 'desc') posts = select_posts_page_desc.all(limit, offset);
        else posts = select_posts_page_rand.all(limit);
    } catch (error) {
        db_error = true;
        log_error(error);
    } 

    return { 
        posts, 
        page, 
        num_of_posts: count_posts(),
        db_error
    };
};

db_op.select_all_posts = function() 
{
    const num_of_posts = count_posts();
    if (num_of_posts > 1000) {
        console.warn(`WARN: Retrieving ${num_of_posts} posts at once.`);
    }

    let posts = null, db_error = null;
    try {
        posts = select_all_posts.all();
    } catch (error) {
        db_error = true;
        log_error(error);   
    } 

    return { posts, db_error };
};

/*
 * 
 *  DB Operations - UPDATE
 */

db_op.update_token = function(expires_at, password_hash)
{
    let is_token_updated = false, db_error = null;
    try {
        const res = update_token.run(expires_at, password_hash);
        if (res.changes > 0) is_token_updated = true;
    } catch (error) {
        db_error = true;
        log_error(error);
    } 

    return { is_token_updated, db_error };
};

/*
 * 
 *  DB Operations - DELETE
 */

db_op.delete_post = function(post_id, user_id) 
{
    let is_post_deleted = false, db_error = null;
    try {
        const res = delete_post.run(post_id, user_id);
        is_post_deleted = res.changes > 0 ? true : false;
    } catch (error) {
        db_error = true;
        log_error(error);
    } 

    return { is_post_deleted, db_error };
};

db_op.delete_user = function(user_id)
{
    let is_user_deleted = false, db_error = null;
    try {
        const res = delete_user.run(user_id);
        is_user_deleted = res.changes > 0 ? true : false;
    } catch (error) {
        db_error = true;
        log_error(error);
    } 
        
    return { is_user_deleted, db_error };
};

/*  
 *  
 *  Auxiliary functions
 */

function validate_token(password_hash)
{
    const { token, db_error } = db_op.select_token(password_hash);

    let user_id = null;

    if (!db_error) {
        if (token && token.expires_at > new Date().toISOString()) {
            user_id = token.user_id;
        }
    }

    return { user_id, db_error };
}

function count_posts() {
    const { count } = select_posts_count.get();
    return count;
}

export {
    PAGE_LIMIT,
    db_op,
    validate_token,
    db_close,
};

