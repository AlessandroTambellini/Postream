import * as http from 'node:http';
import * as https from 'node:https';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { loadEnvFile, env } from 'node:process';

import { handlers, get_asset } from './handlers.js';
import { init_db, close_db } from './database.js';
import { log_error } from './utils.js';

// I want a crash here in case of error. 
// Don't even start the server.
loadEnvFile();

const PORT = env.NODE_ENV === 'production' ? 3001 : 3000;
const PROTOCOL = env.NODE_ENV === 'production' ? 'https' : 'http';
const MAX_BUFFER_SIZE = 128 * 1024; // 128KB
const CERTIFICATES_PATH = path.join(import.meta.dirname, '..');

const server = PROTOCOL === 'https' ?
    https.createServer({
        key: readFileSync(join(CERTIFICATES_PATH, 'private-key.pem')),
        cert: readFileSync(join(CERTIFICATES_PATH, 'certificate.pem')),
    }) : http.createServer();

server.on('request', handle_request);
server.on('listening', () => console.log(`INFO: Server started on ${PROTOCOL}://localhost:${PORT}`));
server.on('error', handle_server_error);

process.on('SIGHUP', shutdown_server);
process.on('SIGINT', shutdown_server);
process.on('SIGTERM', shutdown_server);

init_db();

server.listen(PORT);

function handle_request(req, res)
{
    const res_data = new ResData();

    const { url, url_error } = get_url(req.url);

    if (url_error) {
        res_data.error(400, 'Invalid URL');
        write_res(res, res_data);
        return;
    }

    const body = [];
    let buffer_size = 0;
    let f_abort = false;

    req.on('data', buffer =>
    {
        if (f_abort) return;

        buffer_size += buffer.length;
        if (buffer_size > MAX_BUFFER_SIZE)
        {
            res_data.error(413,
                `Content too large. Exceeded ${MAX_BUFFER_SIZE} bytes. Received ${buffer_size} bytes`,
                true);

            write_res(res, res_data);
            f_abort = true;
            return;
        }

        body.push(buffer);
    });

    req.on('end', async () =>
    {
        if (f_abort) return;

        const req_data = {
            'path': scrub_path(url.pathname),
            'search_params': url.searchParams,
            'method': req.method.toUpperCase(),
        };

        const { cookies, cookies_error } = parse_cookies(req.headers);
        
        if (cookies_error) {
            res_data.error(400, cookies_error);
            write_res(res, res_data);
            return;
        }

        const JSON_payload = Buffer.concat(body).toString() || '{}';
        const { obj, JSON_error } = convert_JSON_to_obj(JSON_payload);
        
        if (JSON_error) {
            res_data.error(400, JSON_error);
            write_res(res, res_data);
            return;
        }
        
        req_data.cookies = cookies;
        req_data.payload = obj;

        try {
            if (handlers[req_data.path]) {
                await handlers[req_data.path](req_data, res_data);
            } else {
                await get_asset(req_data, res_data);
            }
        } catch (error) {
            log_error(error);
            res_data.error(500, 'An unexpected error has occurred while processing the request');
            write_res(res, res_data);
            return;
        }

        write_res(res, res_data);
    });

    req.on('error', err => {
        console.error('ERROR: Request error:', err);
        if (!res.headersSent) {
            res_data.error(400, 'Bad request');
            write_res(res, res_data);
        }
    });

    res.on('error', err => {
        console.error('ERROR: Response error:', err);
    });
}

function write_res(res, res_data)
{
    let payload;
    if (res_data.content_type === 'application/json')
    {
        const { json, obj_error } = convert_obj_to_JSON(res_data.payload);
        if (obj_error) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
            return;
        }
        payload = json;
    } else {
        payload = res_data.payload;
    }

    res.strictContentLength = true;
    res.writeHead(res_data.status_code, {
        'Content-Length': Buffer.byteLength(payload),
        'Content-Type': res_data.content_type,
        'X-Frame-Options': 'SAMEORIGIN',
    });

    res.end(payload);
}

function get_url(url_string)
{
    let url = null, url_error = null;
    try {
        url = new URL(url_string, `${PROTOCOL}://localhost:${PORT}`);
    } catch (error) {
        url_error = error.message;
    }

    return { url, url_error };
}

function scrub_path(path)
{
    let scrubbed_path = path;

    if (path.length > 1) {
        if (path.endsWith('/')) {
            scrubbed_path = path.slice(0, path.length-1);
        }
        else if (path.endsWith('.html')) {
            scrubbed_path = path.replace('.html', '')
        }
    }

    return scrubbed_path;
}

function parse_cookies(headers)
{
    const cookies = {};
    let cookies_error = null;

    (headers.cookie || '').split(';').forEach(cookie => {
        const [name, value] = cookie.split('=');
        if (name && value) {
            try {
                cookies[name] = decodeURIComponent(value);
            } catch (error) {
                cookies_error = error.message;
            }
        }
    });

    return { cookies, cookies_error };
}

function convert_JSON_to_obj(json)
{
    let obj = null, JSON_error = null;
    try {
        obj = JSON.parse(json);
    } catch (error) {
        JSON_error = error.message;
    }

    return { obj, JSON_error };
}

function convert_obj_to_JSON(obj)
{
    let json = null, obj_error = null;
    try {
        json = JSON.stringify(obj);
    } catch (error) {
        obj_error = true;
        log_error(error);
    }

    return { json, obj_error };
}

function handle_server_error(e)
{
    if (e.code === 'EADDRINUSE') {
        console.error('ERROR: Address in use, retrying.');
        setTimeout(() => {
            server.close();
            server.listen(PORT);
        }, 1000);
    } else {
        console.error('ERROR: While trying to start the server:', e.message);
    }
}

function shutdown_server(signal)
{
    const signals = {
        SIGHUP: 1,
        SIGINT: 2,
        SIGTERM: 15,
    };

    console.log(`\nINFO: Shutting down. Signal ${signals[signal]}.`);
    server.close(() => {
        console.log('INFO: The server has been shut down.');
        close_db();
        console.log('INFO: Database connection closed.');
        process.exit(128 + signals[signal]);
    });
}

class ResData {
    status_code = 500;
    payload = {};
    content_type = 'application/json';

    error(status_code, error_msg = '', server_log = false) {
        this.status_code = status_code;
        this.payload = { Error: `${error_msg}.` };
        this.content_type = 'application/json';

        if (server_log) console.error(`ERROR: ${error_msg}.`);
    }

    success(status_code, payload = {}, content_type = 'application/json') {
        this.status_code = status_code;
        this.payload = payload;
        this.content_type = content_type;
    }

    /* The 'page' method was added,
    because calling 'res_data.success()' for a 500/401 fallback page doesn't seem semantically clear to me. */
    page(status_code, payload = '') {
        this.status_code = status_code;
        this.payload = payload;
        this.content_type = 'text/html';
    }
}
