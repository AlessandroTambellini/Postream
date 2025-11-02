import * as path from "node:path";
import crypto from 'node:crypto';
import { env } from 'node:process';
import { readFile } from "node:fs/promises";
const { createHmac } = await import('node:crypto');

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

function hash_password(password, f_log_error = false)
{
    let password_hash = null, hash_error = null;
    try {
        password_hash = createHmac('sha256', env.HASHING_SECRET)
            .update(password)
            .digest('hex');
    } catch (error) {
        hash_error = true;
        f_log_error && log_error(error);
    }

    return { password_hash, hash_error };
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

async function read_file(filepath, encoding = 'utf8', f_log_error = false)
{
    let file_content = null, fs_error = null;
    try {
        file_content = await readFile(filepath, { encoding });
    } catch (error) {
        fs_error = error;
        f_log_error && log_error(error);
    }

    return { file_content, fs_error };
}

export {
    hash_password,
    generate_password,
    log_error,
    read_file,
};
