import * as path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import * as repl from 'node:repl';
import Database from 'better-sqlite3';

import { log_error } from './utils.js';
import { generate_password, hash_password } from "./utils.js";

const DB_DIR = path.join(import.meta.dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'postream.db');

if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
}

let db = new Database(DB_PATH);
const queries = {};

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

        -- Usage: search posts in profile and notifications pages
        CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts 
        USING fts5(content, content_rowid UNINDEXED);

        -- Autosync for post INSERT
        CREATE TRIGGER IF NOT EXISTS posts_ai 
        AFTER INSERT ON posts 
        BEGIN
            INSERT INTO posts_fts(rowid, content) 
            VALUES (new.id, new.content);
        END;

        -- Autosync for post DELETE
        CREATE TRIGGER IF NOT EXISTS posts_ad 
        AFTER DELETE ON posts 
        BEGIN
            DELETE FROM posts_fts WHERE rowid = old.id;
        END;
    `);

    const count = db.prepare('SELECT COUNT(*) as count FROM posts_fts').get();
    if (count.count === 0) {
        db.exec(`
            INSERT INTO posts_fts(rowid, content) 
            SELECT id, content FROM posts
        `);
    }

    queries.insert_user = db.prepare('INSERT INTO users (password_hash) VALUES (?)');
    queries.select_user = db.prepare('SELECT * FROM users WHERE password_hash = ?');
    queries.delete_user = db.prepare('DELETE FROM users WHERE id = ?');

    queries.insert_token = db.prepare('INSERT INTO tokens (user_id, expires_at) VALUES (?, ?)');
    queries.select_token = db.prepare('SELECT * FROM tokens WHERE user_id = ?');
    queries.update_token = db.prepare('UPDATE tokens SET expires_at = ? WHERE user_id = ?');

    queries.insert_post = db.prepare('INSERT INTO posts (user_id, content, created_at) VALUES (?, ?, ?)');
    queries.select_post = db.prepare('SELECT * FROM posts WHERE id = ?');
    queries.delete_post = db.prepare('DELETE FROM posts WHERE id = ? AND user_id = ?');
    queries.select_post_replies = db.prepare('SELECT * FROM replies WHERE post_id = ? ORDER BY created_at DESC');

    queries.insert_reply = db.prepare('INSERT INTO replies (post_id, content, created_at) VALUES (?, ?, ?)');

    queries.select_notification = db.prepare('SELECT * FROM notifications WHERE post_id = ?');
    queries.insert_notification = db.prepare(`
        INSERT INTO notifications 
        (user_id, post_id, first_new_reply_id, created_at, num_of_replies) 
        VALUES (?, ?, ?, ?, ?)
    `);
    queries.update_notification = db.prepare('UPDATE notifications SET num_of_replies = num_of_replies + 1 WHERE post_id = ?');
    queries.delete_notification = db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?');

    queries.select_posts_page_asc = db.prepare('SELECT * FROM posts ORDER BY created_at ASC LIMIT ? OFFSET ?');
    queries.select_posts_page_desc = db.prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?');
    queries.select_posts_page_rand = db.prepare('SELECT * FROM posts ORDER BY RANDOM() LIMIT ?');

    queries.select_user_posts_count = db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ?');
    queries.select_user_notifications_count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?');

    queries.select_user_posts_page = db.prepare(`
        SELECT * FROM posts 
        WHERE user_id = ? 
        ORDER BY created_at DESC LIMIT ? OFFSET ?
    `);

    queries.select_user_notifications_page = db.prepare(`
        SELECT n.*, posts.content AS post_content FROM notifications n
        JOIN posts ON n.post_id = posts.id
        WHERE n.user_id = ? 
        ORDER BY n.created_at DESC LIMIT ? OFFSET ?
    `);

    queries.select_user_matching_posts = db.prepare(`
        SELECT p.* FROM posts p
        JOIN posts_fts ON p.id = posts_fts.rowid 
        WHERE posts_fts MATCH ? AND p.user_id = ?
    `);

    queries.select_user_matching_notifications = db.prepare(`
        SELECT n.*, posts.content AS post_content FROM notifications n
        JOIN posts ON n.post_id = posts.id
        WHERE n.user_id = ? AND LOWER(posts.content) LIKE '%' || ? || '%'
        ORDER BY n.created_at DESC
    `);
}

function close_db() {
    db.close();
}


/*
 *
 *  DB Operations
 */

const db_ops = {};

/*
NOTES about db_ops:
1) db_ops are wrappers around queries.
They don't perform any type of cheking on the arguments because
That task is already performed by the handlers before calling these methods

2) I don't think it's useful to report to the user the exact error message in case of a
database exception because it's not directly correleted with its request.
Therefore, a 500 status code is returned and a made up message based on the context.
*/

const TOKEN_DURATION_IN_HOURS = 24 * 7;
const DEFAULT_PAGE_SIZE = 20;

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

/*
 *  DB Operations - INSERT
 */

db_ops.insert_user = function(password_hash)
{
    const { data, query_error } = exec_query('insert_user', 'run', password_hash);

    return query_error ? null : data.lastInsertRowid;
};

db_ops.insert_token = function(user_id)
{
    let expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + TOKEN_DURATION_IN_HOURS);
    expires_at = expires_at.toISOString();

    const {
        data,
        query_error,
    } = exec_query('insert_token', 'run', user_id, expires_at);

    return query_error ? null : data.lastInsertRowid;
};

function test()
{
    init_db()

    let password_hash='123';

    const {
        data,
        query_error,
    } = exec_query('insert_user', 'run', password_hash);

    console.log(data, query_error);
}

//test()

db_ops.insert_post = function(user_id, content)
{
    const {
        data,
        query_error,
    } = exec_query('insert_post', 'run', user_id, content, new Date().toISOString());

    return query_error ? null : data.lastInsertRowid;
};

db_ops.insert_reply = function(post_id, content)
{
    const {
        data,
        query_error,
    } = exec_query('insert_reply', 'run', post_id, content, new Date().toISOString());

    return query_error ? null : data.lastInsertRowid;
};

db_ops.insert_notification = function(user_id, post_id, first_new_reply_id)
{
    const {
        data,
        query_error,
    } = exec_query('insert_notification', 'run', user_id, post_id, first_new_reply_id, new Date().toISOString(), 1);

    return query_error ? null : data.lastInsertRowid;
};


/*
 *  DB Operations - SELECT
 */

db_ops.select_token = function(user_id)
{
    const {
        data: token,
        query_error: db_error,
    } = exec_query('select_token', 'get', user_id);

    return { token, db_error };
};

db_ops.select_user = function(password_hash)
{
    const {
        data: user,
        query_error: db_error,
    } = exec_query('select_user', 'get', password_hash);

    return { user, db_error }
};

db_ops.select_post = function(id)
{
    const {
        data: post,
        query_error: db_error,
    } = exec_query('select_post', 'get', id);

    return { post, db_error };
};

db_ops.select_notification = function(post_id)
{
    const {
        data: notification,
        query_error: db_error,
    } = exec_query('select_notification', 'get', post_id);

    return { notification, db_error };
};

db_ops.select_post_replies = function(post_id)
{
    const {
        data: replies,
        query_error: db_error,
    } = exec_query('select_post_replies', 'all', post_id);

    return { replies, db_error };
};

db_ops.select_posts_page = function(page, sort, limit = DEFAULT_PAGE_SIZE)
{
    const offset = (page - 1) * limit;

    const sorting_type = {
        'desc': {
            query: 'select_posts_page_desc',
            args: [limit, offset],
        },
        'asc': {
            query: 'select_posts_page_asc',
            args: [limit, offset],
        },
        'rand': {
            query: 'select_posts_page_rand',
            args: [limit],
        },
    };

    if (!sorting_type[sort]) {
        log_error(new Error(`The sorting '${sort}' isn't supported`));
        return { posts: [], tot_num_of_posts: 0, db_error: false };
    }

    const {
        data: posts,
        query_error: db_error,
    } = exec_query(sorting_type[sort].query, 'all', ...sorting_type[sort].args);

    return { posts, db_error };
};

db_ops.select_user_posts_count = function(user_id)
{
    const {
        data,
        query_error: db_error,
    } = exec_query('select_user_posts_count', 'get', user_id);

    return { count: data?.count, db_error };
};

db_ops.select_user_posts_page = function(user_id, page, limit = DEFAULT_PAGE_SIZE)
{
    const offset = (page - 1) * limit;

    const {
        data: posts,
        query_error: db_error,
    } = exec_query('select_user_posts_page', 'all', user_id, limit, offset);

    return { posts, db_error };
};

db_ops.select_user_notifications_count = function(user_id)
{
    const {
        data,
        query_error: db_error,
    } = exec_query('select_user_notifications_count', 'get', user_id);

    return { count: data?.count, db_error };
};

db_ops.select_user_notifications_page = function(user_id, page, limit = DEFAULT_PAGE_SIZE)
{
    const offset = (page - 1) * limit;

    const {
        data: notifications,
        query_error: db_error,
    } = exec_query('select_user_notifications_page', 'all', user_id, limit, offset);

    return { notifications, db_error };
};

db_ops.select_user_matching_posts = function(user_id, search_term)
{
    const {
        data: posts,
        query_error: db_error,
    } = exec_query('select_user_matching_posts', 'all', search_term, user_id);

    return { posts, db_error };
};

db_ops.select_user_matching_notifications = function(user_id, search_term)
{
    const {
        data: notifications,
        query_error: db_error,
    } = exec_query('select_user_matching_notifications', 'all', user_id, search_term);

    return { notifications, db_error };
};


/*
 *  DB Operations - UPDATE
 */

db_ops.update_token = function(user_id)
{
    let expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + TOKEN_DURATION_IN_HOURS);
    expires_at = expires_at.toISOString();

    const {
        data,
        query_error: db_error,
    } = exec_query('update_token', 'run', expires_at, user_id);

    return {
        is_token_updated: data?.changes > 0,
        db_error,
    };
};

db_ops.update_notification = function(post_id)
{
    const {
        data,
        query_error: db_error,
    } = exec_query('update_notification', 'run', post_id);

    return {
        is_notification_updated: data?.changes > 0,
        db_error,
    };
};

/*
 *
 *  DB Operations - DELETE
 */

db_ops.delete_post = function(post_id, user_id)
{
    const {
        data,
        query_error,
    } = exec_query('delete_post', 'run', post_id, user_id);

    return {
        is_post_deleted: data?.changes > 0,
        db_error: query_error,
    };
};

db_ops.delete_user = function(user_id)
{
    const {
        data,
        query_error,
    } = exec_query('delete_user', 'run', user_id);

    return {
        is_user_deleted: data?.changes > 0,
        db_error: query_error,
    };
};

db_ops.delete_notification = function(notification_id, user_id)
{
    const {
        data,
        query_error,
    } = exec_query('delete_notification', 'run', notification_id, user_id);

    return {
        is_notification_deleted: data?.changes > 0,
        db_error: query_error,
    };
};

// For the future: import.meta.main
if (process.argv.includes('--run-seed') || process.argv.includes('-S'))
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
}

async function rebuild_db()
{
    try {
        await unlink(DB_PATH);
        db = new Database(DB_PATH);
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

    // ---------------- //

    const users = new Array(3);

    console.log('Users:');
    for (let i = 0; i < users.length; i++) {
        const password = generate_password();
        const user = db_ops.insert_user(hash_password(password));
        users[i] = user;

        console.log(`- password_${i}:`, password);
    }

    db_ops.insert_post(users[0], long_post_chunks.join(''));
    db_ops.insert_post(users[0], list);

    db_ops.insert_post(users[1], code);
    db_ops.insert_post(users[1], firefox_releases);

    console.log('\nDatabase rebuilt successfully ✅');
    console.log('\nThings I suggest to do to fully experience the website:');
    console.log('- Create looong posts');
    console.log('- Create looong replies');
    console.log('- Look at the notifications');
    console.log('- Create a lot of posts and replies to see the pagination in action');
}

export {
    DEFAULT_PAGE_SIZE,
    init_db,
    close_db,
    db_ops,
};

