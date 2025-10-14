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
    DOMElements,
    fallback_page,
} from "./templates.mjs";

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

const pages = {};

pages['pages'] = async function(req_data, res_obj)
{
    // Object.keys(pages)
};

pages['test-elements'] = async function(req_data, res_obj)
{
    let { template: test_components_template, fs_error } = await read_template('test-elements');

    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
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
        post_content_snapshot: card.content, 
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

    res_obj.page(200, test_components_page);
};  

pages.index = async function(req_data, res_obj) 
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

    const post_cards = [];
    if (db_error) {
        post_cards.push(DOMElements['.info-msg']('Sorry, unable to retrieve the posts :('));
    } else {
        posts.forEach(post => {
            // TODO explain why I don't show the posts of the logged-in user in the index page
            // Perhaps I shouldn't retrieve them at all
            if (post.user_id !== user_id) {
                post_cards.push(DOMElements['.post-card'](post, 2, true));
            }
        });
    }
    
    const index_page = index_template
        .replace('{{ post-cards }}', post_cards.join(''))
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](user_id, 'index'))
    ;

    res_obj.page(200, index_page);
};

pages['create-account'] = async function(req_data, res_obj)
{
    let { template: create_account_template, fs_error } = await read_template('create-account');
   
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    const create_account_page = create_account_template
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](false, 'create-account'))
    ;

    res_obj.page(200, create_account_page);
};

pages.login = async function(req_data, res_obj)
{
    let { template: login_template, fs_error } = await read_template('login');
    
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    const login_page = login_template
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](false, 'login'))
    ;

    res_obj.page(200, login_page);
};

pages.profile = async function(req_data, res_obj)
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

    // const { posts, db_error } = db_op.select_user_posts_page(user_id, 1, 20, 'desc');
    const { posts, db_error } = db_op.select_user_posts(user_id);

    if (db_error) {
        profile_template = profile_template.replace('{{ post-cards }}', 
            DOMElements['.info-msg']('Sorry, unable to retrieve the posts :('));
    } else {
        const post_cards = posts.map(post => DOMElements['.post-card'](post, 1, true)).join('');
        profile_template = profile_template.replace('{{ post-cards }}', post_cards);
    }

    const profile_page = profile_template
        .replace('{{ .profile-picture }}', DOMElements['.profile-picture'](50, 300))
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'profile'))
    ;

    res_obj.page(200, profile_page);
};

pages.notifications = async function(req_data, res_obj)
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

    if (db_error) {
        notifications_template = notifications_template.replace('{{ notification-cards }}', 
            DOMElements['.info-msg']('Sorry, unable to retrieve the posts :('));
    } else {
        const notification_cards  = notifications.map(notification => 
            DOMElements['.notification-card'](notification)).join('');

        notifications_template = notifications_template.replace('{{ notification-cards }}', notification_cards);
    }

    const notifications_page = notifications_template
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'notifications'))
    ;

    res_obj.page(200, notifications_page);
};

pages['write-post'] = async function(req_data, res_obj) 
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
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'write-post'))
    ;

    res_obj.page(200, write_post_page);
};

pages['write-reply'] = async function(req_data, res_obj) 
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
        res_obj.page(500, fallback_page(500, "You can't reply because you are logged out."));
        return;
    }

    if (!post) {
        write_reply_template = write_reply_template.replace('{{ .post-card }}', DOMElements['.info-msg'](`There is no post with id '${post_id}'`));
    } else {
        write_reply_template = write_reply_template.replace('{{ .post-card }}', DOMElements['.post-card'](post));
    }

    const write_reply_page = write_reply_template
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'write-reply'))
    ;

    res_obj.page(200, write_reply_page);
};

pages['read-post'] = async function(req_data, res_obj)
{
    let { template: post_template, fs_error } = await read_template('read-post');
    
    if (fs_error) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    const post_id = req_data.search_params.get('id');
    const { post, db_error } = db_op.select_post(post_id);
    const { user_id, status_code } = auth_user(req_data.cookies);

    if (db_error || status_code === 500) 
    {
        res_obj.page(500, fallback_page(500));
        return;
    }

    if (!post) {
        const post_page = post_template
            .replace('{{ #side-panel }}', DOMElements['#side-panel'](user_id, 'read-post'))
            .replace('{{ .post-card }}', DOMElements['.info-msg'](`There is no post with id '${post_id}'`))
        ;
        res_obj.page(200, post_page);
        return;
    } 

    const reply_cards = [];
    if (post.user_id === user_id)
    {
        const { replies, db_error } = db_op.select_post_replies(post_id);

        if (db_error) {
            reply_cards.push(DOMElements['.info-msg']('Sorry, unable to retrieve the replies :('));
        } else {
            reply_cards.push(...replies.map(reply => DOMElements['.reply-card'](reply)));
        }
    }

    const post_page = post_template
        .replace('{{ .post-card }}', DOMElements['.post-card'](post, user_id && post.user_id !== user_id ? 2 : 0))
        .replace('{{ replies }}', reply_cards.join(''))
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](user_id, 'read-post'))
    ;

    res_obj.page(200, post_page);
};  

pages.logout = async function(req_data, res_obj)
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
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'logout'))
    ;

    res_obj.page(200, logout_page);
};

pages['delete-account'] = async function(req_data, res_obj)
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
        .replace('{{ #side-panel }}', DOMElements['#side-panel'](true, 'delete-account'))
    ;

    res_obj.page(200, delete_account_page);
};

pages.logo = async function(req_data, res_obj)
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

API.apis = route_API_method('apis');
API.user = route_API_method('user');
API.token = route_API_method('token');
API.post = route_API_method('post');
API.reply = route_API_method('reply');
API['user/notifications'] = route_API_method('user/notifications');
API['posts/page'] = route_API_method('posts/page');
API['posts/user/page'] = route_API_method('posts/user/page');
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

API.apis.GET = function(req_data, res_obj) 
{
    res_obj.success(200, { 'Available APIs': Object.keys(API) });
};

API.user.POST = function(req_data, res_obj) 
{
    const password = generate_password();

    /* I might check if an user with the generated password already exists,
    but, given that the probability of generating two times the same password
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

    const { is_token_updated, db_error: token_db_error } = db_op.update_token(password_hash);

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

API.reply.POST = function(req_data, res_obj)
{
    const { user_id: logged_in_user_id, status_code, auth_error } = auth_user(req_data.cookies);
    
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

    if (post.user_id === logged_in_user_id) {
        res_obj.error(403, 'You can\'t reply to your own post');
        return;
    }

    const reply_id = db_op.insert_reply(post_id, content);

    if (!reply_id) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('insert', 'reply'));
        return;
    }

    const { notification, db_error: notif_db_error } = db_op.select_notification(post_id);

    if (notif_db_error) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('select', 'notification'));
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
        const notification_id = db_op.insert_notification(post.user_id, post.id, post.content.substring(0, 70), reply_id);
        
        if (!notification_id) {
            res_obj.error(500, MSG_UNKNOWN_DB_ERROR('insert', 'notification'));
            return;
        }
    } else {
        const { is_notification_updated, db_error } = db_op.update_notification(post_id);
        if (db_error) {
            res_obj.error(500, MSG_UNKNOWN_DB_ERROR('update', 'notification'));
            return;
        }
        if (!is_notification_updated) {
            res_obj.error(404, MSG_NOT_FOUND('notification', 'post_id'));
            return; 
        }
    }

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
    const format = req_data.search_params.get('format') || 'json';

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
    
    if (!['json', 'html'].includes(format)) {
        res_obj.error(400, `Invalid format option. Got '${sort}'. Valid options are: json, html`);
        return;
    }

    const { posts, num_of_posts, db_error } = db_op.select_posts_page(page, limit, sort);
    
    if (db_error) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('get', 'posts'));
    } else {
        if (format === 'html') {
            const post_cards = posts.map(post => DOMElements['.post-card'](post, 2, true)).join('');            
            res_obj.success(200, { post_cards, num_of_posts });
        } else {
            res_obj.success(200, { posts, num_of_posts });
        }
    }
};

API['posts/user/page'].GET = function(req_data, res_obj)
{
    const { user_id, status_code, auth_error } = auth_user(req_data.cookies);
    
    if (auth_error)
    {
        res_obj.error(status_code, auth_error);
        return;
    }  

    const page = parseInt(req_data.search_params.get('page')) || 1;
    const limit = parseInt(req_data.search_params.get('limit')) || 50;
    const sort = 'desc'; // for now is just desc

    if (page < 1) {
        res_obj.error(400, `Page must be >= 1. Got ${page} instead`);
        return;
    }
    
    if (limit < 1 || limit > PAGE_LIMIT) {
        res_obj.error(400, `Limit must be 1-100. Got ${limit} instead`);
        return;
    }

    const { posts, db_error } = db_op.select_user_posts_page(user_id, page, limit, sort);

    if (db_error) {
        res_obj.error(500, MSG_UNKNOWN_DB_ERROR('get', 'user posts'));
    } else {
        res_obj.success(200, posts);
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
        svg: 'image/svg+xml',
        png: 'image/png',
        webp: 'image/webp',
        ttf: 'font/ttf',
    };

    if (extensions[file_ext]) {
        content_type = extensions[file_ext];
    } else {
        content_type = 'text/plain';
        /* Before logging the warning for 'unknown extension', I first check if the extension is even defined at all.
        That's because 'get_asset' is called as the last routing option in case none of the previous ones matched the requested path.
        Not necessarily the request was made to get an asset */
        if (file_ext)
            console.warn(`WARN: Unknown file extension '${file_ext}'. File path: '${asset_path}'.`);
    }

    if (['font/ttf', 'image/png'].includes(content_type)) 
        f_binary = true;

    try { 
        const asset = await readFile(join(WEB_INTERFACE_PATH, asset_path), f_binary ? {} : { encoding: 'utf8' });
        
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
    let status_code = 200;

    /* The auth_error msg is meant for the backend APIs, not for the request of web pages,
    because for the latter the err messages are framed a bit differently for the final user. */
    let auth_error = null;

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
    pages,
    API,
    get_asset,
};
