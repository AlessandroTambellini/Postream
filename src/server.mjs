import { createServer } from 'node:http';
import { StringDecoder } from 'node:string_decoder';
import { debuglog as _debuglog } from 'node:util';

import { 
    hdl_pong,
    hdl_get_home_page, 
    hdl_get_read_msg_page,
    hdl_get_write_msg_page,
    hdl_get_write_reply_page,
    hdl_get_asset, 
    hdl_msg,
    hdl_get_msgs_all, 
    hdl_get_msgs_page, 
} from './handlers.mjs';

import { db_close } from './database.mjs';

const PORT = 3000;
const MAX_BUFFER_SIZE = 128 * 1024; // 128KB

const debuglog = _debuglog('server');
const decoder = new StringDecoder('utf8');

const server = createServer();

const res_obj = 
{
    status_code: 500,
    content_type: 'application/json',
    payload: {},

    error: function(status_code, err_msg, log = undefined) {
        this.status_code = status_code;
        this.payload = { Error: err_msg };
        // It may happen that I set the content-type to something else to return some data and then an error occurs,
        // so I reset the content-type to 'application/json' before reporting the error
        this.content_type = 'application/json';
        // Sometimes I want the log to the server to be different from what is reported to the user as an error
        if (log) console.error('ERROR:', log);
    },

    success: function(status_code, payload, content_type = 'application/json') {
        this.status_code = status_code;
        this.payload = payload;
        this.content_type = content_type;
    }
};

server.on('request', (req, res) => 
{ 
    // Allowed chars: a-z, A-Z, 0-9, -, ., _, ~, :, /, ?, #, [, ], @, !, $, &, ', (, ), *, +, ,, ;, =
    const url_str = req.url.replace(/[^a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]/g, '');
    const url_obj = new URL(url_str, 'http://localhost:' + PORT);
    
    const trimmed_path = url_obj.pathname.replace(/^\/+|\/+$/g, '');

    debuglog(`${req.method} /${trimmed_path}`);

    const decoded_buffer = [];
    let buffer_size = 0;
    let f_abort = false;

    req.on('data', buffer => 
    {
        if (f_abort) return;

        buffer_size += buffer.length;
        if (buffer_size > MAX_BUFFER_SIZE)
        {
            const msg = trimmed_path === 'api/msg' ? 'Msg too big' : 'Content too large';
            
            res_obj.status_code = 413;
            res_obj.payload = { Error: `${msg}. Exceeded ${MAX_BUFFER_SIZE} bytes.` };
            
            write_res(res, res_obj);

            f_abort = true;
            return;
        }

        decoded_buffer.push(decoder.write(buffer));
    });

    req.on('end', async () => 
    {
        if (f_abort) return;

        decoded_buffer.push(decoder.end());

        const req_data = {
            'path': trimmed_path,
            'search_params': new URLSearchParams(url_obj.searchParams),
            'method': req.method,
            // 'headers': req.headers,
            'payload': decoded_buffer.join('')
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
                await hdl_get_read_msg_page(req_data, res_obj);
                break;
            case 'write-letter':
                await hdl_get_write_msg_page(req_data, res_obj);
                break;
            case 'write-reply':
                await hdl_get_write_reply_page(req_data, res_obj);
                break;
            case 'api/msg':
                await hdl_msg(req_data, res_obj);
                break;
            case 'api/msg/page':
                await hdl_get_msgs_page(req_data, res_obj);
                break;
            case 'api/msg/get-all':
                await hdl_get_msgs_all(req_data, res_obj);
                break;
            default:
                await hdl_get_asset(req_data, res_obj);
            }

        } catch (error) {
            res_obj.error(500, 'An unexpected error has occured in the server.', 'application/json');
            console.error(error);
            console.error('req_data:', req_data);
        }

        write_res(res, res_obj);
    });
});

function write_res(res, res_obj) 
{
    const payload = res_obj.content_type === 'application/json' ? JSON.stringify(res_obj.payload) : res_obj.payload;

    res.strictContentLength = true;
    res.writeHead(res_obj.status_code, {
        'Content-Length': Buffer.byteLength(payload),
        'Content-Type': res_obj.content_type,
        // 'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
    });

    res.end(payload);
}

function shutdown_server(signal) {
    console.log(`\nINFO: Shutting down. Signal ${signal}.`);
    server.close(() => {
        console.log('INFO: The server has been shut down.');
        db_close();
        console.log('INFO: Database connection closed.');
        process.exit(128 + signal);
    });
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

server.listen(PORT);
