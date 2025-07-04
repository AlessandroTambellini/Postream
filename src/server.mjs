import { createServer } from 'node:http';
import { StringDecoder } from 'node:string_decoder';
import { debuglog as _debuglog } from 'node:util';

import { 
    hdl_get_home_page, 
    hdl_get_asset, 
    hdl_handle_msg, // TODO change this name
    hdl_get_all_messages, 
    hdl_get_messages_page 
} from './handlers.mjs';

import { db_close } from './database.mjs';

const PORT = 3000;

const debuglog = _debuglog('server');
const decoder = new StringDecoder('utf8');

const server = createServer();

server.on('request', (req, res) => 
{ 
    // Sanitize the url: https://datatracker.ietf.org/doc/html/rfc3986
    const url = req.url.replace(/[^a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]/g, '');
    const url_obj = new URL(url, 'http://localhost:' + PORT);
    const trimmed_pathname = url_obj.pathname.replace(/^\/+|\/+$/g, '');

    const decoded_buffer = [];

    req.on('data', buffer => {
        decoded_buffer.push(decoder.write(buffer));
    });

    req.on('end', async () => 
    {
        decoded_buffer.push(decoder.end());
        const str_buffer = decoded_buffer.join('');

        const req_data = {
            'pathname': trimmed_pathname,
            'search_params': new URLSearchParams(url_obj.searchParams),
            'method': req.method,
            // 'headers': req.headers,
            'payload': str_buffer
        };

        const res_data = {
            content_type: 'application/json',
            status_code: 500,
            payload: {}
        };

        try {
            // Router
            switch (req_data.pathname) {
            case 'ping':
                // Test request
                res_data.status_code = 200;
                res_data.payload = 'pong';
                break;
            case '':
                await hdl_get_home_page(req_data.method, res_data);
                break;
            case 'api/msg':
                await hdl_handle_msg(req_data, res_data);
                break;
            case 'api/msg/page':
                await hdl_get_messages_page(req_data, res_data);
                break;
            // Not used by the web interface
            case 'api/msg/get-all':
                await hdl_get_all_messages(req_data.method, res_data);
                break;
            default:
                await hdl_get_asset(req_data, res_data);
            }
        } catch (error) {
            res_data.content_type = 'application/json';
            res_data.status_code = 500;
            res_data.payload = { Error: 'Un unknown error has occured in the server.' };
            console.error(error);
            console.error('req_data:', req_data);
        }

        if (res_data.status_code === 405) {
            /* The error msg is always the same for the 405 status code so,
            I write it just once, instead of repeating it for each handler. */
            res_data.payload = { Error: `The method '${req_data.method}' is not allowed.` };
        }

        const payload = res_data.content_type === 'application/json' ? 
            JSON.stringify(res_data.payload) : res_data.payload;

        res.strictContentLength = true;
        res.writeHead(res_data.status_code, {
            'Content-Length': Buffer.byteLength(payload),
            'Content-Type': res_data.content_type,
        });
        res.end(payload);

        debuglog(`${req_data.method} /${req_data.pathname} ${res_data.status_code}`);
    });
});

server.on('listening', () => {
    console.log(`[INFO] Server started on http://localhost:${PORT}`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.log('WARN: Address in use, retrying.');
        setTimeout(() => {
            server.close();
            server.listen(PORT);
        }, 1000);
    } else {
        console.error('ERROR: While trying to start the server:', e.message);
    }
});

process.on('SIGHUP', () => shutdown_server(128 + 1));
process.on('SIGINT', () => shutdown_server(128 + 2));
process.on('SIGTERM', () => shutdown_server(128 + 15));

function shutdown_server(exit_code) {
    console.log(`\nINFO: Shutting down. Exit code ${exit_code}.`);
    server.close(() => {
        console.log('INFO: The server has been shut down.');
        db_close();
        console.log('INFO: Database connection closed.');
        process.exit(128 + exit_code);
    });
}

server.listen(PORT);
