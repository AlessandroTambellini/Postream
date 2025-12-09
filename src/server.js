import * as http from 'node:http';
import * as https from 'node:https';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { loadEnvFile, env } from 'node:process';

import { handlers, get_asset } from './handlers.js';
import { init_db, close_db } from './database.js';
import { log_error } from './utils.js';

// I don't handle a possible error, because if it happens, 
// I want to crash before starting the server.
loadEnvFile();

const PORT = env.NODE_ENV === 'production' ? 3001 : 3000;
const PROTOCOL = env.NODE_ENV === 'production' ? 'https' : 'http';
const MAX_BUFFER_SIZE = 128 * 1024; // 128KB
const CERTIFICATES_PATH = path.join(import.meta.dirname, '..');

if (process.argv[1] === import.meta.filename)
{
    const server = PROTOCOL === 'https' ?
        https.createServer({
            key: readFileSync(join(CERTIFICATES_PATH, 'private-key.pem')),
            cert: readFileSync(join(CERTIFICATES_PATH, 'certificate.pem')),
        }) : http.createServer();

    server.on('request', (req, responder) => {
        serve_req(req, new Messenger(responder));
    });
    server.on('listening', () => console.log(`INFO: Server started on ${PROTOCOL}://localhost:${PORT}`));
    server.on('error', e => handle_server_error(server, e));

    process.on('SIGHUP', sig => shutdown_server(server, sig));
    process.on('SIGINT', sig => shutdown_server(server, sig));
    process.on('SIGTERM', sig => shutdown_server(server, sig));
    
    init_db();
    
    server.listen(PORT);
}

function serve_req(req, messenger)
{
    const body = [];
    let buffer_size = 0;
    let f_abort = false;

    req.on('data', buffer =>
    {
        if (f_abort) return;

        buffer_size += buffer.length;
        if (buffer_size > MAX_BUFFER_SIZE)
        {
            const res = new Res(413, 
                { Error: `Content too large. Exceeded ${MAX_BUFFER_SIZE} bytes. Received ${buffer_size} bytes` }, 
                'application/json'
            );

            messenger.send(res);
            f_abort = true;
            return;
        }

        body.push(buffer);
    });

    req.on('end', async () =>
    {
        if (f_abort) return;

        const { url, url_error } = get_url(req.url);

        if (url_error) {
            const res = new Res(400, { Error: 'Invalid URL' }, 'application/json');
            messenger.send(res);
            return;
        }

        const { cookies, cookies_error } = parse_cookies(req.headers);
        
        if (cookies_error) {
            const res = new Res(400, { Error: cookies_error }, 'application/json');
            messenger.send(res);
            return;
        }

        const JSON_payload = Buffer.concat(body).toString() || '{}';
        const { obj, JSON_error } = convert_JSON_to_obj(JSON_payload);
        
        if (JSON_error) {
            const res = new Res(400, { Error: JSON_error }, 'application/json');
            messenger.send(res);
            return;
        }

        const req_data = {};
        req_data.path = scrub_path(url.pathname); 
        req_data.search_params = url.searchParams;
        req_data.method = req.method.toUpperCase();        
        req_data.cookies = cookies;
        req_data.payload = obj;

        let res = null;
        if (handlers[req_data.path]) {
            res = await handlers[req_data.path](req_data);
        } else {
            res = await get_asset(req_data);
        }

        messenger.send(res);
    });

    req.on('error', err => {
        console.error('ERROR: Request error:', err);
        if (!messenger.responder.headersSent) {
            messenger.send(new Res(400, { Error: 'Bad request' }, 'application/json'));
        }
    });
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

function handle_server_error(server, e)
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

function shutdown_server(server, signal)
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

class Messenger {
    constructor(responder) {
        this.responder = responder;
        this.responder.on('error', err => {
            console.error('ERROR: Response error:', err);
        });
    }

    send(res)
    {
        let payload = null;
        if (res.content_type === 'application/json')
        {
            const { 
                json, 
                obj_error, 
            } = convert_obj_to_JSON(res.payload);
            
            if (obj_error) {
                this.responder.writeHead(500, { 'Content-Type': 'text/plain' });
                this.responder.end('Internal Server Error');
            } else {
                payload = json;
            }
        } else {
            payload = res.payload;
        }

        this.responder.strictContentLength = true;
        this.responder.writeHead(res.code, {
            'Content-Length': Buffer.byteLength(payload),
            'Content-Type': res.content_type,
            'X-Frame-Options': 'SAMEORIGIN',
        });

        this.responder.end(payload);
    }
}

class Res {
    constructor(code, payload, content_type) {
        this.code = code;
        this.payload = payload;
        this.content_type = content_type;
    }
}

export default Res;
