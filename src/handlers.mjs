import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";

import { 
    PAGE_LIMIT, 
    db_op, 
    validate_token 
} from "./database.mjs";

import { 
    JSON_to_obj,
    hash_password,
    read_HTML_page,
    generate_password,
    log_error,
} from './utils.mjs';

import { 
    post_card, 
    write_post_link, 
    reply_card, 
    fallback_page,
    fallback_info_msg, 
} from "./templates.js";

const WEB_INTERFACE_PATH = join(import.meta.dirname, 'web_interface');

const MSG_INVALID_METHOD = (method, path) => {
    return `The method '${method}' isn't allowed for path '${path}'`;
};
const MSG_INVALID_SEARCH_PARAM = (header_name) => {
    return `Missing or invalid '${header_name}' search param`;
};
const MSG_INVALID_COOKIE = (cookie_name) => {
    return `Missing or invalid '${cookie_name}' cookie`;
};
const MSG_INVALID_PAYLOAD_FORMAT = (error_msg) => {
    return `The payload doesn't have a valid format: ${error_msg}`;
};
const MSG_INVALID_PAYLOAD_FIELD = (field_name) => {
    return `Missing or invalid '${field_name}' field`;
};
const MSG_NOT_FOUND = (entity, field) => {
    return `No ${entity} for the specified '${field}'`;
};
const MSG_UNKNOWN_DB_ERROR = (action, entity) => {
    return `Un unknown database error has occured while trying to ${action} the ${entity}`;
};

/*
 * 
 *  Pages 
 */

const page = {};

page.index = route_page_method('index');
page.login = route_page_method('login');
page['create-account'] = route_page_method('create-account');
page.profile = route_page_method('profile');
page['write-post'] = route_page_method('write-post');
page['write-reply'] = route_page_method('write-reply');
page['read-post'] = route_page_method('read-post');
page.logout  = route_page_method('logout');
page['delete-account'] = route_page_method('delete-account');

function route_page_method(page) {
    return async function(req_data, res_obj) {
        if (req_data.method === 'GET') {
            await this[page].GET(req_data, res_obj);
        } else {
            res_obj.error(405, MSG_INVALID_METHOD(req_data.method, req_data.path));
        }
    }
}

// Auth required to enable SOME functionalities of the page
page.index.GET = async function(req_data, res_obj) 
{
    let { page: index_page, fs_error } = await read_HTML_page('index');
    
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    const { user_id, status_code } = auth_user(req_data.cookies);

    if (status_code === 500)
    {
        res_obj.page(status_code, fallback_page(status_code));
        return;
    }

    if (user_id) { // User is authenticated
        index_page = index_page
            .replace('{{ nav-links }}', `<a href="profile">Profile</a><a href="logout">Logout</a>`)
            .replace('{{ write-post-link }}', write_post_link());
    } else {
        index_page = index_page
            .replace('{{ nav-links }}', `<a href="login">Login</a><a href="create-account">Create Account</a>`)
            .replace('{{ write-post-link }}', '');
    }

    const { posts, db_error } = db_op.select_posts_page(1, 20, 'desc');

    if (db_error) 
        index_page = index_page.replace('{{ post-cards }}', fallback_info_msg('Sorry, unable to retrieve the posts :)'));
    else 
    {
        const post_cards = [];
        posts.forEach(post => {
            post_cards.push(post_card(post, 2, true));
        });
        index_page = index_page.replace('{{ post-cards }}', post_cards.join(''));
    }
    
    res_obj.page(200, index_page);
};

page['create-account'].GET = async function(req_data, res_obj)
{
    let { page: signup_page, fs_error } = await read_HTML_page('create-account');
   
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    res_obj.page(200, signup_page);
};

page.login.GET = async function(req_data, res_obj)
{
    let { page: login_page, fs_error } = await read_HTML_page('login');
    
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    res_obj.page(200, login_page);
};

// Auth required to access the page
page.profile.GET = async function(req_data, res_obj)
{
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id)
    {
        res_obj.page(status_code, fallback_page(status_code));
        return;
    }

    let { page: profile_page, fs_error } = await read_HTML_page('profile');
    
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    const { posts, db_error } = db_op.select_user_posts(user_id);

    if (db_error)
        profile_page = profile_page.replace('{{ post-cards }}', 
            fallback_info_msg('Sorry, unable to retrieve the posts :('));
    else
    {
        const post_cards = [];
        posts.forEach(post => {
            post_cards.push(post_card(post, 1, true));
        });
        profile_page = profile_page.replace('{{ post-cards }}', 
            post_cards.length > 0 ? post_cards.join('') : fallback_info_msg('You didn\'t create any post yet.'));
    }

    res_obj.page(200, profile_page);
};

// Auth required to access the page
page['write-post'].GET = async function(req_data, res_obj) 
{
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id)
    {
        res_obj.page(status_code, fallback_page(status_code));
        return;
    }

    const { page: write_post_page, fs_error } = await read_HTML_page('write-post');
    
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    res_obj.page(200, write_post_page);
};

// Auth required to access the page
page['write-reply'].GET = async function(req_data, res_obj) 
{
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id)
    {
        res_obj.page(status_code, fallback_page(status_code));
        return;
    }

    let { page: write_reply_page, fs_error } = await read_HTML_page('write-reply');
    
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    const post_id = req_data.search_params.get('id');
    
    const { post, db_error } = db_op.select_post(post_id);
    
    if (db_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    if (!post) {
        write_reply_page = write_reply_page.replace('{{ post-card }}', fallback_info_msg(`There is no post with id '${post_id}'`));
    } else {
        write_reply_page = write_reply_page.replace('{{ post-card }}', post_card(post, 0, false));
    }

    res_obj.page(200, write_reply_page);
};

page['read-post'].GET = async function(req_data, res_obj)
{
    let { page: post_page, fs_error } = await read_HTML_page('read-post');
    
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    const post_id = req_data.search_params.get('id');
    const { post, db_error } = db_op.select_post(post_id);

    if (db_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!post) {
        post_page = post_page.replace('{{ post-card }}', fallback_info_msg(`There is no post with id '${post_id}'`));
    } else {
        post_page = post_page.replace('{{ post-card }}', post_card(post, user_id ? 2 : 0, false));
    }

    /*
     * If, who is reading the post is also its the author, load the replies. */

    if (user_id) post_page = post_page.replace('{{ nav-links }}', `<a href="index">Index</a><a href="profile">Profile</a>`);
    else post_page = post_page.replace('{{ nav-links }}', `<a href="index">Index</a>`);

    if (user_id && post.user_id === user_id)
    {
        // load replies
        const { replies, db_error } = db_op.select_post_replies(post_id);

        if (db_error)
            post_page = post_page.replace('{{ replies }}', 
                fallback_info_msg('Sorry, unable to retrieve the replies :('));
        else
        {
            const reply_cards = [];
            replies.forEach(reply => {
                reply_cards.push(reply_card(reply));
            });

            post_page = post_page.replace('{{ replies }}',
                reply_cards.length > 0 ? reply_cards.join('') : fallback_info_msg('There aren\'t replies.'));
        }
    }
    else
        post_page = post_page.replace('{{ replies }}', '');

    res_obj.page(200, post_page);
};  

// Auth required to access the page
page.logout.GET = async function(req_data, res_obj)
{
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id)
    {
        res_obj.page(status_code, fallback_page(status_code));
        return;
    }

    const { page: logout_page, fs_error } = await read_HTML_page('logout');
    
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    res_obj.page(200, logout_page);
};

// Auth required to access the page
page['delete-account'].GET = async function(req_data, res_obj)
{
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id)
    {
        res_obj.page(status_code, fallback_page(status_code));
        return;
    }  

    const { page: delete_account_page, fs_error } = await read_HTML_page('delete-account');

    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    res_obj.page(200, delete_account_page);
};

/*
 * 
 *  Miscellaneous 
 */

function not_found(path, res_obj) {
    res_obj.error(404, `The path '${path}' doesn't exist`);
}

async function get_asset(req_data, res_obj) 
{
    const asset_path = req_data.path;

    let f_binary = false;
    let content_type;

    const file_ext = extname(asset_path).replace('.', '');
    
    const extensions = {
        css: 'text/css',
        svg: 'image/svg+xml',
        js: 'text/javascript',
        mjs: 'text/javascript',
        json: 'application/json',
        ttf: 'font/ttf',
    };

    if (extensions[file_ext]) {
        content_type = extensions[file_ext];
    } else {
            content_type = 'text/plain';
        /* Not necessarily the request was made to get an asset.
        So, before logging the warning for 'unknown extension', I first check if the extension is even defined at all.
        That's because 'get_asset' is called as the last routing option in case none of the previous ones matched the requested path. */
        if (file_ext)
            console.warn(`WARN: Unknown file extension '${file_ext}'. File path: '${asset_path}'.`);
    }

    if (content_type === 'font/ttf') 
        f_binary = true;

    try { 
        const asset = await readFile(join(WEB_INTERFACE_PATH, asset_path), f_binary ? {} : { encoding: 'utf8' });
        
        // I solved an unsolved computer science problem. 
        // Frameworks like Vue and React force you to put assets in a specific folder if I remember correctly.
        if (req_data.method !== 'GET') {
            res_obj.error(405, MSG_INVALID_METHOD(req_data.method, req_data.path));
        } else {
            res_obj.success(200, asset, content_type);
        }

    } catch (error) {
        if (error.code === 'ENOENT') {
            not_found(asset_path, res_obj);
        } else if (error.code === 'EISDIR') {
            res_obj.error(400, `'${asset_path}' is a directory`);
        } else {
            log_error(error);
            res_obj.error(500, `Un unknown error has occured while trying to read '${asset_path}' from disk`);
        }
    }
}

function auth_user(cookies)
{
    let status_code = 200, auth_error = null;

    if (!cookies || !cookies.password_hash) {
        auth_error = MSG_INVALID_COOKIE('password_hash');
        status_code = 401;
        return { user_id: null, status_code, auth_error };
    }  

    const { user_id, db_error } = validate_token(cookies.password_hash);

    if (db_error) {
        status_code = 500;
        auth_error = MSG_UNKNOWN_DB_ERROR('validate', 'token');
    }
    else if (!user_id) {
        status_code = 401;
        auth_error = `Invalid 'password_hash'. It may be expired`;
    }

    return { user_id, status_code, auth_error };
} 

/*
 * 
 *  APIs 
 */

const API = {};

API.user  = route_API_method('user');
API.token = route_API_method('token');
API.post  = route_API_method('post');
API.reply = route_API_method('reply');
API['posts/page']    = route_API_method('posts/page');
API['posts/all'] = route_API_method('posts/all');

function route_API_method(api) {
    return function(req_data, res_obj) {
        if (this[api][req_data.method]) {
            this[api][req_data.method](req_data, res_obj);
        } else {
            res_obj.error(405, MSG_INVALID_METHOD(req_data.method, req_data.path));
        }
    }
}

/*
 *  
 *  APIs - User
 */

API.user.POST = function(req_data, res_obj) 
{
    const password = generate_password();
    /* I might check if an user with the generated password already exists,
    but, given the probability of generating two times the same password
    in my life time is 0, I don't do it. */
    const password_hash = hash_password(password);

    const user_id = db_op.insert_user(password_hash);

    if (!user_id) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('insert', 'user'));
    } else {
        res_obj.success(200, { password });
    }
};

API.user.DELETE = function(req_data, res_obj) 
{
    const { user_id, status_code, auth_error } = auth_user(req_data.cookies);
    
    if (auth_error)
    {
        res_obj.error(status_code, auth_error);
        return;
    }

    const { is_user_deleted, db_error } = db_op.delete_user(user_id);

    if (db_error) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('delete', 'user'));
        return;
    }

    if (!is_user_deleted) {
        res_obj.error(404, MSG_NOT_FOUND('user', 'user_id'));
        return;
    }

    res_obj.success(200);
};

/*
 *  
 *  APIs - Token
 */

API.token.GET = function(req_data, res_obj)
{
    const password = req_data.search_params.get('password');
    
    if (!password) {
        res_obj.error(400, MSG_INVALID_SEARCH_PARAM('password'));
        return;
    }

    const password_hash = hash_password(password);

    const { token, db_error } = db_op.select_token(password_hash);

    if (db_error) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('validate', 'token'));
        return;
    }

    if (token) {
        res_obj.success(200, token);
    } else {
        res_obj.error(404, MSG_NOT_FOUND('token', 'password'));
    }
};

API.token.POST = function(req_data, res_obj)
{
    const { obj: payload, JSON_error } = JSON_to_obj(req_data.payload);

    if (JSON_error) {
        res_obj.error(400, MSG_INVALID_PAYLOAD_FORMAT(JSON_error));
        return; 
    }

    const password = payload.password;

    if (!password || typeof password !== 'string') {
        res_obj.error(400, MSG_INVALID_PAYLOAD_FIELD('password'));
        return; 
    }

    const password_hash = hash_password(password);

    const { user, db_error } = db_op.select_user(password_hash);
    
    if (db_error) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('select', 'user'));
        return;
    }

    if (!user) {
        res_obj.error(404, MSG_NOT_FOUND('user', 'password'));
        return; 
    }

    const { token, db_error: token_db_error } = db_op.select_token(password_hash);

    if (token_db_error) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('validate', 'token'));
        return;
    }

    if (token) {
        res_obj.error(400, 'A token for that user already exists');
        return; 
    } 

    const token_id = db_op.insert_token(user.id, password_hash);
    
    if (!token_id) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('insert', 'token'));
    } else {
        res_obj.success(200, { password_hash });
    }
};

API.token.PUT = function(req_data, res_obj)
{
    const { obj, JSON_error } = JSON_to_obj(req_data.payload);

    if (JSON_error) {
        res_obj.error(400, MSG_INVALID_PAYLOAD_FORMAT(JSON_error));
        return; 
    }

    const password = obj.password;

    if (!password || typeof password !== 'string') {
        res_obj.error(400, MSG_INVALID_PAYLOAD_FIELD('password'));
        return; 
    }

    const password_hash = hash_password(password);

    const { token, db_error } = db_op.select_token(password_hash);
    
    if (db_error) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('select', 'token'));
        return;
    }
    
    if (!token) {
        res_obj.error(404, MSG_NOT_FOUND('token', 'password'));
        return;
    }

    let expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 24);
    expires_at = expires_at.toISOString();

    const { is_token_updated, db_error: token_db_error } = db_op.update_token(expires_at, password_hash);

    if (token_db_error) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('update', 'token'));
        return;
    }
    
    if (!is_token_updated) {
        res_obj.error(404, MSG_NOT_FOUND('token', 'password_hash'));
        return;
    }

    res_obj.success(200, { password_hash });
};

/*
 *  
 *  APIs - Post
 */

API.post.GET = function(req_data, res_obj)
{
    const post_id = req_data.search_params.get('id');
    
    if (!post_id) {
        res_obj.error(400, MSG_INVALID_SEARCH_PARAM('id'));
        return;
    }

    const { post, db_error } = db_op.select_post(post_id);

    if (db_error) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('select', 'post'));
        return;
    }

    if (!post) {
        res_obj.error(404, MSG_NOT_FOUND('post', 'id'));
        return; 
    }

    res_obj.success(200, post);
};

API.post.POST = function(req_data, res_obj)
{
    const { user_id, status_code, auth_error } = auth_user(req_data.cookies);
    
    if (auth_error)
    {
        res_obj.error(status_code, auth_error);
        return;
    }
    
    const { obj: post, JSON_error } = JSON_to_obj(req_data.payload);

    if (JSON_error) {
        res_obj.error(400, MSG_INVALID_PAYLOAD_FORMAT(JSON_error));
        return; 
    }

    const { content } = post;

    if (!content || typeof content !== 'string') { 
        res_obj.error(400, MSG_INVALID_PAYLOAD_FIELD('content'));
        return; 
    }

    const post_id = db_op.insert_post(user_id, content);
    
    if (!post_id) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('insert', 'post'))
    } else {
        res_obj.success(200, { post_id });
    }
};

API.post.DELETE = function(req_data, res_obj)
{    
    const { user_id, status_code, auth_error } = auth_user(req_data.cookies);
    
    if (auth_error)
    {
        res_obj.error(status_code, auth_error);
        return;
    }

    const post_id = req_data.search_params.get('id');
    
    if (!post_id) {
        res_obj.error(400, MSG_INVALID_SEARCH_PARAM('id'));
        return;
    }

    const { is_post_deleted, db_error } = db_op.delete_post(post_id, user_id);
    
    if (db_error) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('delete', 'post'));
        return;
    }

    if (!is_post_deleted) {
        res_obj.error(404,  `Either the post for the specified 'id' doesn't exist, or you aren't the owner of that post`);
        return;
    }

    res_obj.success(200);
};

/*
 *  
 *  APIs - Reply
 */

API.reply.POST = function(req_data, res_obj)
{
    const { status_code, auth_error } = auth_user(req_data.cookies);
    
    if (auth_error)
    {
        res_obj.error(status_code, auth_error);
        return;
    }

    const { obj: reply_obj, JSON_error } = JSON_to_obj(req_data.payload);

    if (JSON_error) {
        res_obj.error(400, MSG_INVALID_PAYLOAD_FORMAT(JSON_error));
        return; 
    }

    const { post_id, content } = reply_obj;

    if (!post_id) {
        res_obj.error(400, MSG_INVALID_PAYLOAD_FIELD('post_id'));
        return;
    }

    if (!content || typeof content !== 'string') {
        res_obj.error(400, MSG_INVALID_PAYLOAD_FIELD('content'));
        return;
    }

    const { post, db_error } = db_op.select_post(post_id);

    if (db_error) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('select', 'post'));
        return;
    }

    if (!post) {
        res_obj.error(404, MSG_NOT_FOUND('post', 'id'));
        return; 
    }

    const reply_id = db_op.insert_reply(post_id, content);

    if (!reply_id) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('insert', 'reply'));
    } else {
        res_obj.success(200, { reply_id });
    }
};

/*
 * 
 *  Miscellaneous 
 */ 

API['posts/page'].GET = function(req_data, res_obj)
{
    const page = parseInt(req_data.search_params.get('page')) || 1;
    const limit = parseInt(req_data.search_params.get('limit')) || 50;
    const sort = req_data.search_params.get('sort') || 'asc';

    if (page < 1) {
        res_obj.error(400, `Page must be >= 1. Got ${page} instead`);
        return;
    }
    
    if (limit < 1 || limit > PAGE_LIMIT) {
        res_obj.error(400, `Limit must be 1-100. Got ${limit} instead`);
        return;
    }
    
    if (sort !== 'asc' && sort !== 'desc' && sort !== 'rand') {
        res_obj.error(400, `Invalid sorting option. Got '${sort}'. Valid options are: asc, desc, rand`);
        return;
    }

    const res = db_op.select_posts_page(page, limit, sort);

    if (res.db_error) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('get', 'posts'));
    } else {
        res_obj.success(200, res);
    }
};

API['posts/all'].GET = function(req_data, res_obj)
{
    const { posts, db_error } = db_op.select_all_posts();

    if (db_error) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('select', 'posts'));
        return;
    }

    res_obj.success(200, posts);
};

/*
 * 
 * 
 */

export {
    page,
    API,
    not_found,
    get_asset,
};
