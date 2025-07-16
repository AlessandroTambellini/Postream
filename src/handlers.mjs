import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";

import { 
    PAGE_LIMIT,
    db_get_letter_by_id,
    db_store_letter, 
    db_delete_letter_by_id,
    db_get_all_letters, 
    db_get_letters_page, 
} from "./database.mjs";
import make_HTML_letter_card from "./web_interface/script/utils/template.js";

const WEB_INTERFACE_PATH = join(import.meta.dirname, 'web_interface');

function hdl_pong(res_obj) {
    res_obj.success(200, 'pong');
}

async function hdl_get_home_page(req_data, res_obj) 
{
    if (req_data.method !== 'GET') {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'`)
        return;
    }

    const page_path = join(WEB_INTERFACE_PATH, 'index.html');

    let index_page;
    try {
        index_page = await readFile(page_path, { encoding: 'utf8' });        
    } catch (error) {
        res_obj.error(500, `Unable to read '${page_path}' from disk`, error.message);
        return;
    }

    const db_res = await db_get_letters_page(1, 20, 'asc');
    if (db_res.Error) {
        res_obj.error(500, 'Un unknown error has occured while trying to retrieve a letters page from db', db_res.Error);
        return;
    }

    const letter_cards = [];
    for (const letter of db_res.letters)
    {
        const letter_card = make_HTML_letter_card(letter, true, true);
        letter_cards.push(letter_card);
    }

    index_page = index_page.replace('{{ letter_cards }}', letter_cards.join(''));

    res_obj.success(200, index_page, 'text/html');
}

async function hdl_get_read_letter_page(req_data, res_obj)
{
    if (req_data.method !== 'GET') {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'`)
        return;
    }    

    const letter_id = req_data.search_params.get('id');
    if (!letter_id) {
        res_obj.error(400, 'Missing required letter id');
        return;
    }

    const page_path = join(WEB_INTERFACE_PATH, 'read-letter.html');

    let letter_page;
    try {
        letter_page = await readFile(page_path, { encoding: 'utf8' });
    } catch (error) {
        res_obj.error(500, `Unable to read '${page_path}' from disk`, error.message);
        return;
    }

    const db_res = await db_get_letter_by_id(letter_id);
    if (db_res.Error) {
        res_obj.error(db_res.status_code, db_res.Error);
        return;
    }

    const letter = db_res;
    const letter_card = make_HTML_letter_card(letter, true);

    letter_page = letter_page.replace('{{ letter_card }}', letter_card);

    res_obj.success(200, letter_page, 'text/html');
}

async function hdl_get_write_letter_page(req_data, res_obj) 
{
    if (req_data.method !== 'GET') {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'`);
        return;
    }

    const page_path = join(WEB_INTERFACE_PATH, 'write-letter.html');

    let write_letter_page;
    try {
        write_letter_page = await readFile(page_path, { encoding: 'utf8' });
    } catch (error) {
        res_obj.error(500, `Unable to read '${page_path}' from disk`, error.message);
        return;
    }

    res_obj.success(200, write_letter_page, 'text/html');
}

async function hdl_get_write_reply_page(req_data, res_obj) 
{
    if (req_data.method !== 'GET') {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'`)
        return;
    }

    const letter_id = req_data.search_params.get('id');
    if (!letter_id) {
        res_obj.error(400, 'Missing or invalid letter id');
        return;
    }

    const page_path = join(WEB_INTERFACE_PATH, 'write-reply.html');

    let write_reply_page;
    try {
        write_reply_page = await readFile(page_path, { encoding: 'utf8' });
    } catch (error) {
        res_obj.error(500, `Unable to read '${page_path}' from disk`, error.message);
        return;
    }

    const db_res = await db_get_letter_by_id(letter_id);
    if (db_res.Error) {
        res_obj.error(db_res.status_code, db_res.Error);
        return;
    }

    const letter = db_res;
    const letter_card = make_HTML_letter_card(letter, false);
    
    write_reply_page = write_reply_page.replace('{{ letter_card }}', letter_card);
    
    res_obj.success(200, write_reply_page, 'text/html');

}

async function hdl_get_asset(req_data, res_obj) 
{
    if (req_data.method !== 'GET') {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'`);
        return;
    }

    const asset_path = req_data.path;

    let f_binary = false;
    let content_type;

    const file_ext = extname(asset_path);
    
    switch (file_ext) {
        case '.css':
            content_type = 'text/css';
            break;
        case '.svg':
            content_type = 'image/svg+xml';
            break;
        case '.js':
            content_type = 'text/javascript';
            break;
        case '.json':
            content_type = 'application/json';
            break;
        case '.ttf':
            content_type = 'font/ttf';
            f_binary = true;
            break;
        default:
            content_type = 'text/plain';
            // First, I check if the extension is defined, because not necessarily the request was made to get an asset.
            if (file_ext) console.warn(`WARN: unknown file extension: '${file_ext}'. Pathname: '${asset_path}'.`);
            break;
    }

    let asset;
    try { 
        asset = await readFile(join(WEB_INTERFACE_PATH, asset_path), f_binary ? {} : { encoding: 'utf8' });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res_obj.error(404, `The path '${asset_path}' does not exist`);
        } else {
            res_obj.error(500, `Un unknown error has occured while trying to read '${asset_path}' from disk`, error.message);
        }
        return;
    }

    res_obj.success(200, asset, content_type);
}

async function hdl_letter(req_data, res_obj)
{
    const allowed_methods = ['GET', 'POST', 'DELETE'];
    if (!allowed_methods.includes(req_data.method)) {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'`);
        return;
    }

    await _handle_letter[req_data.method](req_data, res_obj);
}

const _handle_letter = {};

_handle_letter.GET = async function(req_data, res_obj)
{
    const letter_id = req_data.search_params.get('id');
    if (!letter_id) {
        res_obj.error(400, 'Missing required letter id');
        return;
    }

    const db_res = await db_get_letter_by_id(letter_id);
    if (db_res.Error) {
        res_obj.error(db_res.status_code, db_res.Error);
        return;
    }

    res_obj.success(200, db_res);
}

_handle_letter.POST = async function(req_data, res_obj)
{
    let letter_obj;
    try {
        letter_obj = JSON.parse(req_data.payload);
    } catch (error) {
        res_obj.error(400, `The payload doesn't have a valid JSON format. Catched error: '${error.message}'`);
        return;
    }
    
    // checking with just '(!letter_obj.message)' wouldb't be correct.
    if (letter_obj.message === undefined) {
        res_obj.error(400, `Missing required message field in the payload. Received: ${req_data.payload}`);
        return;
    }

    if (letter_obj.email === undefined) {
        res_obj.error(400, `Missing required email field in the payload. Received: ${req_data.payload}`);
        return;
    }

    if (letter_obj.message.length === 0) {
        res_obj.error(400, `The message of the letter can't be empty`);
        return;
    }
    
    /* Should I validate the email? */
    if (letter_obj.email.length === 0) {
        res_obj.error(400, `The email address is invalid`);
        return;
    }

    const res = await db_store_letter(letter_obj);
    
    if (res.Error) {
        res_obj.error(500, 'Un unknown error has occured while trying to store the letter', res.Error);
    } else {
        res_obj.success(200, { Success: 'Letter uploaded successfully.' });
    }
}

// The DELETE functionality isn't implemented on the web-interface side yet.
// I have to think about it.
_handle_letter.DELETE = async function(req_data, res_obj)
{
    return res_obj.success(501, 'Functionality not available yet');
    
    const letter_id = req_data.search_params.get('id');
    if (!letter_id) {
        res_obj.error(400, 'Missing required letter id');
        return;
    } 

    const db_res = await db_delete_letter_by_id(letter_id);
    if (db_res.Error) {
        res_obj.error(db_res.status_code, db_res.Error);
        return;
    }

    res_obj.success(200, db_res);
}

async function hdl_reply(req_data, res_obj)
{
    const allowed_methods = ['POST'];
    if (!allowed_methods.includes(req_data.method)) {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'`);
        return;
    }

    await _handle_reply[req_data.method](req_data, res_obj);
}

const _handle_reply = {};

_handle_reply.POST = async function(req_data, res_obj)
{
    const letter_id = req_data.search_params.get('id');
    if (!letter_id) {
        res_obj.error(400, 'Missing required letter id');
        return;
    }

    const db_res = await db_get_letter_by_id(letter_id, false);
    if (db_res.Error) {
        res_obj.error(db_res.status_code, db_res.Error);
        return;
    }

    let reply;
    try {
        /* Even though I expect the paylod to be parsed to a string (given that the payload is always a string), 
        I parse it anyway, because on the web-interface a stringified empty string become '""' and
        the test below (if (reply.length === 0)) would fail (because the length of the string is 2).
        I may avoid sending the payload on the client-side if it's empty, but I want anyway the validations
        to happen on the server-side because I want the latter to be client-agnostic. */
        reply = JSON.parse(req_data.payload);
    } catch (error) {
        res_obj.error(400, `The payload doesn't have a valid JSON format. Catched error: '${error.message}'`);
        return;
    }

    if (reply.length === 0) {
        res_obj.error(400, 'The reply can\'t be empty');
        return;
    }

    return res_obj.success(200, { Success: 'Reply sent successfully' });
}

async function hdl_get_letters_all(req_data, res_obj)
{
    if (req_data.method !== 'GET') {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'`);
        return;
    } 

    const res = await db_get_all_letters();

    if (res.Error) {
        res_obj.error(500, 'Un unknown error has occured while trying to retrieve the letters from db', res.Error);
    } else {
        res_obj.success(200, res);
    }
}

async function hdl_get_letters_page(req_data, res_obj)
{
    if (req_data.method !== 'GET') {
        res_obj.error(405, `The method '${req_data.method}' is not allowed for path '${req_data.path}'`);
        return;
    } 

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

    const res = await db_get_letters_page(page, limit, sort);

    if (res.Error) {
        res_obj.error(500, 'Un unknown error has occured while trying to retrieve a letters page from db', res.Error);
    } else {
        res_obj.success(200, res);
    }
}

export {
    hdl_pong,
    hdl_get_home_page,
    hdl_get_read_letter_page,
    hdl_get_write_letter_page,
    hdl_get_write_reply_page,
    hdl_get_asset,
    hdl_letter,
    hdl_reply,
    hdl_get_letters_all,
    hdl_get_letters_page,
};
