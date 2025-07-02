import { appendFile, readFile } from "fs/promises";

const MESSAGES_FILE_PATH = 'server/messages';

let new_messages = [];

export async function store_msg(msg)
{
    try {
        new_messages.push(msg);
        if (new_messages.length > 0) // TODO testing
        {
            const new_messages_JSON = JSON.stringify(new_messages);
            await appendFile(MESSAGES_FILE_PATH, ',' + new_messages_JSON.slice(1, new_messages_JSON.length-1));
            new_messages = [];
        }
        return { 'Success': 'Msg stored.' };
    } catch (error) {
        return { Error: `Can't store msg: ${error.message}.` };
    }
}

export async function retrieve_all_messages()
{
    try {
        let messages_str = await readFile(MESSAGES_FILE_PATH, { encoding: 'utf8' });
        messages_str += ']'
        try {
            const messages_arr = JSON.parse(messages_str);
            return messages_arr;
        } catch (error) {
            return { Error: `Invalid JSON for messages_str: ${error.message}` };
        }
    } catch (error) {
        return { Error: `Can't retrieve messages from disk: ${error.message}.` };
    }
}
