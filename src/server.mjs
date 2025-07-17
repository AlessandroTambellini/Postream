import { createServer } from 'node:http';
import { debuglog as _debuglog } from 'node:util';

import { 
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
} from './handlers.mjs';

import { db_close } from './database.mjs';

const PORT = 3000;
const MAX_BUFFER_SIZE = 128 * 1024; // 128KB

const debuglog = _debuglog('server');

const server = createServer();

server.on('request', (req, res) => 
{ 
    // It can't be global because of possible conflicts among concurrent requests
    const res_obj = 
    {
        status_code: 500,
        content_type: 'application/json',
        payload: {},

        error: function(status_code, user_err_msg, server_log = undefined) {
            this.status_code = status_code;
            this.payload = { Error: `${user_err_msg}.` };
            // It may happen that I set the content-type to something else to return some data and then an error occurs,
            // so I reset the content-type to 'application/json' before reporting the error
            this.content_type = 'application/json';
            // Sometimes I want the log to the server to be different from what is reported to the user as an error
            if (server_log) console.error(`ERROR: ${server_log}.`);
        },

        success: function(status_code, payload = {}, content_type = 'application/json') {
            this.status_code = status_code;
            this.payload = payload;
            this.content_type = content_type;
        }
    };

    // Allowed chars: a-z, A-Z, 0-9, -, ., _, ~, :, /, ?, #, [, ], @, !, $, &, ', (, ), *, +, ,, ;, =
    const url_str = req.url.replace(/[^a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]/g, '');
    const url_obj = new URL(url_str, 'http://localhost:' + PORT);
    
    const trimmed_path = url_obj.pathname.replace(/^\/+|\/+$/g, '');

    debuglog(`${req.method} /${trimmed_path}`);
    
    const body = [];
    let buffer_size = 0;
    let f_abort = false;
    
    req.on('data', buffer => 
    {
        if (f_abort) return;

        buffer_size += buffer.length;
        if (buffer_size > MAX_BUFFER_SIZE)
        {
            const err_msg = trimmed_path === 'api/letter' ? 'Letter too big' : 'Content too large';
            
            res_obj.status_code = 413;
            res_obj.payload = { Error: `${err_msg}. Exceeded ${MAX_BUFFER_SIZE} bytes.` };
            
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
            'path': trimmed_path,
            'search_params': url_obj.searchParams,
            'method': req.method,
            // 'headers': req.headers,
            'payload': Buffer.concat(body).toString()
        };

        try {
            // Router
            switch (req_data.path) 
            {
            case 'ping':
                hdl_pong(res_obj)
                break;
            case '':
                await hdl_get_home_page(req_data, res_obj);
                break;
            case 'read-letter':
                await hdl_get_read_letter_page(req_data, res_obj);
                break;
            case 'write-letter':
                await hdl_get_write_letter_page(req_data, res_obj);
                break;
            case 'write-reply':
                await hdl_get_write_reply_page(req_data, res_obj);
                break;
            case 'api/letter':
                await hdl_letter(req_data, res_obj);
                break;
            case 'api/reply':
                await hdl_reply(req_data, res_obj);
                break;
            case 'api/letter/page':
                await hdl_get_letters_page(req_data, res_obj);
                break;
            case 'api/letter/get-all':
                await hdl_get_letters_all(req_data, res_obj);
                break;
            default:
                await hdl_get_asset(req_data, res_obj);
            }
            
            write_res(res, res_obj);

        } catch (error) {
            console.error('ERROR: Unexpected error in request handler:', error);
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
});

function write_res(res, res_obj) 
{
    try {
        const payload = res_obj.content_type === 'application/json' ? JSON.stringify(res_obj.payload) : res_obj.payload;
        
        res.strictContentLength = true;
        res.writeHead(res_obj.status_code, {
            'Content-Length': Buffer.byteLength(payload),
            'Content-Type': res_obj.content_type,
            // 'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
        });
        
        res.end(payload);

    } catch (error) {
        console.error('ERROR: Failed to write response:', error);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    }
}

server.on('listening', () => {
    console.log(`INFO: Server started on http://localhost:${PORT}`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.warn('WARN: Address in use, retrying.');
        setTimeout(() => {
            server.close();
            server.listen(PORT);
        }, 1000);
    } else {
        console.error('ERROR: While trying to start the server:', e.message);
    }
});

process.on('SIGHUP', () => shutdown_server(1));
process.on('SIGINT', () => shutdown_server(2));
process.on('SIGTERM', () => shutdown_server(15));

function shutdown_server(signal) {
    console.log(`\nINFO: Shutting down. Signal ${signal}.`);
    server.close(() => {
        console.log('INFO: The server has been shut down.');
        db_close();
        console.log('INFO: Database connection closed.');
        process.exit(128 + signal);
    });
}

server.listen(PORT);
