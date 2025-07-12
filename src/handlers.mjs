import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { 
    PAGE_LIMIT,
    db_store_msg, 
    db_get_msgs_all, 
    db_get_msgs_page, 
    db_get_msg_by_id,
} from "./database.mjs";
import letter_to_HTML from "./web_interface/script/utils/template.js";

const CLIENT_PATH = join(import.meta.dirname, 'web_interface');

function hdl_pong(res_obj) {
    res_obj.success(200, 'pong');
}

async function hdl_get_home_page(req_data, res_obj) 
{
    if (req_data.method !== 'GET') {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'.`)
        return;
    }

    const page_path = join(CLIENT_PATH, 'index.html');

    try {
        let index_page = await readFile(page_path, { encoding: 'utf8' });
        
        const db_res = await db_get_msgs_page(1, 20, 'asc');
        if (db_res.Error) {
            res_obj.error(500, 'Unable to retrieve the messages.', db_res.Error);
            return;
        }

        const msg_cards = [];
        for (const msg_obj of db_res.msgs)
        {
            const msg_HTML = letter_to_HTML(msg_obj.id, msg_obj.content, msg_obj.timestamp, true, true);
            msg_cards.push(msg_HTML);
        }

        index_page = index_page.replace('{{ msg_cards }}', msg_cards.join(''));

        res_obj.success(200, index_page, 'text/html');
        
    } catch (error) {
        res_obj.error(500, `Unable to read '${page_path}' from disk.`, error.message);
    }
}

async function hdl_get_read_msg_page(req_data, res_obj)
{
    if (req_data.method !== 'GET') {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'.`)
        return;
    }    

    const msg_id = req_data.search_params.get('id');
    if (!msg_id) {
        res_obj.error(400, 'Missing msg id.');
        return;
    }

    const page_path = join(CLIENT_PATH, 'read-letter.html');

    try {
        let msg_page = await readFile(page_path, { encoding: 'utf8' });
                
        const db_res = await db_get_msg_by_id(msg_id);
        if (db_res.Error) {
            if (db_res.status === 404) {
                res_obj.error(db_res.status, db_res.Error);
            } else {
                res_obj.error(db_res.status, `Unable to read msg with id '${msg_id}' from disk.`, db_res.Error);
            }
            return;
        }

        const msg_obj = db_res;
        const msg_HTML = letter_to_HTML(msg_obj.id, msg_obj.content, msg_obj.timestamp, true);

        msg_page = msg_page.replace('{{ msg_card }}', msg_HTML);

        res_obj.success(200, msg_page, 'text/html');

    } catch (error) {
        res_obj.error(500, `Unable to read '${page_path}' from disk.`, error.message);
    }
}

async function hdl_get_write_msg_page(req_data, res_obj) 
{
    if (req_data.method !== 'GET') {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'.`)
        return;
    }

    const page_path = join(CLIENT_PATH, 'write-letter.html');

    try {
        const HTML_page = await readFile(page_path, { encoding: 'utf8' });
        res_obj.success(200, HTML_page, 'text/html');
    } catch (error) {
        res_obj.error(500, `Unable to read '${page_path}' from disk.`, error.message);
    }
}

async function hdl_get_write_reply_page(req_data, res_obj) 
{
    if (req_data.method !== 'GET') {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'.`)
        return;
    }

    const msg_id = req_data.search_params.get('id');
    if (!msg_id) {
        res_obj.error(400, 'Missing msg id.');
        return;
    }

    const page_path = join(CLIENT_PATH, 'write-reply.html');

    try {
        let reply_page = await readFile(page_path, { encoding: 'utf8' });

        const db_res = await db_get_msg_by_id(msg_id);
        if (db_res.Error) {
            if (res.status === 404)
                res_obj.error(res.status, res.Error);
            else
                res_obj.error(res.status, `Unable to read msg with id '${msg_id}' from disk.`, res.Error);
            return;
        }

        const msg_obj = db_res;
        const msg_HTML = letter_to_HTML(msg_obj.id, msg_obj.content, msg_obj.timestamp, false);
        
        reply_page = reply_page.replace('{{ msg_card }}', msg_HTML);
        
        res_obj.success(200, reply_page, 'text/html');

    } catch (error) {
        res_obj.error(500, `Unable to read '${page_path}' from disk.`, error.message);
    }
}

async function hdl_get_asset(req_data, res_obj) 
{
    if (req_data.method !== 'GET') {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'.`)
        return;
    }

    const asset_path = req_data.path;

    try {
        let f_binary = false;
        let content_type = 'text/plain';

        const file_ext_idx = asset_path.lastIndexOf('.');
        if (file_ext_idx < 1 || file_ext_idx === asset_path.length-1) {
            content_type = 'text/plain';
        } else {
            const file_ext = asset_path.substring(file_ext_idx + 1);
            switch (file_ext) {
                case 'css':
                    content_type = 'text/css';
                    break;
                case 'svg':
                    content_type = 'image/svg+xml';
                    break;
                case 'js':
                    content_type = 'text/javascript';
                    break;
                case 'json':
                    content_type = 'application/json';
                    break;
                case 'ttf':
                    content_type = 'font/ttf';
                    f_binary = true;
                    break;
                default:
                    console.warn(`WARN: unknown file extension: '${file_ext}'. Pathname: '${asset_path}'.`);
                    break;
            }
        }   

        const HTML_page = await readFile(join(CLIENT_PATH, asset_path), f_binary ? {} : { encoding: 'utf8' });
        res_obj.success(200, HTML_page, content_type);

    } catch (error) {
        if (error.code === 'ENOENT')
            res_obj.error(404, `The asset '${asset_path}' does not exist.`);
        else
            res_obj.error(500, `Un unknown error has occured while trying to read '${asset_path}' from disk.`, error.message);
    }
}

async function hdl_msg(req_data, res_obj)
{
    const allowed_methods = ['GET', 'POST'];
    if (!allowed_methods.includes(req_data.method)) {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'.`);
        return;
    }

    await _handle_msg[req_data.method](req_data, res_obj);
}

const _handle_msg = {};

_handle_msg.GET = async function (req_data, res_obj)
{
    const msg_id = req_data.search_params.get('id');
    if (!msg_id) {
        res_obj.error(400, 'Missing msg id.');
        return;
    }

    const res = await db_get_msg_by_id(msg_id);
    if (res.Error) {
        if (res.status === 404)
            res_obj.error(res.status, res.Error);
        else
            res_obj.error(res.status, `Unable to read msg with id '${msg_id}' from disk.`, res.Error);
        return;
    }

    res_obj.success(200, res);
}

_handle_msg.POST = async function (req_data, res_obj)
{
    let msg_obj;
    try {
        msg_obj = JSON.parse(req_data.payload);
    } catch (error) {
        res_obj.error(400, `The payload doesn't have a valid JSON format. Catched error: '${error.message}'.`);
        return;
    }
    
    // checking with just '(!msg_obj.msg)' wouldb't be correct.
    if (msg_obj.msg === undefined) {
        res_obj.error(400, `Missing required msg field in the payload. Received: ${req_data.payload}.`);
        return;
    }
    
    const msg = msg_obj.msg;
    if (msg.length === 0) {
        res_obj.error(400, `The msg can't be empty.`);
        return;
    }

    const res = await db_store_msg(msg);
    
    if (res.Error)
        res_obj.error(500, 'Something went wrong while trying to store the msg.', res.Error);
    else
        res_obj.success(200, res);
}

async function hdl_get_msgs_all(req_data, res_obj)
{
    if (req_data.method !== 'GET') {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'.`)
        return;
    } 

    const res = await db_get_msgs_all();

    if (res.Error)
        res_obj.error(500, 'Unable to retrieve the messages.', res.Error);
    else 
        res_obj.success(200, res);
}

async function hdl_get_msgs_page(req_data, res_obj)
{
    if (req_data.method !== 'GET') {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'.`)
        return;
    } 

    const page = parseInt(req_data.search_params.get('page')) || 1;
    const limit = parseInt(req_data.search_params.get('limit')) || 50;
    const sort = req_data.search_params.get('sort') || 'asc';

    if (page < 1) {
        res_obj.error(400, `Page must be >= 1. Got ${page} instead.`);
        return;
    }
    
    if (limit < 1 || limit > PAGE_LIMIT) {
        res_obj.error(400, `Limit must be 1-100. Got ${limit} instead.`);
        return;
    }
    
    if (sort !== 'asc' && sort !== 'desc' && sort !== 'rand') {
        res_obj.error(400, `Invalid sorting option. Got '${sort}'.`);
        return;
    }

    const res = await db_get_msgs_page(page, limit, sort);

    if (res.Error)
        res_obj.error(500, 'Unable to retrieve the messages.', res.Error);
    else 
        res_obj.success(200, res);
}

export {
    hdl_pong,
    hdl_get_home_page,
    hdl_get_read_msg_page,
    hdl_get_write_msg_page,
    hdl_get_write_reply_page,
    hdl_get_asset,
    hdl_msg,
    hdl_get_msgs_all,
    hdl_get_msgs_page,
};
