import { readFile } from "fs/promises";
import { join } from "path";

import { 
    PAGE_LIMIT,
    db_store_msg, 
    db_retrieve_all_messages, 
    db_get_messages_page 
} from "./database.mjs";

const CLIENT_PATH = join(import.meta.dirname, 'web_interface');

async function hdl_get_home_page(method, res_data) 
{
    if (method !== 'GET') {
        res_data.status_code = 405;
        return;
    }

    try {
        res_data.payload = await readFile(join(CLIENT_PATH, 'index.html'), { encoding: 'utf8' });
        res_data.content_type = 'text/html';
        res_data.status_code = 200;
    } catch (error) {
        res_data.status_code = 500;
        res_data.payload = { Error: 'Unable to read HTML page from disk.' };
        console.log('ERROR:', error.message);
    }
}

async function hdl_get_asset(req_data, res_data) 
{
    if (req_data.method !== 'GET') {
        res_data.status_code = 405;
        return;
    }

    const asset_path = req_data.pathname;

    try {
        let f_binary = false;

        const file_ext_idx = asset_path.lastIndexOf('.');
        if (file_ext_idx < 1 || file_ext_idx === asset_path.length-1) {
            res_data.content_type = 'text/plain';
        } else {
            const file_ext = asset_path.substring(file_ext_idx + 1);
            switch (file_ext) {
                case 'css':
                    res_data.content_type = 'text/css';
                    break;
                case 'svg':
                    res_data.content_type = 'image/svg+xml';
                    break;
                case 'js':
                    res_data.content_type = 'text/javascript';
                    break;
                case 'json':
                    res_data.content_type = 'application/json';
                    break;
                case 'ttf':
                    res_data.content_type = 'font/ttf';
                    f_binary = true;
                    break;
                default:
                    res_data.content_type = 'text/plain';
                    console.log(`WARN: unknown file extension: '${file_ext}'. Pathname: '${asset_path}'.`);
                    break;
            }
        }   

        res_data.payload = await readFile(join(CLIENT_PATH, asset_path), f_binary ? {} : { encoding: 'utf8' });
        res_data.status_code = 200;

    } catch (error) {
        res_data.content_type = 'application/json';
        if (error.code === 'ENOENT') {
            res_data.status_code = 404;
            res_data.payload = { Error: `The asset '${asset_path}' does not exist.` };
        } else {
            res_data.status_code = 500;
            res_data.payload = { Error: `Un unknown error has occured while trying to read '${asset_path}' from disk.` };
            console.log('ERROR:', error.message);
        }
    }
}

async function hdl_handle_msg(req_data, res_data)
{
    const allowed_methods = ['GET', 'POST'];
    if (!allowed_methods.includes(req_data.method)) {
        res_data.status_code = 405;
        return;
    }

    await _handle_msg[req_data.method](req_data, res_data);
}

const _handle_msg = {};

_handle_msg.GET = async function (req_data, res_data)
{

}

_handle_msg.POST = async function (req_data, res_data)
{
    let msg_obj;
    try {
        msg_obj = JSON.parse(req_data.payload);
    } catch (error) {
        res_data.status_code = 400;
        res_data.payload =  { Error: `The payload doesn't have a valid JSON format. Catched error: '${error.message}'.` };
        return;
    }
    
    if (!msg_obj.msg) {
        res_data.status_code = 400;
        res_data.payload =  { Error: `Missing required msg field in the payload. Received: ${req_data.payload}.` };
        return;
    }

    const msg = msg_obj.msg;
    if (msg.length === 0) {
        res_data.status_code = 400;
        res_data.payload =  { Error: `The msg can't be empty.` };
        return;
    }

    const res = await db_store_msg(msg);
    
    if (res.Error) {
        res_data.status_code = 500;
        /*
            I could write `res_data.payload = res.Error`, but I don't want to share the catched error msg
            with the user.
        */
        res_data.payload = { Error: 'Something went wrong while trying to store the msg.' };
        console.log('ERROR:', res.Error);
    } else {
        res_data.status_code = 200;
        res_data.payload = res;
    }
}

async function hdl_get_all_messages(method, res_data)
{
    if (method !== 'GET') {
        res_data.status_code = 405;
        return;
    } 

    const res = await db_retrieve_all_messages();

    if (res.Error) {
        res_data.status_code = 500;
        res_data.payload = { Error: 'Unable to retrieve the messages.' };
        console.log('ERROR:', res.Error);
    } else {
        res_data.status_code = 200;
        res_data.payload = res;
    }
}

async function hdl_get_messages_page(req_data, res_data)
{
    if (req_data.method !== 'GET') {
        res_data.status_code = 405;
        return;
    } 

    const page = parseInt(req_data.search_params.get('page')) || 1;
    const limit = parseInt(req_data.search_params.get('limit')) || 50;

    if (page < 1) {
        res_data.status_code = 400;
        res_data.payload = { Error: `Invalid pagination param. Page must be >= 1. Got ${page} instead.` };
        return;
    }
    
    if (limit < 1 || limit > PAGE_LIMIT) {
        res_data.status_code = 400;
        res_data.payload = { Error: `Invalid pagination param. Limit must be 1-100. Got ${limit} instead.` };
        return;
    }

    const res = await db_get_messages_page(page, limit);

    if (res.Error) {
        res_data.status_code = 500;
        res_data.payload = { Error: 'Unable to retrieve the messages.' };
        console.log('ERROR:', res.Error);
    } else {
        res_data.status_code = 200;
        res_data.payload = res;
    }
}

export {
    hdl_get_home_page,
    hdl_get_asset,
    hdl_handle_msg,
    hdl_get_all_messages,
    hdl_get_messages_page
};
