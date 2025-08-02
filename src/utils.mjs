import { readFile } from "node:fs/promises";
import { join } from "node:path";
import crypto from 'node:crypto';
import 'dotenv/config';

const { createHmac } = await import('node:crypto');

const WEB_INTERFACE_PATH = join(import.meta.dirname, 'web_interface');

function JSON_to_obj(json, f_log_error = false)
{
    let obj = null, JSON_error = null;
    try {
        obj = JSON.parse(json);
    } catch (error) {
        JSON_error = error.message;
        f_log_error && log_error(error);
    }

    return { obj, JSON_error };
}

function generate_password()
{
    const PASSWORD_LEN = 20;

    const numbers = new Uint32Array(PASSWORD_LEN);
    crypto.getRandomValues(numbers);

    const symbols = `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,;.:-_[]+*@#°'?^!"$%&()=`;

    const password = new Array(PASSWORD_LEN);
    for (let i = 0; i < PASSWORD_LEN; i++) {
        password[i] = symbols.charAt(numbers[i] % symbols.length);
    }

    return password.join('');
}

function hash_password(password) 
{
    return createHmac('sha256', process.env.HASHING_SECRET)
        .update(password)
        .digest('hex');
}

async function read_HTML_page(page_name) 
{
    let page = null, fs_error = null;
    
    let page_path = null;
    try {
        page_path = join(WEB_INTERFACE_PATH, `${page_name}.html`);
    } catch (error) {
        fs_error = `The path '${WEB_INTERFACE_PATH}/${page_name}.html' doesn't exist`;
        log_error(error);    
        return { page, fs_error };    
    }
    
    try {
        page = await readFile(page_path, { encoding: 'utf8' });        
    } catch (error) {
        fs_error = `Unable to read '${page_path}' from disk`;
        log_error(error);
    }

    return { page, fs_error };
}

function log_error(error)
{
    const ROOT = join(import.meta.dirname, '..', '/');

    const error_lines = error.stack.split('\n');
    
    const code_stack = [];
    error_lines.forEach(line => {
        if (line.includes('file://')) {
            line = line.replace(`file://${ROOT}`, '');
            code_stack.push(line);
        }
    });

    console.error('Error:', error.message + '\n' + code_stack.join('\n'));
}

export {
    JSON_to_obj,
    hash_password,
    read_HTML_page,
    generate_password,
    log_error,
};
