import { createServer } from 'node:http';
import { StringDecoder } from 'node:string_decoder';
import { debuglog } from 'node:util';
import { get_home_page, get_asset } from './handlers.mjs';

const PORT = 3000;

const log = debuglog('server');
const decoder = new StringDecoder('utf8');

const server = createServer();

server.on('request', (req, res) => 
{ 
    // Sanitize the url: https://datatracker.ietf.org/doc/html/rfc3986
    console.log('recv url:', req.url);
    const url = req.url.replace(/[^a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]/g, '');
    const url_obj = new URL(url, 'http://localhost:' + PORT);
    const trimmed_pathname = url_obj.pathname.replace(/^\/+|\/+$/g, '');

    const decoded_buffer = [];

    req.on('data', buffer => {
        decoded_buffer.push(decoder.write(buffer));
    });

    req.on('end', async () => {
        decoded_buffer.push(decoder.end());
        const str_buffer = decoded_buffer.join('');

        const req_data = {
            'trimmed_pathname': trimmed_pathname,
            'search_params': new URLSearchParams(url_obj.searchParams),
            'method': req.method,
            // 'headers': req.headers,
            'payload': str_buffer
        };

        const res_data = {
            'content_type': 'application/json',
            'status_code': 500,
            'payload': {}
        };

        try {
            // Router
            switch (trimmed_pathname) {
            case 'ping':
                // Test request
                res_data.status_code = 200;
                res_data.payload = 'pong';
                break;
            case '':
                await get_home_page(req_data.method, res_data);
                break;
            default:
                await get_asset(req_data, res_data);
            }
        } catch (error) {
            res_data.content_type = 'application/json';
            res_data.status_code = 500;
            res_data.payload = { 'Error': 'Un unknown error has occured.' };
            console.error(error);
            console.error('Request data:', req_data);
        }

        if (res_data.status_code === 405) {
            /* The error msg is always the same for the 405 status code so,
            I write it just once, instead of repeating it for each handler. */
            res_data.payload = { 'Error': `The method '${req_data.method}' is not allowed.` };
        }

        const payload_string = res_data.content_type === 'application/json' ? JSON.stringify(res_data.payload) : res_data.payload;

        res.strictContentLength = true;
        res.writeHead(res_data.status_code, {
            'Content-Length': Buffer.byteLength(payload_string),
            'Content-Type': res_data.content_type,
        });
        res.end(payload_string);

        log(`${req.method} /${trimmed_pathname} ${res_data.status_code}`);
    });
});

server.on('listening', () => {
    console.log(`[INFO] Server started on http://localhost:${PORT}`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.log('[WARN] Address in use, retrying...');
        setTimeout(() => {
            server.close();
            server.listen(PORT);
        }, 1000);
    } else {
        console.error('[ERROR] While trying to start the server:', e.message);
    }
});

server.on('close', () => {
    console.log('[INFO] Server has been closed.');
});

server.listen(PORT);
