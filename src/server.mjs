import * as http from 'node:http';
import * as https from 'node:https';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import 'dotenv/config';

import * as handlers from './handlers.mjs';
import { db_close } from './database.mjs';
import { log_error } from './utils.mjs';

const PROTOCOL = process.env.ENVIRONMENT === 'production' ? 'https' : 'http';
const PORT = PROTOCOL === 'https' ? 3001 : 3000;

const MAX_BUFFER_SIZE = 128 * 1024; // 128KB
const CERTIFICATES_PATH = join(import.meta.dirname, '..');

const options = {
    key: readFileSync(join(CERTIFICATES_PATH, 'private-key.pem')),
    cert: readFileSync(join(CERTIFICATES_PATH, 'certificate.pem')),
};

const server = PROTOCOL === 'https' ? https.createServer(options) : http.createServer();

server.on('request', handle_request);
server.on('listening', () => console.log(`INFO: Server started on ${PROTOCOL}://localhost:${PORT}`));
server.on('error', handle_server_error);

process.on('SIGHUP', shutdown_server);
process.on('SIGINT', shutdown_server);
process.on('SIGTERM', shutdown_server);

server.listen(PORT);

function handle_request(req, res)
{
    const url_obj = new URL(req.url, `${PROTOCOL}://localhost:${PORT}`);

    const body = [];
    let buffer_size = 0;
    let f_abort = false;

    const res_obj = new Res();
    
    req.on('data', buffer => 
    {
        if (f_abort) return;

        buffer_size += buffer.length;
        if (buffer_size > MAX_BUFFER_SIZE)
        {            
            res_obj.error(413, `Content too large. Exceeded ${MAX_BUFFER_SIZE} bytes.`, true);
            
            write_res(res, res_obj);
            f_abort = true;
            return;
        }

        body.push(buffer);
    });

    req.on('end', async () => 
    {
        if (f_abort) return;

        const req_data = {
            'path': url_obj.pathname,
            'search_params': url_obj.searchParams,
            'method': req.method,
            'cookies': parse_cookies(req.headers),
            'payload': Buffer.concat(body).toString(),
        };

        try {
            const path = req_data.path;
            const page_path = path === '/' ? 'index' : path.replace('/', '');
            const api_path = path === '/api' ? 'list' : path.replace('/api/', '');

            if (handlers.page[page_path]) {
                if (req_data.method === 'GET') {
                    await handlers.page[page_path](req_data, res_obj);
                } else {
                    res_obj.error(405, `The method '${req_data.method}' isn't allowed for path '${req_data.path}'`);
                }
            } 
            else if (handlers.API[api_path]) {  
                handlers.API[api_path](req_data, res_obj);
            } 
            else {
                await handlers.get_asset(req_data, res_obj);
            }
            
            write_res(res, res_obj);

        } catch (error) {
            log_error(error);
            if (!res.headersSent) {
                res_obj.error(500, 'An unexpected error has occurred while processing the request');
                write_res(res, res_obj);
            }
        }
    });

    req.on('error', err => {
        console.error('ERROR: Request error:', err);
        if (!res.headersSent) {
            res_obj.error(400, 'Bad request');
            write_res(res, res_obj);
        }
    });

    res.on('error', err => {
        console.error('ERROR: Response error:', err);
    });
}

function write_res(res, res_obj) 
{
    try {
        const payload = res_obj.content_type === 'application/json' ? JSON.stringify(res_obj.payload) : res_obj.payload;
        
        res.strictContentLength = true;
        res.writeHead(res_obj.status_code, {
            'Content-Length': Buffer.byteLength(payload),
            'Content-Type': res_obj.content_type,
            'X-Frame-Options': 'SAMEORIGIN',
        });

        res.end(payload);

    } catch (error) {
        log_error(error);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    }
}

function parse_cookies(headers) 
{
    const raw = headers.cookie || '';
    
    const cookies = {};
    raw.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        if (parts.length === 2) {
            const [key, value] = parts.map(part => part.trim());
            cookies[key] = decodeURIComponent(value);
            // cookies[key] = value;
        }
    });

    return cookies;
}

function handle_server_error(e)
{
    if (e.code === 'EADDRINUSE') {
        console.warn('WARN: Address in use, retrying.');
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
        db_close();
        console.log('INFO: Database connection closed.');
        process.exit(128 + signals[signal]);
    });
}

class Res 
{
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

    // I creaed the 'page' method, because calling 'res_obj.success()' for a page 500/401 doesn't seem too clear to me.
    page(status_code, payload = '') {
        this.status_code = status_code;
        this.payload = payload;
        this.content_type = 'text/html';
    }
}
