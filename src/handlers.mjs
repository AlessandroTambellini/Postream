import * as path from "node:path";

import { DEFAULT_PAGE_SIZE, db_ops } from "./database.mjs";
import { hash_password, generate_password, log_error, env, read_file } from './utils.js';
import { DOMElements, fallback_page } from "./templates.mjs";
import assert from "node:assert";

const WEB_INTERFACE_PATH = path.join(import.meta.dirname, 'web_interface');
const MAX_ENTITIES_PER_PAGE = 100;
const cached_templates = new Map();

const APOLOGY_MSG = (entity) => (
    `Sorry, but for an unknown reason, the server isn't able to retrieve the ${entity} :(`
);
const MSG_INVALID_METHOD = (method, path) => (
    `The method '${method}' isn't allowed for path '${path}'`
);
const MSG_INVALID_SEARCH_PARAM = (header_name) => (
    `Missing or invalid '${header_name}' search param`
);
const MSG_INVALID_COOKIE = (cookie_name) => (
    `Missing or invalid '${cookie_name}' cookie`
);
const MSG_INVALID_PAYLOAD_FIELD = (field_name) => (
    `Missing or invalid '${field_name}' field`
);
const MSG_NOT_FOUND = (entity, field) => (
    `No ${entity} for the specified '${field}'`
);
const MSG_UNKNOWN_DB_ERROR = (action, entity) => (
    `Un unknown database error has occured while trying to ${action} the ${entity}`
);

const handlers = {};

[
    '/',
    '/index', // Alias
    '/login',
    '/create-account',
    '/profile',
    '/write-post',
    '/notifications',
    '/write-reply',
    '/read-post',
    '/logout',
    '/delete-account',
    '/test-elements',
    '/logo',
    '/api/apis',
    '/api/user',
    '/api/token',
    '/api/post',
    '/api/reply',
    '/api/posts/page',
    '/api/user/notifications',
    '/api/posts/user/page',
    '/api/notifications/user/page',
    '/api/posts/user/search',
    '/api/notifications/user/search',

].forEach(path => {
    handlers[path] = async function(req_data, res_data) {
        if (this[path][req_data.method]) {
            // The page handlers aren't asynchronous.
            // Still, using async also for them doesn't create an issue.
            await this[path][req_data.method](req_data, res_data);
        } else {
            res_data.error(405, MSG_INVALID_METHOD(req_data.method, req_data.path));
        }
    }
});

handlers['/'].GET = 
handlers['/index'].GET = async function(req_data, res_data)
{
    const { page_template, fs_error } = await get_page_template('index');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const { user_id, status_code } = auth_user(req_data.cookies);

    if (status_code === 500) {
        res_data.page(status_code, fallback_page(status_code));
        return;
    }

    const { posts, db_error } = db_ops.select_posts_page(1, 'desc');

    const post_cards = db_error ?
        DOMElements['.info-msg'](APOLOGY_MSG('posts')) :
        posts.map(post => DOMElements['.post-card'](post, 2, true)).join('');

    const page = page_template
        .replace('{{ post-cards }}', post_cards)
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](user_id, 'index'))
    ;

    res_data.page(200, page);
};

handlers['/create-account'].GET = async function(req_data, res_data)
{
    const { page_template, fs_error } = await get_page_template('create-account');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const page = page_template
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](false, 'create-account'))
    ;

    res_data.page(200, page);
};

handlers['/login'].GET = async function(req_data, res_data)
{
    const { page_template, fs_error } = await get_page_template('login');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const page = page_template
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](false, 'login'))
    ;

    res_data.page(200, page);
};

handlers['/profile'].GET = async function(req_data, res_data)
{
    const { page_template, fs_error } = await get_page_template('profile');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id) {
        // Even though there isn't the user_id, not necessarily is a 401. 
        // So, better to pass the status code
        res_data.page(status_code, fallback_page(status_code));
        return;
    }

    const { count, db_error } = db_ops.select_user_posts_count(user_id);
    const pages = (db_error || count < 1) ? 1 : Math.ceil(count/DEFAULT_PAGE_SIZE);

    const { posts, db_error: posts_error } = db_ops.select_user_posts_page(user_id, 1);

    let post_cards;

    if (posts_error) post_cards = DOMElements['.info-msg'](APOLOGY_MSG('posts'));
    else if (posts.length === 0) post_cards = DOMElements['.info-msg']('You didn\'t create any post yet.');
    else post_cards = posts.map(post => DOMElements['.post-card'](post, 1, true)).join('');

    const page = page_template
        .replace('{{ .profile-picture }}', DOMElements['.profile-picture'](50, 300))
        .replace('{{ post-cards }}', post_cards)
        .replaceAll('{{ tot-pages }}', pages)
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'profile'))
    ;

    res_data.page(200, page);
};

handlers['/notifications'].GET = async function(req_data, res_data)
{
    const { page_template, fs_error } = await get_page_template('notifications');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id) {
        res_data.page(status_code, fallback_page(status_code));
        return;
    }

    const { count, db_error } = db_ops.select_user_notifications_count(user_id);
    const pages = (db_error || count < 1) ? 1 : Math.ceil(count/DEFAULT_PAGE_SIZE);

    const { notifications, db_error: notifications_error } = db_ops.select_user_notifications_page(user_id, 1);

    if (notifications_error) {
        res_data.page(500, fallback_page(500, APOLOGY_MSG('notifications')));
        return;
    }

    let notification_cards;

    if (notifications_error) notification_cards = DOMElements['.info-msg'](APOLOGY_MSG('notifications'));
    else if (notifications.length === 0) notification_cards = DOMElements['.info-msg']('You don\'t have any notification :)');
    else {
        notification_cards = new Array(notifications.length);
        notifications.forEach(notification => {
            const { post, db_error } = db_ops.select_post(notification.post_id)
            if (!db_error) {
                notification.post_content = post.content;
                notification_cards.push(DOMElements['.notification-card'](notification));
            }
        });

        notification_cards = notification_cards.join('');
    }

    const page = page_template
        .replace('{{ notification-cards }}', notification_cards)
        .replaceAll('{{ tot-pages }}', pages)
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'notifications'))
    ;

    res_data.page(200, page);
};

handlers['/write-post'].GET = async function(req_data, res_data)
{
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id) {
        res_data.page(status_code, fallback_page(status_code));
        return;
    }

    const { page_template, fs_error } = await get_page_template('write-post');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const page = page_template
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'write-post'))
    ;

    res_data.page(200, page);
};

handlers['/write-reply'].GET = async function(req_data, res_data)
{
    const { page_template, fs_error } = await get_page_template('write-reply');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const post_id = req_data.search_params.get('id');
    const { post, db_error } = db_ops.select_post(post_id);

    if (db_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    if (!post) {
        res_data.page(404, fallback_page(404, 'The post you requested doesn\'t exists'));
        return;
    }

    const page = page_template
        .replace('{{ .post-card }}', DOMElements['.post-card'](post))
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'write-reply'))
    ;

    res_data.page(200, page);
};

handlers['/read-post'].GET = async function(req_data, res_data)
{
    const { page_template, fs_error } = await get_page_template('read-post');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const post_id = req_data.search_params.get('id');
    const { post, db_error } = db_ops.select_post(post_id);
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (db_error || status_code === 500) {
        res_data.page(500, fallback_page(500));
        return;
    }

    if (!post) {
        res_data.page(404, fallback_page(404));
        return;
    }

    const reply_cards = [];
    if (post.user_id === user_id)
    {
        const { replies, db_error } = db_ops.select_post_replies(post_id);

        if (db_error) {
            reply_cards.push(DOMElements['.info-msg'](APOLOGY_MSG('replies')));
        } else {
            reply_cards.push(...replies.map(reply => DOMElements['.reply-card'](reply)));
        }
    }

    const page = page_template
        .replace('{{ .post-card }}', DOMElements['.post-card'](post, user_id && post.user_id !== user_id ? 2 : 0))
        .replace('{{ replies }}', reply_cards.join(''))
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](user_id, 'read-post'))
    ;

    res_data.page(200, page);
};

handlers['/test-elements'].GET = async function(req_data, res_data)
{
    const { page_template, fs_error } = await get_page_template('test-elements');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
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

    const page = page_template
        .replace('{{ .profile-picture }}', DOMElements['.profile-picture'](50, 300))
        .replace('{{ .post-card }}', DOMElements['.post-card'](card))
        .replace('{{ .reply-card }}', DOMElements['.reply-card'](card))
        .replace('{{ .notification-card }}', DOMElements['.notification-card'](notif_card))
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'test-elements'))
    ;

    res_data.page(200, page);
};

handlers['/logout'].GET = async function(req_data, res_data)
{
    /* Why should I auth an user before logging him out?
    Logging out means deleting a cookie. Delete it if you want.
    TODO review this comment */

    const { page_template, fs_error } = await get_page_template('logout');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const page = page_template
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'logout'))
    ;

    res_data.page(200, page);
};

handlers['/delete-account'].GET = async function(req_data, res_data)
{
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id) {
        res_data.page(status_code, fallback_page(status_code));
        return;
    }

    const { page_template, fs_error } = await get_page_template('delete-account');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const page = page_template
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'delete-account'))
    ;

    res_data.page(200, page);
};

handlers['/logo'].GET = async function(req_data, res_data)
{
    const { page_template, fs_error } = await get_page_template('logo');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
    } else {
        res_data.page(200, page_template);
    }
};

handlers['/api/apis'].GET = function(req_data, res_data)
{
    res_data.success(200, { 'Available APIs': Object.keys(APIs) });
};

handlers['/api/user'].POST = function(req_data, res_data)
{
    const password = generate_password();

    /* I might check if an user with the generated password already exists,
    but, given that the probability of generating two times the same password
    in my life time is 0, I don't do it. 
    In the worst case, an error is reported while executing the query
    (the password_hash has to be unique).  */

    const { password_hash, hash_error } = hash_password(password, true);

    if (hash_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('create', 'password'));
        return;
    }

    const user_id = db_ops.insert_user(password_hash);

    if (!user_id) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('insert', 'user'));
    } else {
        res_data.success(200, { password });
    }
};

handlers['/api/user'].DELETE = function(req_data, res_data)
{
    const { user_id, status_code, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        res_data.error(status_code, auth_error);
        return;
    }

    const { is_user_deleted, db_error } = db_ops.delete_user(user_id);

    if (db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('delete', 'user'));
        return;
    }

    if (!is_user_deleted) {
        res_data.error(404, MSG_NOT_FOUND('user', 'user_id'));
        return;
    }

    res_data.success(200);
};

handlers['/api/token'].GET = function(req_data, res_data)
{
    const password = req_data.search_params.get('password');

    const { password_hash, hash_error } = hash_password(password);
    
    if (hash_error) {
        res_data.error(400, MSG_INVALID_SEARCH_PARAM('password'));
        return;
    }

    const { user, db_error } = db_ops.select_user(password_hash);

    if (db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('select', 'user'));
        return;
    }

    if (!user) {
        res_data.error(404, MSG_NOT_FOUND('user', 'password'));
        return;
    }

    const { token, db_error: token_error } = db_ops.select_token(user.id);

    if (token_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('validate', 'token'));
        return;
    }

    if (token) {
        res_data.success(200, token);
    } else {
        res_data.error(404, MSG_NOT_FOUND('token', 'password'));
    }
};

handlers['/api/token'].POST = function(req_data, res_data)
{
    const { password } = req_data.payload;

    const { password_hash, hash_error } = hash_password(password);

    if (hash_error) {
        res_data.error(400, MSG_INVALID_PAYLOAD_FIELD('password'));
        return;
    }

    const { user, db_error } = db_ops.select_user(password_hash);

    if (db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('select', 'user'));
        return;
    }

    if (!user) {
        res_data.error(404, MSG_NOT_FOUND('user', 'password'));
        return;
    }

    const { token, db_error: token_error } = db_ops.select_token(user.id);

    if (token_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('validate', 'token'));
        return;
    }

    if (token) {
        res_data.error(400, 'A token for that user already exists');
        return;
    }

    const token_id = db_ops.insert_token(user.id);

    if (!token_id) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('insert', 'token'));
    } else {
        res_data.success(200, { password_hash });
    }
};

handlers['/api/token'].PUT = function(req_data, res_data)
{
    const { password } = req_data.payload;
    
    const { password_hash, hash_error } = hash_password(password);
    
    if (hash_error) {
        res_data.error(400, MSG_INVALID_PAYLOAD_FIELD('password'));
        return;
    }

    const { user, db_error} = db_ops.select_user(password_hash);

    if (db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('select', 'user'));
        return;
    }

    if (!user) {
        res_data.error(404, MSG_NOT_FOUND('user', 'password'));
        return;
    }

    const { token, db_error: token_error } = db_ops.select_token(user.id);

    if (token_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('select', 'token'));
        return;
    }

    if (!token) {
        res_data.error(404, MSG_NOT_FOUND('token', 'user_id'));
        return;
    }

    const { is_token_updated, db_error: update_token_error } = db_ops.update_token(user.id);

    if (update_token_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('update', 'token'));
        return;
    }

    if (!is_token_updated) {
        res_data.error(404, MSG_NOT_FOUND('token', 'user id'));
        return;
    }

    res_data.success(200, { password_hash });
};

handlers['/api/post'].GET = function(req_data, res_data)
{
    const post_id = req_data.search_params.get('id');

    if (!post_id) {
        res_data.error(400, MSG_INVALID_SEARCH_PARAM('id'));
        return;
    }

    const { post, db_error } = db_ops.select_post(post_id);

    if (db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('select', 'post'));
        return;
    }

    if (!post) {
        res_data.error(404, MSG_NOT_FOUND('post', 'id'));
        return;
    }

    res_data.success(200, post);
};

handlers['/api/post'].POST = function(req_data, res_data)
{
    const { user_id, status_code, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        res_data.error(status_code, auth_error);
        return;
    }

    const { content } = req_data.payload;

    if (!content || typeof content !== 'string') {
        res_data.error(400, MSG_INVALID_PAYLOAD_FIELD('content'));
        return;
    }

    const post_id = db_ops.insert_post(user_id, content);

    if (!post_id) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('insert', 'post'))
    } else {
        res_data.success(200, { post_id });
    }
};

handlers['/api/post'].DELETE = function(req_data, res_data)
{
    const { user_id, status_code, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        res_data.error(status_code, auth_error);
        return;
    }

    const post_id = req_data.search_params.get('id');

    if (!post_id) {
        res_data.error(400, MSG_INVALID_SEARCH_PARAM('id'));
        return;
    }

    const { is_post_deleted, db_error } = db_ops.delete_post(post_id, user_id);

    if (db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('delete', 'post'));
        return;
    }

    if (!is_post_deleted) {
        res_data.error(404,  `Either the post for the specified 'id' doesn't exist, or you aren't the owner of that post`);
        return;
    }

    res_data.success(200);
};

handlers['/api/reply'].POST = function(req_data, res_data)
{
    const { post_id, content } = req_data.payload;

    if (!post_id) {
        res_data.error(400, MSG_INVALID_PAYLOAD_FIELD('post_id'));
        return;
    }

    if (!content || typeof content !== 'string') {
        res_data.error(400, MSG_INVALID_PAYLOAD_FIELD('content'));
        return;
    }

    const { post, db_error } = db_ops.select_post(post_id);

    if (db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('select', 'post'));
        return;
    }

    if (!post) {
        res_data.error(404, MSG_NOT_FOUND('post', 'id'));
        return;
    }

    const reply_id = db_ops.insert_reply(post_id, content);

    if (!reply_id) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('insert', 'reply'));
        return;
    }

    const { notification, db_error: notif_db_error } = db_ops.select_notification(post_id);

    if (notif_db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('select', 'notification'));
        return;
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
            res_data.error(500, MSG_UNKNOWN_DB_ERROR('insert', 'notification'));
            return;
        }
    } else {
        const { is_notification_updated, db_error } = db_ops.update_notification(post_id);
        if (db_error) {
            res_data.error(500, MSG_UNKNOWN_DB_ERROR('update', 'notification'));
            return;
        }
        if (!is_notification_updated) {
            res_data.error(404, MSG_NOT_FOUND('notification', 'post_id'));
            return;
        }
    }

    res_data.success(200, { reply_id });
};

handlers['/api/user/notifications'].DELETE = function(req_data, res_data)
{
    const { user_id, status_code, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        res_data.error(status_code, auth_error);
        return;
    }

    const notification_id = req_data.search_params.get('id');

    if (!notification_id) {
        res_data.error(400, MSG_INVALID_SEARCH_PARAM('id'));
        return;
    }

    const { is_notification_deleted, db_error } = db_ops.delete_notification(notification_id, user_id);

    if (db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('delete', 'notification'));
        return;
    }

    if (!is_notification_deleted) {
        res_data.error(404,  `Either the notification for the specified 'id' doesn't exist, or you aren't the owner of that notification`);
        return;
    }

    res_data.success(200);
};

handlers['/api/posts/page'].GET = function(req_data, res_data)
{
    const page = parseInt(req_data.search_params.get('page')) || 1;
    const limit = parseInt(req_data.search_params.get('limit')) || DEFAULT_PAGE_SIZE;
    const sort = req_data.search_params.get('sort') || 'desc';
    // TOTHINK Probably I'm going to remove the format choice
    const format = req_data.search_params.get('format') || 'json';

    if (page < 1) {
        res_data.error(400, `Page must be >= 1. Got ${page} instead`);
        return;
    }

    if (limit < 1 || limit > MAX_ENTITIES_PER_PAGE) {
        res_data.error(400, `Limit must be in range 1-${MAX_ENTITIES_PER_PAGE}. Got ${limit} instead`);
        return;
    }

    const sorting_options = ['desc', 'asc', 'rand'];
    if (!sorting_options.includes(sort)) {
        res_data.error(400, `Invalid sorting option. Got '${sort}'. Valid options are ${sorting_options}`);
        return;
    }

    if (!['json', 'html'].includes(format)) {
        res_data.error(400, `Invalid format option. Got '${sort}'. Valid options are: json, html`);
        return;
    }

    const { posts, db_error } = db_ops.select_posts_page(page, sort, limit);

    if (db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('get', 'posts'));
    } else {
        if (format === 'html') {
            const post_cards = posts.map(post => DOMElements['.post-card'](post, 2, true)).join('');
            res_data.success(200, post_cards);
        } else {
            res_data.success(200, posts);
        }
    }
};

handlers['/api/notifications/user/page'].GET = function(req_data, res_data)
{
    const { user_id, status_code, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        res_data.error(status_code, auth_error);
        return;
    }

    const page = parseInt(req_data.search_params.get('page')) || 1;
    const limit = parseInt(req_data.search_params.get('limit')) || DEFAULT_PAGE_SIZE;

    if (page < 1) {
        res_data.error(400, `Page must be >= 1. Got ${page} instead`);
        return;
    }

    if (limit < 1 || limit > MAX_ENTITIES_PER_PAGE) {
        res_data.error(400, `Limit must be in range 1-${MAX_ENTITIES_PER_PAGE}. Got ${limit} instead`);
        return;
    }

    const { notifications, db_error } = db_ops.select_user_notifications_page(user_id, page, limit);

    if (db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('retrieve', 'user notifications'));
    } else {
        res_data.success(200, notifications);
    }
};

handlers['/api/posts/user/page'].GET = function(req_data, res_data)
{
    const { user_id, status_code, auth_error } = auth_user(req_data.cookies);

    if (!user_id) {
        res_data.error(status_code, auth_error);
        return;
    }

    const page = parseInt(req_data.search_params.get('page')) || 1;
    const limit = parseInt(req_data.search_params.get('limit')) || DEFAULT_PAGE_SIZE;

    if (page < 1) {
        res_data.error(400, `Page must be >= 1. Got ${page} instead`);
        return;
    }

    if (limit < 1 || limit > MAX_ENTITIES_PER_PAGE) {
        res_data.error(400, `Limit must be in range 1-${MAX_ENTITIES_PER_PAGE}. Got ${limit} instead`);
        return;
    }

    const { posts, db_error } = db_ops.select_user_posts_page(user_id, page, limit);

    if (db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('retrieve', 'user posts'));
    } else {
        res_data.success(200, posts);
    }
};

handlers['/api/posts/user/search'].GET = function(req_data, res_data)
{
    const { user_id, status_code, auth_error } = auth_user(req_data.cookies);
    
    if (!user_id) {
        res_data.error(status_code, auth_error);
        return;
    }

    const search_term = req_data.search_params.get('search_term');
    
    if (!search_term) {
        res_data.error(400, 'Missing search term');
        return;
    }

    const { posts, db_error } = db_ops.select_user_matching_posts(user_id, search_term);

    if (db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('get', 'matching posts'));
    } else {
        res_data.success(200, posts);
    }
};

handlers['/api/notifications/user/search'].GET = function(req_data, res_data)
{
    const { user_id, status_code, auth_error } = auth_user(req_data.cookies);
    
    if (!user_id) {
        res_data.error(status_code, auth_error);
        return;
    }

    const search_term = req_data.search_params.get('search_term');

    if (!search_term) {
        res_data.error(400, 'Missing search term');
        return;
    }

    const { notifications, db_error } = db_ops.select_user_matching_notifications(user_id, search_term);

    if (db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('get', 'matching notifications'));
    } else {
        res_data.success(200, notifications);
    }
};

async function get_asset(req_data, res_data)
{
    /* 'get_asset' is called as the last routing option in case none of the previous ones matched the requested path.
    So, not necessarily the request was made to get an asset. */

    const asset_path = path.join(WEB_INTERFACE_PATH, req_data.path);
    const file_ext = path.extname(asset_path).replace('.', '');

    if (file_ext && req_data.method !== 'GET') {
        res_data.error(405, MSG_INVALID_METHOD(req_data.method, req_data.path));
        return;
    }

    const MIME_types = {
        css:  'text/css',
        js:   'text/javascript',
        mjs:  'text/javascript',
        json: 'application/json',
        svg:  'image/svg+xml',
        webp: 'image/webp',
        ttf:  'font/ttf',
    };

    const essence = MIME_types[file_ext];

    if (file_ext && !essence) {
        console.error(`ERROR: Unhandled file extension '${file_ext}'. ` +
            `Path: '${asset_path}'.`);
    }

    const { file_content: asset, fs_error } = await read_file(asset_path, essence === 'font/ttf' ? null : 'utf8');

    if (fs_error) {
        if (fs_error.code === 'ENOENT') {
            res_data.error(404, `The path '${asset_path}' doesn't exist`);
        } else if (fs_error.code === 'EISDIR') {
            res_data.error(400, `'${asset_path}' is a directory`);
        } else {
            log_error(fs_error);
            res_data.error(500, `Un unknown error has occured while trying to read '${asset_path}' from disk`);
        }

        return;
    }

    res_data.success(200, asset, essence);
}


/*
 *
 *  Miscellaneous
 */

function auth_user(cookies)
{
    /* The auth_error msg is meant for the backend APIs, not for the request of web pages,
    because for the latter the err messages are framed a bit differently for the final user. */

    const res = {
        user_id: null,
        status_code: 200,
        auth_error: null,
    };

    if (!cookies || !cookies.password_hash) {
        res.status_code = 401;
        res.auth_error = MSG_INVALID_COOKIE('password_hash');
        return res;
    }

    const { user, db_error } = db_ops.select_user(cookies.password_hash);

    if (db_error) {
        res.status_code = 500;
        auth_error = MSG_UNKNOWN_DB_ERROR('select', 'user');
        return res;
    }

    if (!user) {
        res.status_code = 404;
        res.auth_error = MSG_NOT_FOUND('user', 'password');
        return res;
    }

    const { token, db_error: token_error } = db_ops.select_token(user.id);

    if (token_error) {
        res.status_code = 500;
        res.auth_error = MSG_UNKNOWN_DB_ERROR('validate', 'token');
    } else if (!token) {
        res.status_code = 401;
        res.auth_error = `Invalid 'password_hash'. It may be expired`;
    } else if (token.expires_at > new Date().toISOString()) {
        res.user_id = token.user_id;
    }

    // mutual exclusion    
    assert((res.user_id || res.auth_error) && !(res.user_id && res.auth_error));

    return res;
}

async function get_page_template(template_name)
{
    // Only for production, otherwise isn't possible to update a page during development
    if (env.NODE_ENV === 'production' && cached_templates.has(template_name)) {
        return { page_template: cached_templates.get(template_name), fs_error: null };
    }

    const template_path = path.join(WEB_INTERFACE_PATH, 'templates', `${template_name}.html`);

    const { file_content: page_template, fs_error } = await read_file(template_path, 'utf8', true);

    // TODO manage the error
    
    if (env.NODE_ENV === 'production' && page_template) {
        cached_templates.set(template_name, page_template);
    }

    return { page_template, fs_error };
}


export {
    handlers,
    get_asset,
};
