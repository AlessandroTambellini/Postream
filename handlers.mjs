import { readFile } from "fs/promises";

export async function get_home_page(method, res_data) 
{
    if (method !== 'GET') {
        res_data.status_code = 405;
        return;
    }

    try {
        res_data.content_type = 'text/html';
        res_data.status_code = 200;
        res_data.payload = await readFile('index.html', { encoding: 'utf8' });
    } catch (error) {
        res_data.status_code = 500;
        res_data.payload = { 'Error': 'Unable to read HTML page from disk.' };
        console.log(error.message);
    }
}

export async function get_asset(req_data, res_data) 
{
    if (req_data.method !== 'GET') {
        res_data.status_code = 405;
        return;
    }

    const asset_path = req_data.trimmed_pathname;

    const file_ext_idx = asset_path.lastIndexOf('.');
    if (file_ext_idx < 1 || file_ext_idx === asset_path.length-1) {
        res_data.status_code = 404;
        // I leave this msg generic, because I have no certanty the client wanted to request an asset.
        // The server router switches to load an asset as default if no other known path is matched.
        res_data.payload = { 'Error': `The path '${asset_path}' is invalid.` };
        return;
    }

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
        default:
            res_data.status_code = 404;
            res_data.payload = { 'Error': `There is no asset with the extension '${file_ext}'.` };
            break;
    }

    try {
        res_data.status_code = 200;
        // No need to sanitize the path. Already done at the server level and, in some cases, also at the browser level
        res_data.payload = await readFile(asset_path, { encoding: 'utf8' });;
    } catch (error) {
        res_data.content_type = 'application/json';
        if (error.code === 'ENOENT') {
            res_data.status_code = 404;
            res_data.payload = { 'Error': `The asset '${asset_path}' does not exist.` };
        } else {
            res_data.status_code = 500;
            res_data.payload = { 'Error': `Un unknown error has occured while trying to read '${asset_path}' from disk.` };
            console.log(error.message);
        }
    }
}
