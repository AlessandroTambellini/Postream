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
    read_template,
    generate_password,
    log_error,
} from './utils.mjs';

import { 
    components, 
    fallback_page,
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

page.index = async function(req_data, res_obj) 
{
    let { template: index_template, fs_error } = await read_template('index');
    
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

    const { posts, db_error } = db_op.select_posts_page(1, 20, 'desc');

    if (db_error) 
        index_template = index_template.replace('{{ post-cards }}', components['.info-msg']('Sorry, unable to retrieve the posts :)'));
    else 
    {
        const post_cards = [];
        posts.forEach(post => {
            post_cards.push(components['.post-card'](post, 2, true));
        });
        index_template = index_template.replace('{{ post-cards }}', post_cards.join(''));
    }
    
    const index_page = index_template
        .replace('{{ universal-resources }}', components['universal-resources'])
        .replace('{{ .feedback-card }}', components['.feedback-card'])
        .replace('{{ #side-nav }}', components['#side-nav'](user_id && true, 'index'))
    ;

    res_obj.page(200, index_page);
};

page['create-account'] = async function(req_data, res_obj)
{
    let { template: create_account_template, fs_error } = await read_template('create-account');
   
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    const create_account_page = create_account_template
        .replace('{{ universal-resources }}', components['universal-resources'])
        .replace('{{ .feedback-card }}', components['.feedback-card'])
        .replace('{{ #side-nav }}', components['#side-nav'](false, 'create-account'))
    ;

    res_obj.page(200, create_account_page);
};

page.login = async function(req_data, res_obj)
{
    let { template: login_template, fs_error } = await read_template('login');
    
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    const login_page = login_template
        .replace('{{ universal-resources }}', components['universal-resources'])
        .replace('{{ .feedback-card }}', components['.feedback-card'])
        .replace('{{ #side-nav }}', components['#side-nav'](false, 'login'))
    ;

    res_obj.page(200, login_page);
};

page.profile = async function(req_data, res_obj)
{
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id)
    {
        res_obj.page(status_code, fallback_page(status_code));
        return;
    }

    let { template: profile_template, fs_error } = await read_template('profile');
    
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    const { posts, db_error } = db_op.select_user_posts(user_id);

    if (db_error) {
        profile_template = profile_template.replace('{{ post-cards }}', 
            components['.info-msg']('Sorry, unable to retrieve the posts :('));
    }
    else
    {
        const post_cards = [];
        posts.forEach(post => {
            post_cards.push(components['.post-card'](post, 1, true));
        });

        profile_template = profile_template.replace('{{ post-cards }}', 
            post_cards.length > 0 ? post_cards.join('') : components['.info-msg']('You didn\'t create any post yet.'));
    }

    const profile_page = profile_template
        .replace('{{ universal-resources }}', components['universal-resources'])
        .replace('{{ #side-nav }}', components['#side-nav'](true, 'profile'))
    ;

    res_obj.page(200, profile_page);
};

page.notifications = async function(req_data, res_obj)
{
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id)
    {
        res_obj.page(status_code, fallback_page(status_code));
        return;
    }

    let { template: notifications_template, fs_error } = await read_template('notifications');

    if (fs_error) {
        res_obj.page(500, fallback_page(500));
        return;
    }

    const { notifications, db_error } = db_op.select_user_notifications(user_id);

    if (db_error)
        notifications_template = notifications_template.replace('{{ notification-cards }}', 
            components['.info-msg']('Sorry, unable to retrieve the posts :('));
    else
    {
        const notification_cards = [];
        notifications.forEach(notification => {
            notification_cards.push(components['.notification-card'](notification));
        });

        notifications_template = notifications_template.replace('{{ notification-cards }}', 
            notification_cards.length > 0 ? notification_cards.join('') : components['.info-msg']('You don\'t have any notification :)'));
    }

    const notifications_page = notifications_template
        .replace('{{ universal-resources }}', components['universal-resources'])
        .replace('{{ .feedback-card }}', components['.feedback-card'])
        .replace('{{ #side-nav }}', components['#side-nav'](true, 'notifications'))
    ;

    res_obj.page(200, notifications_page);
};

page['write-post'] = async function(req_data, res_obj) 
{
    const { user_id, status_code } = auth_user(req_data.cookies);
    
    if (!user_id)
    {
        res_obj.page(status_code, fallback_page(status_code));
        return;
    }

    const { template: write_post_template, fs_error } = await read_template('write-post');
    
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    const write_post_page = write_post_template
        .replace('{{ universal-resources }}', components['universal-resources'])
        .replace('{{ .feedback-card }}', components['.feedback-card'])
        .replace('{{ #side-nav }}', components['#side-nav'](true, 'write-post'))
    ;

    res_obj.page(200, write_post_page);
};

page['write-reply'] = async function(req_data, res_obj) 
{
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id)
    {
        res_obj.page(status_code, fallback_page(status_code));
        return;
    }

    let { template: write_reply_template, fs_error } = await read_template('write-reply');
    
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
        write_reply_template = write_reply_template.replace('{{ .post-card }}', components['.info-msg'](`There is no post with id '${post_id}'`));
    } else {
        write_reply_template = write_reply_template.replace('{{ .post-card }}', components['.post-card'](post, 0, false));
    }

    const write_reply_page = write_reply_template
        .replace('{{ universal-resources }}', components['universal-resources'])
        .replace('{{ .feedback-card }}', components['.feedback-card'])
        .replace('{{ #side-nav }}', components['#side-nav'](true, 'write-reply'))
    ;

    res_obj.page(200, write_reply_page);
};

page['read-post'] = async function(req_data, res_obj)
{
    let { template: post_template, fs_error } = await read_template('read-post');
    
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
        post_template = post_template.replace('{{ .post-card }}', components['.info-msg'](`There is no post with id '${post_id}'`));
    } else {
        post_template = post_template.replace('{{ .post-card }}', components['.post-card'](post, user_id ? 2 : 0, false));
    }

    /*
     * If, who is reading the post is also its the author, load the replies. */

    if (user_id && post.user_id === user_id)
    {
        // load replies
        const { replies, db_error } = db_op.select_post_replies(post_id);

        if (db_error)
            post_template = post_template.replace('{{ replies }}', 
                components['.info-msg']('Sorry, unable to retrieve the replies :('));
        else
        {
            const reply_cards = [];
            replies.forEach(reply => {
                reply_cards.push(components['.reply-card'](reply));
            });

            post_template = post_template.replace('{{ replies }}',
                reply_cards.length > 0 ? reply_cards.join('') : components['.info-msg']('There aren\'t replies.'));
        }
    }
    else
        post_template = post_template.replace('{{ replies }}', '');

    const post_page = post_template
        .replace('{{ universal-resources }}', components['universal-resources'])
        .replace('{{ #side-nav }}', components['#side-nav'](user_id && true, 'read-post'))
    ;

    res_obj.page(200, post_page);
};  

page.logout = async function(req_data, res_obj)
{
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id)
    {
        res_obj.page(status_code, fallback_page(status_code));
        return;
    }

    const { template: logout_template, fs_error } = await read_template('logout');
    
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    const logout_page = logout_template
        .replace('{{ universal-resources }}', components['universal-resources'])
        .replace('{{ #side-nav }}', components['#side-nav'](true, 'logout'))
    ;

    res_obj.page(200, logout_page);
};

page['delete-account'] = async function(req_data, res_obj)
{
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id)
    {
        res_obj.page(status_code, fallback_page(status_code));
        return;
    }  

    let { template: delete_account_page, fs_error } = await read_template('delete-account');

    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    delete_account_page = delete_account_page
        .replace('{{ universal-resources }}', components['universal-resources'])
        .replace('{{ .feedback-card }}', components['.feedback-card'])
        .replace('{{ #side-nav }}', components['#side-nav'](true, 'delete-account'))
    ;

    res_obj.page(200, delete_account_page);
};

page.logo = async function(req_data, res_obj)
{
    const { template: logo_page, fs_error } = await read_template('logo');

    if (fs_error) {
        res_obj.page(500, fallback_page(500));
    } else {
        res_obj.page(200, logo_page);
    }
};
 

/*
 * 
 *  APIs 
 */

const API = {};

API.list = route_API_method('list');
API.user = route_API_method('user');
API.token = route_API_method('token');
API.post = route_API_method('post');
API.reply = route_API_method('reply');
API['user/notifications'] = route_API_method('user/notifications');
API['posts/page'] = route_API_method('posts/page');
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

API.list.GET = function(req_data, res_obj) 
{
    res_obj.success(200, { 'Available APIs': Object.keys(API) });
};

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
    
    if (auth_error) {
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

    let { content, created_at } = post;

    if (!content || typeof content !== 'string') { 
        res_obj.error(400, MSG_INVALID_PAYLOAD_FIELD('content'));
        return; 
    }

    if (!created_at || typeof created_at !== 'string') {
        created_at = new Date().toLocaleString(); // Locale to the server
    }

    const post_id = db_op.insert_post(user_id, content, created_at);
    
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

    let { post_id, content, created_at } = reply_obj;

    if (!post_id) {
        res_obj.error(400, MSG_INVALID_PAYLOAD_FIELD('post_id'));
        return;
    }

    if (!content || typeof content !== 'string') {
        res_obj.error(400, MSG_INVALID_PAYLOAD_FIELD('content'));
        return;
    }

    if (!created_at || typeof created_at !== 'string') {
        created_at = new Date().toLocaleString();
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

    const reply_id = db_op.insert_reply(post_id, content, created_at);

    if (!reply_id) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('insert', 'reply'));
        return;
    }

    const notification_id = db_op.insert_notification(post.user_id, post.id, post.content.substring(0, 70), reply_id, created_at);

    if (!notification_id) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('insert', 'notification'));
        return;
    }

    // const res = active_clients.get(req_data.cookies.password_hash);
    // if (res) res.write(`data: new notification.\n\n`);

    res_obj.success(200, { reply_id });
};

API['user/notifications'].DELETE = function(req_data, res_obj)
{
    const { user_id, status_code, auth_error } = auth_user(req_data.cookies);
    
    if (auth_error)
    {
        res_obj.error(status_code, auth_error);
        return;
    }  

    const notification_id = req_data.search_params.get('id');
    
    if (!notification_id) {
        res_obj.error(400, MSG_INVALID_SEARCH_PARAM('id'));
        return;
    }

    const { is_notification_deleted, db_error } = db_op.delete_notification(notification_id, user_id);
    
    if (db_error) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('delete', 'notification'));
        return;
    }

    if (!is_notification_deleted) {
        res_obj.error(404,  `Either the notification for the specified 'id' doesn't exist, or you aren't the owner of that notification`);
        return;
    }

    res_obj.success(200);
};

API['posts/page'].GET = function(req_data, res_obj)
{
    const page = parseInt(req_data.search_params.get('page')) || 1;
    const limit = parseInt(req_data.search_params.get('limit')) || 50;
    const sort = req_data.search_params.get('sort') || 'desc';

    if (page < 1) {
        res_obj.error(400, `Page must be >= 1. Got ${page} instead`);
        return;
    }
    
    if (limit < 1 || limit > PAGE_LIMIT) {
        res_obj.error(400, `Limit must be 1-100. Got ${limit} instead`);
        return;
    }
    
    if (!['desc', 'asc', 'rand'].includes(sort)) {
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
 *  Miscellaneous 
 */

async function get_asset(req_data, res_obj) 
{
    const asset_path = req_data.path;

    let f_binary = false;
    let content_type;

    const file_ext = extname(asset_path).replace('.', '');
    
    const extensions = {
        css: 'text/css',
        js: 'text/javascript',
        mjs: 'text/javascript',
        json: 'application/json',
        // images
        svg: 'image/svg+xml',
        png: 'image/png',
        webp: 'image/webp',
        // font
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

    if (['font/ttf', 'image/png'].includes(content_type)) 
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
            res_obj.error(404, `The path '${asset_path}' doesn't exist`);
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

export {
    page,
    API,
    get_asset,
};
