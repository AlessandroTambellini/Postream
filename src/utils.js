import * as path from "node:path";
import crypto from 'node:crypto';
import { parseEnv } from 'node:util';

import { readFile } from "node:fs/promises";

const { createHmac } = await import('node:crypto');
const env = await read_env_file();

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
    return createHmac('sha256', env.HASHING_SECRET)
        .update(password)
        .digest('hex');
}

function log_error(error)
{
    const ROOT = path.join(import.meta.dirname, '..', '/');

    const error_lines = error.stack.split('\n');

    const code_stack = [];
    error_lines.forEach(line => {
        if (line.includes('file://')) {
            line = line.replace(`file://${ROOT}`, '');
            code_stack.push(line);
        }
    });

    console.error('ERROR: ', error.message + '\n' + code_stack.join('\n'));
}

async function read_env_file()
{
    const filepath = path.join(import.meta.dirname, '..', '.env');

    const { file_content: env_content, fs_error } = await read_file(filepath);

    if (fs_error)
        log_error(fs_error);

    return parseEnv(env_content);
}

async function read_file(filepath, encoding = 'utf8')
{
    let file_content = null, fs_error = null;
    try {
        file_content = await readFile(filepath, { encoding });
    } catch (error) {
        fs_error = error;
    }

    return { file_content, fs_error };
}

export {
    env,
    hash_password,
    generate_password,
    log_error,
    read_file,
};
