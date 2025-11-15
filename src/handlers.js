import * as path from "node:path";
import { env } from 'node:process';

import Res from "./server.js";
import { PAGE_SIZE, db_ops } from "./database.js";
import { hash_password, generate_password, log_error, read_file } from './utils.js';
import { DOMElements, fallback_page } from "./templates.js";

const WEB_INTERFACE_PATH = path.join(import.meta.dirname, 'web_interface');
const cached_pages = new Map();

const ERR_CUSTOM = msg => (
    { Error: msg }
);
const ERR_INVALID_METHOD = (method, path) => (
    { Error: `The method '${method}' isn't allowed for path '${path}'`}
);
const ERR_INVALID_SEARCH_PARAM = header_name => (
    { Error: `Missing or invalid '${header_name}' search param`}
);
const ERR_INVALID_COOKIE = cookie_name => (
    { Error: `Missing or invalid '${cookie_name}' cookie`}
);
const ERR_INVALID_PAYLOAD_FIELD = field_name => (
    { Error: `Missing or invalid '${field_name}' field`}
);
const ERR_NOT_FOUND = (entity, field) => (
    { Error: `No ${entity} for the specified '${field}'`}
);
const ERR_INVALID_DB_QUERY = (action, entity) => (
    { Error: `Some of the arguments passed to ${action} the ${entity} may be invalid`}
);

const type = {
    JSON: 'application/json',
    HTML: 'text/html',
};

const handlers = {};

[
    '/',
    '/index', // Alias of '/'
    '/login',
    '/create-account',
    '/profile',
    '/write-post',
    '/notifications',
    '/write-reply',
    '/read-post',
    '/read-reply',
    '/logout',
    '/delete-account',
    '/test-elements',
    '/logo',
    
    /*
        'api/apis',
        'api/posts',
        'api/users/:user-id',
        'api/users/:user-id/tokens/:token-id',
        'api/users/:user-id/posts',
        'api/users/:user-id/posts/:post-id',
        'api/users/:user-id/posts/:post-id/replies',
        'api/users/:user-id/posts/:post-id/replies/:reply-id',
        'api/users/:user-id/notifications',
        'api/users/:user-id/notifications/:notification-id',
    */

    '/api/apis',
    '/api/posts',
    '/api/user',
    '/api/user/token',
    '/api/user/posts',
    '/api/user/post',
    '/api/user/post/replies',
    '/api/user/post/reply',
    '/api/user/notifications',
    '/api/user/notification',

].forEach(path => {
    handlers[path] = async function(req_data) 
    {
        let res = null;
        if (this[path][req_data.method]) 
        {
            try {
                // Page handlers aren't asynchronous, while APIs are. 
                // Using async for both isn't an issue.
                res = await this[path][req_data.method](req_data);
            } catch (error) {
                log_error(error);
                res = new Res(500, ERR_CUSTOM('An unexpected error has occurred while routing the request'), 
                    type.JSON
                );
            }
        } else {
            res = new Res(405, ERR_INVALID_METHOD(req_data.method, req_data.path), type.JSON);
        }

        return res;
    }
});

handlers['/'].GET = 
handlers['/index'].GET = async function(req_data)
{
    const { page, fs_error } = await get_page('index');

    if (fs_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (auth_error.code === 500) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    const { count, db_error } = db_ops.count_posts();
    const last_page = (db_error || count < 1) ? 1 : Math.ceil(count/PAGE_SIZE);

    const { data: posts, db_error: posts_error } = db_ops.select_posts_page();

    let post_cards;
    if (posts_error) post_cards = DOMElements['.info-msg'](ERR_INVALID_DB_QUERY('get', 'posts'));
    else if (posts.length === 0) post_cards = DOMElements['.info-msg']('There aren\'t posts.');
    else post_cards = posts.map(post => DOMElements['.post-card'](post, 2, true)).join('');

    const res = page
        .replace('{{ post-cards }}', post_cards)
        .replaceAll('{{ last-page }}', last_page)
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](user_id, 'index'))
    ;

    return new Res(200, res, type.HTML);
};

handlers['/profile'].GET = async function(req_data)
{
    const { page, fs_error } = await get_page('profile');

    if (fs_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        // Even though there isn't the user_id, not necessarily is a 401. 
        // So, better to pass the status code
        return new Res(auth_error.code, fallback_page(auth_error.code), type.HTML);
    }

    const { count, db_error } = db_ops.count_user_posts(user_id);
    const last_page = (db_error || count < 1) ? 1 : Math.ceil(count/PAGE_SIZE);

    const { 
        data: posts, 
        db_error: posts_error, 
    } = db_ops.select_user_posts_page(user_id);    

    let post_cards = [];
    let info_msg = '';

    if (posts_error) {
        info_msg = DOMElements['.info-msg'](ERR_INVALID_DB_QUERY('get', 'posts'));
    } else if (posts.length === 0) {
        info_msg = DOMElements['.info-msg']('You didn\'t create any post yet.');
    } else {
        post_cards = posts.map(post => DOMElements['.post-card'](post, 1, true));
    }

    const res = page
        .replace('{{ .profile-picture }}', DOMElements['.profile-picture'](50, 300))
        .replace('{{ post-cards }}', post_cards.length > 0 ? post_cards.join('') : info_msg)
        .replace('{{ display-filter }}', last_page > 1 ? '' : 'display: none;')
        .replaceAll('{{ last-page }}', last_page)
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'profile'))
    ;

    return new Res(200, res, type.HTML);
};

handlers['/notifications'].GET = async function(req_data)
{
    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        return new Res(auth_error.code, fallback_page(auth_error.code), type.HTML);
    }

    const { page, fs_error } = await get_page('notifications');

    if (fs_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    const { count, db_error } = db_ops.count_user_notifications(user_id);
    const last_page = (db_error || count < 1) ? 1 : Math.ceil(count/PAGE_SIZE);

    const { 
        data: notifications, 
        db_error: notifications_error,
    } = db_ops.select_user_notifications_page(user_id);

    if (notifications_error) {
        return new Res(500, fallback_page(500, ERR_INVALID_DB_QUERY('get', 'notifications')), type.HTML);
    }

    let notification_cards = [];
    let info_msg = '';

    if (notifications.length === 0) {
        info_msg = DOMElements['.info-msg']('You don\'t have any notification :)');
    } else {
        notification_cards = new Array(notifications.length);
        notifications.forEach(notification => {
            const { data: post, db_error } = db_ops.select_post(notification.post_id)
            if (!db_error) {
                notification.post_content = post.content;
                notification_cards.push(DOMElements['.notification-card'](notification));
            }
        });
    }

    const res = page
        .replace('{{ notification-cards }}', notification_cards.length > 0 ? notification_cards.join('') : info_msg)
        .replace('{{ display-filter }}', last_page > 1 ? '' : 'display: none;')
        .replaceAll('{{ last-page }}', last_page)
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'notifications'))
    ;

    return new Res(200, res, type.HTML);
};

handlers['/create-account'].GET = async function(req_data)
{
    const { page, fs_error } = await get_page('create-account');

    if (fs_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    const res = page
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](false, 'create-account'))
    ;

    return new Res(200, res, type.HTML);
};

handlers['/login'].GET = async function(req_data)
{
    const { page, fs_error } = await get_page('login');

    if (fs_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    const res = page
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](false, 'login'))
    ;

    return new Res(200, res, type.HTML);
};

handlers['/write-post'].GET = async function(req_data)
{
    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        return new Res(auth_error.code, fallback_page(auth_error.code), type.HTML);
    }

    const { page, fs_error } = await get_page('write-post');

    if (fs_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    const res = page
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'write-post'))
    ;

    return new Res(200, res, type.HTML);
};

handlers['/write-reply'].GET = async function(req_data)
{
    const { page, fs_error } = await get_page('write-reply');

    if (fs_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    const post_id = parseInt(req_data.search_params.get('id'));

    if (!post_id) {
        return new Res(400, fallback_page(400, ERR_INVALID_SEARCH_PARAM('id')), type.HTML);
    }

    const { data: post, db_error } = db_ops.select_post(post_id);

    if (db_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    if (!post) {
        return new Res(404, fallback_page(404, 'The post you requested doesn\'t exists'), type.HTML);
    }

    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (auth_error.code === 500) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    const res = page
        .replace('{{ .post-card }}', DOMElements['.post-card'](post))
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](user_id, 'write-reply'))
    ;

    return new Res(200, res, type.HTML);
};

handlers['/read-reply'].GET = async function(req_data)
{
    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        return new Res(auth_error.code, fallback_page(auth_error.code), type.HTML);
    }

    const { page, fs_error } = await get_page('read-reply');

    if (fs_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    const reply_id = parseInt(req_data.search_params.get('id'));

    if (!reply_id) {
        return new Res(400, fallback_page(400, ERR_INVALID_SEARCH_PARAM('id')), type.HTML);
    }

    const { data: reply, db_error } = db_ops.select_reply(reply_id);

    if (db_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    if (!reply) {
        return new Res(404, fallback_page(404), type.HTML);
    }

    const { 
        data: post, 
        db_error: post_error 
    } = db_ops.select_post(reply.post_id);

    if (db_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    if (!post) {
        return new Res(404, fallback_page(404), type.HTML);
    }

    if (post.user_id !== user_id) {
        return new Res(401, fallback_page(401, 'Only the author of the post can read its replies'), type.HTML);
    }

    const res = page
        .replace('{{ post-id }}', post.id)
        .replace('{{ .reply-card }}', DOMElements['.reply-card'](reply))
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](user_id, 'read-post'))
    ;

    return new Res(200, res, type.HTML);
};

handlers['/read-post'].GET = async function(req_data)
{
    const { page, fs_error } = await get_page('read-post');

    if (fs_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    const post_id = parseInt(req_data.search_params.get('id'));

    /* NaN is considered a falsy value, therefore I can write 'if (!post_id)' */
    if (!post_id) {
        return new Res(400, fallback_page(400, ERR_INVALID_SEARCH_PARAM('id')), type.HTML);
    }

    const { data: post, db_error } = db_ops.select_post(post_id);

    if (db_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    if (!post) {
        return new Res(404, fallback_page(404), type.HTML);
    }

    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (auth_error.code === 500) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    let reply_cards = [];
    let info_msg = '';
    let last_page = 1;
    
    if (post.user_id === user_id)
    {
        const { count, db_error } = db_ops.count_post_replies(post_id);
        last_page = (db_error || count < 1) ? 1 : Math.ceil(count/PAGE_SIZE);
        
        const { 
            data: replies, 
            db_error: replies_error 
        } = db_ops.select_post_replies_page(post_id);

        if (replies_error) {
            info_msg = DOMElements['.info-msg'](ERR_INVALID_DB_QUERY('get', 'replies'));
        } else if (replies.length === 0) {
            info_msg = DOMElements['.info-msg']('There aren\'t replies.');
        } else {
            reply_cards = new Array(replies.length);
            reply_cards.push(...replies.map(reply => DOMElements['.reply-card'](reply, true)));
        }
    }

    const res = page
        .replace('{{ .post-card }}', DOMElements['.post-card'](post, user_id && post.user_id !== user_id ? 2 : 0))
        .replace('{{ replies }}', reply_cards.length > 0 ? reply_cards.join('') : info_msg)
        .replace('{{ display-filter }}', last_page > 1 && post.user_id === user_id ? '' : 'display: none;')
        .replaceAll('{{ last-page }}', last_page)
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](user_id, 'read-post'))
    ;

    return new Res(200, res, type.HTML);
};

handlers['/test-elements'].GET = async function(req_data)
{
    const { page, fs_error } = await get_page('test-elements');

    if (fs_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    const card = {
        id:'#',
        content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit",
        created_at: new Date().toLocaleString(),
    };

    const notif_card = {
        id: '#',
        post_id: '#',
        post_content: card.content,
        first_new_reply_id: '#',
        num_of_replies: 2,
    };

    const payload = page
        .replace('{{ .profile-picture }}', DOMElements['.profile-picture'](50, 300))
        .replace('{{ .post-card }}', DOMElements['.post-card'](card))
        .replace('{{ .reply-card }}', DOMElements['.reply-card'](card))
        .replace('{{ .notification-card }}', DOMElements['.notification-card'](notif_card))
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'test-elements'))
    ;

    return new Res(200, payload, type.HTML);
};

handlers['/logout'].GET = async function(req_data)
{
    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        return new Res(auth_error.code, fallback_page(auth_error.code), type.HTML);
    }

    const { page, fs_error } = await get_page('logout');

    if (fs_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    const payload = page.replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'logout'))

    return new Res(200, payload, type.HTML);
};

handlers['/delete-account'].GET = async function(req_data)
{
    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        return new Res(auth_error.code, fallback_page(auth_error.code), type.HTML);
    }

    const { page, fs_error } = await get_page('delete-account');

    if (fs_error) {
        return new Res(500, fallback_page(500), type.HTML);
    }

    const payload = page.replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'delete-account'));

    return new Res(200, payload, type.HTML);
};

handlers['/logo'].GET = async function(req_data)
{
    const { page, fs_error } = await get_page('logo');

    if (fs_error) {
        return new Res(500, fallback_page(500), type.HTML);
    } else {
        return new Res(200, page, type.HTML);
    }
};

handlers['/api/apis'].GET = function(req_data)
{
    return new Res(200, { 'Available APIs': Object.keys(handlers) }, type.JSON);
};

handlers['/api/user'].POST = function(req_data)
{
    const password = generate_password();

    /* I might check if an user with the generated password already exists,
    but, given that the probability of generating two times the same password
    in my life time is 0, I don't do it. 
    In the worst case, an error is reported while executing the query
    (the password_hash has to be unique).  */

    const { password_hash, hash_error } = hash_password(password, true);

    if (hash_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('create', 'password'), type.JSON);
    }

    const user_id = db_ops.insert_user(password_hash);

    if (!user_id) {
        return new Res(500, ERR_INVALID_DB_QUERY('insert', 'user'), type.JSON);
    } else {
        return new Res(200, { password }, type.JSON);
    }
};

handlers['/api/user'].DELETE = function(req_data)
{
    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        return new Res(auth_error.code, auth_error.msg, type.JSON);
    }

    const { is_data_deleted, db_error } = db_ops.delete_user(user_id);

    if (db_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('delete', 'user'), type.JSON);
    }

    if (!is_data_deleted) {
        return new Res(404, ERR_NOT_FOUND('user', 'user_id'), type.JSON);
    }

    return new Res(200, { Success: 'User delete successfully' }, type.JSON);
};

handlers['/api/user/token'].GET = function(req_data)
{
    const password = req_data.search_params.get('password');

    const { password_hash, hash_error } = hash_password(password);
    
    if (hash_error) {
        return new Res(400, ERR_INVALID_SEARCH_PARAM('password'), type.JSON);
    }

    const { data: user, db_error } = db_ops.select_user(password_hash);

    if (db_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('select', 'user'), type.JSON);
    }

    if (!user) {
        return new Res(404, ERR_NOT_FOUND('user', 'password'), type.JSON);
    }

    const { 
        data: token, 
        db_error: token_error, 
    } = db_ops.select_token(user.id);

    if (token_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('validate', 'token'), type.JSON);
    }

    if (token) {
        return new Res(200, token, type.JSON);
    } else {
        return new Res(404, ERR_NOT_FOUND('token', 'password'), type.JSON);
    }
};

handlers['/api/user/token'].POST = function(req_data)
{
    const { password } = req_data.payload;

    const { password_hash, hash_error } = hash_password(password);

    if (hash_error) {
        return new Res(400, ERR_INVALID_PAYLOAD_FIELD('password'), type.JSON);
    }

    const { data: user, db_error } = db_ops.select_user(password_hash);

    if (db_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('select', 'user'), type.JSON);
    }

    if (!user) {
        return new Res(404, ERR_NOT_FOUND('user', 'password'), type.JSON);
    }

    const { data: token, db_error: token_error } = db_ops.select_token(user.id);

    if (token_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('validate', 'token'), type.JSON);
    }

    if (token) {
        return new Res(400, ERR_CUSTOM('A token for that user already exists'), type.JSON);
    }

    const token_id = db_ops.insert_token(user.id);

    if (!token_id) {
        return new Res(500, ERR_INVALID_DB_QUERY('insert', 'token'), type.JSON);
    } else {
        return new Res(200, { password_hash }, type.JSON);
    }
};

handlers['/api/user/token'].PUT = function(req_data)
{
    const { password } = req_data.payload;
    
    const { password_hash, hash_error } = hash_password(password);
    
    if (hash_error) {
        return new Res(400, ERR_INVALID_PAYLOAD_FIELD('password'), type.JSON);
    }

    const { data: user, db_error} = db_ops.select_user(password_hash);

    if (db_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('select', 'user'), type.JSON);
    }

    if (!user) {
        return new Res(404, ERR_NOT_FOUND('user', 'password'), type.JSON);
    }

    const { data: token, db_error: token_error } = db_ops.select_token(user.id);

    if (token_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('select', 'token'), type.JSON);
    }

    if (!token) {
        return new Res(404, ERR_NOT_FOUND('token', 'user_id'), type.JSON);
    }

    const { is_token_updated, db_error: update_token_error } = db_ops.update_token(user.id);

    if (update_token_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('update', 'token'), type.JSON);
    }

    if (!is_token_updated) {
        return new Res(404, ERR_NOT_FOUND('token', 'user id'), type.JSON);
    }

    return new Res(200, { password_hash }, type.JSON);
};

handlers['/api/user/post'].GET = function(req_data)
{
    const post_id = parseInt(req_data.search_params.get('id'));

    if (!post_id) {
        return new Res(400, ERR_INVALID_SEARCH_PARAM('id'), type.JSON);
    }

    const { data: post, db_error } = db_ops.select_post(post_id);

    if (db_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('select', 'post'), type.JSON);
    }

    if (!post) {
        return new Res(404, ERR_NOT_FOUND('post', 'id'), type.JSON);
    }

    return new Res(200, post, type.JSON);
};

handlers['/api/user/post'].POST = function(req_data)
{
    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        return new Res(auth_error.code, auth_error.msg, type.JSON);
    }

    const { content } = req_data.payload;

    if (!content || typeof content !== 'string') {
        return new Res(400, ERR_INVALID_PAYLOAD_FIELD('content'), type.JSON);
    }

    const post_id = db_ops.insert_post(user_id, content);

    if (!post_id) {
        return new Res(500, ERR_INVALID_DB_QUERY('insert', 'post', type.JSON))
    } else {
        return new Res(200, { post_id }, type.JSON);
    }
};

handlers['/api/user/post'].DELETE = function(req_data)
{
    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        return new Res(auth_error.code, auth_error.msg, type.JSON);
    }

    const post_id = parseInt(req_data.search_params.get('id'));

    if (!post_id) {
        return new Res(400, ERR_INVALID_SEARCH_PARAM('id'), type.JSON);
    }

    const { is_data_deleted, db_error } = db_ops.delete_post(post_id, user_id);

    if (db_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('delete', 'post'), type.JSON);
    }

    if (!is_data_deleted) {
        return new Res(404, 
            ERR_CUSTOM("Either the post for the specified 'id' doesn't exist," + 
                "or you aren't the owner of that post"), 
            type.JSON);
    }

    return new Res(200, { Success: 'post deleted successfully' }, type.JSON);
};

handlers['/api/user/post/reply'].POST = function(req_data)
{
    const { post_id, content } = req_data.payload;

    if (!post_id) {
        return new Res(400, ERR_INVALID_PAYLOAD_FIELD('post_id'), type.JSON);
    }
    
    if (!content || typeof content !== 'string') {
        return new Res(400, ERR_INVALID_PAYLOAD_FIELD('content'), type.JSON);
    }

    const { data: post, db_error } = db_ops.select_post(post_id);

    if (db_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('select', 'post'), type.JSON);
    }

    if (!post) {
        return new Res(404, ERR_NOT_FOUND('post', 'id'), type.JSON);
    }

    const reply_id = db_ops.insert_reply(post_id, content);

    if (!reply_id) {
        return new Res(500, ERR_INVALID_DB_QUERY('insert', 'reply'), type.JSON);
    }

    const { 
        notification, 
        db_error: notification_error 
    } = db_ops.select_notification(post_id);

    if (notification_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('select', 'notification'), type.JSON);
    }

    /* If a post is popular, it may get tons of replies and so,
    if I architect the database to create a new notification for each reply,
    there would be a couple of problems:
    1) Huge notification feed
    2) Noisy notification feed

    So, to avoid it, I pile together the notifications for new replies about the same post.
    The consequence on the web interface is that, when the user clicks on a notification,
    it is brought to the first new reply received and can read all the new replies upwords. */

    if (!notification) {
        const notification_id = db_ops.insert_notification(post.user_id, post.id, reply_id);

        if (!notification_id) {
            return new Res(500, ERR_INVALID_DB_QUERY('insert', 'notification'), type.JSON);
        }
    } else {
        const { is_notification_updated, db_error } = db_ops.update_notification(post_id);
        if (db_error) {
            return new Res(500, ERR_INVALID_DB_QUERY('update', 'notification'), type.JSON);
        }
        if (!is_notification_updated) {
            return new Res(404, ERR_NOT_FOUND('notification', 'post_id'), type.JSON);
        }
    }

    return new Res(200, { reply_id }, type.JSON);
};

handlers['/api/user/notification'].DELETE = function(req_data)
{
    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        return new Res(auth_error.code, auth_error.msg, type.JSON);
    }

    const notification_id = parseInt(req_data.search_params.get('id'));

    if (!notification_id) {
        return new Res(400, ERR_INVALID_SEARCH_PARAM('id'), type.JSON);
    }

    const { 
        is_data_deleted, 
        db_error, 
    } = db_ops.delete_notification(notification_id, user_id);

    if (db_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('delete', 'notification'), type.JSON);
    }

    if (!is_data_deleted) {
        return new Res(404, 
            ERR_CUSTOM("Either the notification for the specified 'id' doesn't exist, " +
                "or you aren't the owner of that notification"), 
            type.JSON);
    }

    return new Res(200, { Success: 'notification deleted successfully' }, type.JSON);
};

handlers['/api/posts'].GET = function(req_data)
{
    const page = parseInt(req_data.search_params.get('page'));
    const format = req_data.search_params.get('format') || 'json';

    if (!page) {
        return new Res(400, ERR_INVALID_SEARCH_PARAM('page'), type.HTML);
    }

    /* In case of negative page (page < 1), the db returns the last page.
    It's a behavior not choosen by me, but I find it okay. */    

    if (!['json', 'html'].includes(format)) {
        return new Res(400, ERR_CUSTOM(`Invalid format option. Got '${format}'. Valid options are: json, html`), type.JSON);
    }

    const { data: posts, db_error } = db_ops.select_posts_page(page);

    if (db_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('get', 'posts'), type.JSON);
    } else {
        if (format === 'html') {
            const post_cards = posts.map(post => ({ 
                id: post.id, 
                card: DOMElements['.post-card'](post, 2, true),
            }));
            return new Res(200, post_cards, type.JSON);
        } else {
            return new Res(200, posts, type.JSON);
        }
    }
};

handlers['/api/user/post/replies'].GET = function(req_data)
{
    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        return new Res(auth_error.code, auth_error.msg, type.JSON);
    } 

    const post_id = parseInt(req_data.search_params.get('post_id'));
    const page = parseInt(req_data.search_params.get('page'));
    const format = req_data.search_params.get('format') || 'json';

    if (!post_id) {
        return new Res(400, ERR_INVALID_SEARCH_PARAM('post_id'), type.JSON);
    }

    if (!page) {
        return new Res(400, ERR_INVALID_SEARCH_PARAM('page'), type.JSON);
    }

    if (!['json', 'html'].includes(format)) {
        return new Res(400, ERR_CUSTOM(`Invalid format option. Got '${format}'. Valid options are: json, html`), type.JSON);
    }

    const { data: post, db_error } = db_ops.select_post(post_id);

    if (db_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('get', 'post'), type.JSON);
    }

    if (!post) {
        return new Res(404, ERR_NOT_FOUND('post', 'id'), type.JSON);
    }
    
    if (post.user_id !== user_id) {
        return new Res(401, 'Only the author of the post can read the replies', type.JSON);
    }

    const { data: replies, db_error: replies_error } = db_ops.select_post_replies_page(post_id, page);

    if (replies_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('retrieve', 'replies'), type.JSON);
    } else {
        if (format === 'html') {
            const reply_cards = replies.map(reply => ({ 
                id: reply.id, 
                card: DOMElements['.reply-card'](reply, true)
            }));
            return new Res(200, reply_cards, type.JSON);
        } else {
            return new Res(200, replies, type.JSON);
        }
    }
};

handlers['/api/user/posts'].GET = function(req_data)
{
    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        return new Res(auth_error.code, auth_error.msg, type.JSON);
    }

    const page = parseInt(req_data.search_params.get('page'));
    const match = req_data.search_params.get('match');
    const format = req_data.search_params.get('format') || 'json';

    if (!page && !match) {
        return new Res(400, ERR_INVALID_SEARCH_PARAM('page or match'), type.JSON);
    }

    if (!['json', 'html'].includes(format)) {
        return new Res(400, ERR_CUSTOM(`Invalid format option. Got '${format}'. Valid options are: json, html`), type.JSON);
    }

    let db_res = null;
    if (page) {
        db_res = db_ops.select_user_posts_page(user_id, page);
    } else {
        db_res = db_ops.select_user_posts_match(user_id, match);
    }

    if (db_res.db_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('get', 'user posts'), type.JSON);
    } else {
        if (format === 'html') {
            const post_cards = db_res.data.map(post => ({ 
                id: post.id, 
                card: DOMElements['.post-card'](post, 1, true)
            }));
            return new Res(200, post_cards, type.JSON);
        } else {
            return new Res(200, db_res.data, type.JSON);
        }
    }
};

handlers['/api/user/notifications'].GET = function(req_data)
{
    const { user_id, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        return new Res(auth_error.code, auth_error.msg, type.JSON);
    }

    const page = parseInt(req_data.search_params.get('page'));
    const match = req_data.search_params.get('match');
    const format = req_data.search_params.get('format') || 'json';
    
    if (!page && !match) {
        return new Res(400, ERR_INVALID_SEARCH_PARAM('page or match'), type.JSON);
    }

    if (!['json', 'html'].includes(format)) {
        return new Res(400, 
            ERR_CUSTOM(`Invalid format option. Got '${format}'. Valid options are: json, html`), 
            type.JSON
        );
    }

    let db_res = null;
    if (page) {
        db_res = db_ops.select_user_notifications_page(user_id, page);
    } else {
        db_res = db_ops.select_user_notifications_match(user_id, match);
    }

    if (db_res.db_error) {
        return new Res(500, ERR_INVALID_DB_QUERY('retrieve', 'user notifications'), type.JSON);
    }

    if (format === 'html') {
        const notification_cards = db_res.data.map(notification => ({ 
            id: notification.id, 
            card: DOMElements['.notification-card'](notification)
        }));
        return new Res(200, notification_cards, type.JSON);
    } else {
        return new Res(200, db_res.data, type.JSON);
    }
};

async function get_asset(req_data)
{
    /* 'get_asset' is called as the last resort in case none of the previous ones matched the requested path.
    So, not necessarily the request was made to get an asset. */

    const asset_path = path.join(WEB_INTERFACE_PATH, req_data.path);
    const file_ext = path.extname(asset_path).replace('.', '');

    if (file_ext && req_data.method !== 'GET') {
        return new Res(405, ERR_INVALID_METHOD(req_data.method, req_data.path), type.JSON);
    }

    const MIME_types = {
        css:  'text/css',
        js:   'text/javascript',
        mjs:  'text/javascript',
        json: type.JSON,
        svg:  'image/svg+xml',
        webp: 'image/webp',
        ttf:  'font/ttf',
    };

    const essence = MIME_types[file_ext];

    if (file_ext && !essence) {
        console.error(`ERROR: Unhandled file extension '${file_ext}'. ` +
            `Path: '${asset_path}'.`);
    }

    const { 
        file_content: asset, 
        fs_error 
    } = await read_file(asset_path, essence === 'font/ttf' ? null : 'utf8');

    let res = null;
    if (fs_error) {
        if (fs_error.code === 'ENOENT') {
            res = new Res(404, ERR_CUSTOM(`The path '${asset_path}' doesn't exist`), type.JSON);
        } else if (fs_error.code === 'EISDIR') {
            res = new Res(400, ERR_CUSTOM(`'${asset_path}' is a directory`), type.JSON);
        } else {
            log_error(fs_error);
            res = new Res(500, ERR_CUSTOM(`Un unknown error has occured while trying to read '${asset_path}' from disk`), type.JSON);
        }
    } else {
        res = new Res(200, asset, essence, type.JSON);
    }

    return res;
}

function auth_user(cookies)
{
    /* The auth_error msg is meant for the backend APIs, not for the request of web pages,
    because for the latter the err messages are framed a bit differently for the final user. */

    const res = {
        user_id: null,
        auth_error: {
            code: -1,
            msg: ''
        },
    };

    if (!cookies || !cookies.password_hash) {
        res.auth_error.code = 401;
        res.auth_error.msg = ERR_INVALID_COOKIE('password_hash');
        return res;
    }

    const { data: user, db_error } = db_ops.select_user(cookies.password_hash);

    if (db_error) {
        res.auth_error.code = 500;
        res.auth_error.msg = ERR_INVALID_DB_QUERY('select', 'user');
        return res;
    }

    if (!user) {
        res.auth_error.code = 404;
        res.auth_error.msg = ERR_NOT_FOUND('user', 'password');
        return res;
    }

    const { data: token, db_error: token_error } = db_ops.select_token(user.id);

    if (token_error) {
        res.auth_error.code = 500;
        res.auth_error.msg = ERR_INVALID_DB_QUERY('validate', 'token');
    } else if (!token) {
        res.auth_error.code = 401;
        res.auth_error.msg = `Invalid 'password_hash'. It may be expired`;
    } else if (token.expires_at > new Date().toISOString()) {
        res.user_id = token.user_id;
    }

    return res;
}

async function get_page(page_name)
{
    // Only for production, otherwise isn't possible to update a page during development
    if (env.NODE_ENV === 'production' && cached_pages.has(page_name)) {
        return { 
            page: cached_pages.get(page_name), 
            fs_error: null 
        };
    }

    const { 
        file_content: page, 
        fs_error 
    } = await read_file(path.join(WEB_INTERFACE_PATH, `${page_name}.html`), 'utf8', true);

    if (page && env.NODE_ENV === 'production') {
        cached_pages.set(page_name, page);
    }

    return { page, fs_error };
}

export {
    handlers,
    get_asset,
};
