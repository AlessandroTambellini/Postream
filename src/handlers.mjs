import * as path from "node:path";

import { DEFAULT_PAGE_SIZE, db_ops } from "./database.mjs";
import { hash_password, generate_password, log_error, env, read_file } from './utils.js';
import { DOMElements, fallback_page } from "./templates.mjs";

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

handlers['/'].GET = async function(req_data, res_data)
{
    let { template: index_template, fs_error } = await read_template('index');

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

    const index_page = index_template
        .replace('{{ post-cards }}', post_cards)
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](user_id, 'index'))
    ;

    res_data.page(200, index_page);
};

handlers['/create-account'].GET = async function(req_data, res_data)
{
    let { template: create_account_template, fs_error } = await read_template('create-account');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const create_account_page = create_account_template
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](false, 'create-account'))
    ;

    res_data.page(200, create_account_page);
};

handlers['/login'].GET = async function(req_data, res_data)
{
    let { template: login_template, fs_error } = await read_template('login');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const login_page = login_template
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](false, 'login'))
    ;

    res_data.page(200, login_page);
};

handlers['/profile'].GET = async function(req_data, res_data)
{
    const { template: profile_template, fs_error } = await read_template('profile');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id) {
        res_data.page(status_code, fallback_page(status_code));
        return;
    }

    const PAGE_SIZE = 3;
    const { count, db_error } = db_ops.select_user_posts_count(user_id);
    const pages = (db_error || count < 1) ? 1 : Math.ceil(count/PAGE_SIZE);

    const { posts, db_error: posts_error } = db_ops.select_user_posts_page(user_id, 1, PAGE_SIZE);

    let post_cards;

    if (posts_error) post_cards = DOMElements['.info-msg'](APOLOGY_MSG('posts'));
    else if (posts.length === 0) post_cards = DOMElements['.info-msg']('You didn\'t create any post yet.');
    else post_cards = posts.map(post => DOMElements['.post-card'](post, 1, true)).join('');

    const profile_page = profile_template
        .replace('{{ .profile-picture }}', DOMElements['.profile-picture'](50, 300))
        .replace('{{ post-cards }}', post_cards)
        .replaceAll('{{ tot-pages }}', pages)
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'profile'))
    ;

    res_data.page(200, profile_page);
};

handlers['/notifications'].GET = async function(req_data, res_data)
{
    const { template: notifications_template, fs_error } = await read_template('notifications');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id) {
        res_data.page(status_code, fallback_page(status_code));
        return;
    }

    const PAGE_SIZE = 3;
    const { count, db_error } = db_ops.select_user_notifications_count(user_id);
    const pages = (db_error || count < 1) ? 1 : Math.ceil(count/PAGE_SIZE);

    const { notifications, db_error: notifications_error } = db_ops.select_user_notifications_page(user_id, 1, PAGE_SIZE);

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

    const notifications_page = notifications_template
        .replace('{{ notification-cards }}', notification_cards)
        .replaceAll('{{ tot-pages }}', pages)
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'notifications'))
    ;

    res_data.page(200, notifications_page);
};

handlers['/write-post'].GET = async function(req_data, res_data)
{
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id) {
        res_data.page(status_code, fallback_page(status_code));
        return;
    }

    const { template: write_post_template, fs_error } = await read_template('write-post');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const write_post_page = write_post_template
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'write-post'))
    ;

    res_data.page(200, write_post_page);
};

handlers['/write-reply'].GET = async function(req_data, res_data)
{
    const { template: write_reply_template, fs_error } = await read_template('write-reply');

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

    const write_reply_page = write_reply_template
        .replace('{{ .post-card }}', DOMElements['.post-card'](post))
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'write-reply'))
    ;

    res_data.page(200, write_reply_page);
};

handlers['/read-post'].GET = async function(req_data, res_data)
{
    let { template: post_template, fs_error } = await read_template('read-post');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const post_id = req_data.search_params.get('id');
    const { post, db_error } = db_ops.select_post(post_id);
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (db_error || status_code === 500)
    {
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

    const post_page = post_template
        .replace('{{ .post-card }}', DOMElements['.post-card'](post, user_id && post.user_id !== user_id ? 2 : 0))
        .replace('{{ replies }}', reply_cards.join(''))
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](user_id, 'read-post'))
    ;

    res_data.page(200, post_page);
};

handlers['/test-elements'].GET = async function(req_data, res_data)
{
    let { template: test_components_template, fs_error } = await read_template('test-elements');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const card = {
        id:'#',
        content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
        created_at: new Date().toLocaleString(),
    };

    const notif_card = {
        id: '#',
        post_id: '#',
        post_content: card.content,
        first_new_reply_id: '#',
        num_of_replies: 2,
    };

    const test_components_page = test_components_template
        .replace('{{ .profile-picture }}', DOMElements['.profile-picture'](50, 300))
        .replace('{{ .post-card }}', DOMElements['.post-card'](card))
        .replace('{{ .reply-card }}', DOMElements['.reply-card'](card))
        .replace('{{ .notification-card }}', DOMElements['.notification-card'](notif_card))
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'test-elements'))
    ;

    res_data.page(200, test_components_page);
};

handlers['/logout'].GET = async function(req_data, res_data)
{
    /* Why should I auth an user before logging him out?
    Logging out means deleting a cookie. Delete it if you want.
    TODO review this comment */

    const { template: logout_template, fs_error } = await read_template('logout');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const logout_page = logout_template
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'logout'))
    ;

    res_data.page(200, logout_page);
};

handlers['/delete-account'].GET = async function(req_data, res_data)
{
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (!user_id) {
        res_data.page(status_code, fallback_page(status_code));
        return;
    }

    const { template: delete_account_template, fs_error } = await read_template('delete-account');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
        return;
    }

    const delete_account_page = delete_account_template
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'delete-account'))
    ;

    res_data.page(200, delete_account_page);
};

handlers['/logo'].GET = async function(req_data, res_data)
{
    const { template: logo_page, fs_error } = await read_template('logo');

    if (fs_error) {
        res_data.page(500, fallback_page(500));
    } else {
        res_data.page(200, logo_page);
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
    in my life time is 0, I don't do it. */
    const password_hash = hash_password(password);

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

    if (auth_error) {
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

    if (!password || typeof password !== 'string') {
        res_data.error(400, MSG_INVALID_SEARCH_PARAM('password'));
        return;
    }

    const password_hash = hash_password(password);

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

    if (!password || typeof password !== 'string') {
        res_data.error(400, MSG_INVALID_PAYLOAD_FIELD('password'));
        return;
    }

    const password_hash = hash_password(password);

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

    if (!password || typeof password !== 'string') {
        res_data.error(400, MSG_INVALID_PAYLOAD_FIELD('password'));
        return;
    }

    const password_hash = hash_password(password);

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

    if (auth_error) {
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

    if (auth_error) {
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

    if (auth_error) {
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

    if (!['desc', 'asc', 'rand'].includes(sort)) {
        res_data.error(400, `Invalid sorting option. Got '${sort}'. Valid options are: asc, desc, rand`);
        return;
    }

    if (!['json', 'html'].includes(format)) {
        res_data.error(400, `Invalid format option. Got '${sort}'. Valid options are: json, html`);
        return;
    }

    const { posts, db_error } = db_ops.select_posts_page(page, sort, limit);
    // const { tot_num_of_posts, db_error } = db_ops.select_posts_count();

    if (db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('get', 'posts'));
    } else {
        if (format === 'html') {
            const post_cards = posts.map(post => DOMElements['.post-card'](post, 2, true)).join('');
            res_data.success(200, post_cards);
        } else {
            res_data.success(200, posts); // { posts, tot_num_of_posts }
        }
    }
};

handlers['/api/notifications/user/page'].GET = function(req_data, res_data)
{
    const { user_id, status_code, auth_error } = auth_user(req_data.cookies);

    if (auth_error) {
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

    notifications.forEach(notification => {
        const { post, db_error } = db_ops.select_post(notification.post_id);
        // TODO does it fail silently?
        if (!db_error) {
            notification.post_content = post.content;
        }
    });

    if (db_error) {
        res_data.error(500, MSG_UNKNOWN_DB_ERROR('retrieve', 'user notifications'));
    } else {
        res_data.success(200, notifications);
    }
};

handlers['/api/posts/user/page'].GET = function(req_data, res_data)
{
    const { user_id, status_code, auth_error } = auth_user(req_data.cookies);

    if (auth_error) {
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

    if (auth_error)
    {
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

async function get_asset(req_data, res_data)
{
    /* That's because 'get_asset' is called as the last routing option in case none of the previous ones matched the requested path.
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
    let user_id = null;
    let status_code = 200;
    let auth_error = null;

    if (!cookies || !cookies.password_hash) {
        auth_error = MSG_INVALID_COOKIE('password_hash');
        status_code = 401;
        return { user_id: null, status_code, auth_error };
    }

    const { user, db_error } = db_ops.select_user(cookies.password_hash);

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
        status_code = 500;
        auth_error = MSG_UNKNOWN_DB_ERROR('validate', 'token');
    } else if (!token) {
        status_code = 401;
        auth_error = `Invalid 'password_hash'. It may be expired`;
    } else if (token.expires_at > new Date().toISOString()) {
        user_id = token.user_id;
    }

    return { user_id, status_code, auth_error };
}

async function read_template(template_name)
{
    // Only for production, otherwise isn't possible to update a page during development
    if (env.NODE_ENV === 'production' && cached_templates.has(template_name)) {
        return { template: cached_templates.get(template_name), fs_error: null };
    }

    const template_path = path.join(WEB_INTERFACE_PATH, 'templates', `${template_name}.html`);

    const { file_content: template, fs_error } = await read_file(template_path);

    if (fs_error){
        // TODO what do I return to the user?
        log_error(fs_error);}

    if (env.NODE_ENV === 'production' && template) {
        cached_templates.set(template_name, template);
    }

    return { template, fs_error };
}


export {
    handlers,
    get_asset,
};
