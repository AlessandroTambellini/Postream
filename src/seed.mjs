import { db_op } from "./database.mjs";
import { generate_password, hash_password } from "./utils.mjs";

const lorem_ipsum = 
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." +
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat." +
    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur." +
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum"
;

const Google_Chrome = `Google Chrome is a cross-platform web browser developed by Google. 
It was first released in 2008 for Microsoft Windows, 
built with free software components from Apple WebKit and Mozilla Firefox.
Versions were later released for Linux, macOS, iOS, iPadOS, and also for Android, where it is the default browser.
The browser is also the main component of ChromeOS, on which it serves as the platform for web applications.

Most of Chrome's source code comes from Google's free and open-source software project Chromium, 
but Chrome is licensed as proprietary freeware. 
WebKit was the original rendering engine, but Google eventually forked it to create the Blink engine;
all Chrome variants except iOS used Blink as of 2017.

As of September 2025, StatCounter estimates that Chrome has a 71.77% worldwide browser market share 
(after peaking at 72.38% in November 2018) on personal computers (PC),[19] is most in use on tablets (having surpassed Safari), 
and is also dominant on smartphones.[20][21] With a market share of 71.77%[22] across all platforms combined, 
Chrome is the most used web browser in the world today.[23]

Google chief executive Eric Schmidt was previously involved in the "browser wars" (a part of U.S. corporate history) 
and opposed the expansion of the company into such a new area. 
However, Google co-founders Sergey Brin and Larry Page spearheaded a software demonstration 
that pushed Schmidt into making Chrome a core business priority, which resulted in commercial success.[24] 
Because of the proliferation of Chrome, Google has expanded the "Chrome" brand name to other products. 
These include not just ChromeOS but also Chromecast, Chromebook, Chromebit, Chromebox, and Chromebase.`;

const list = `Here is what I think about you:
Pros:
* ...
* ...
* ...

Difects:
* ...
* ...

:)`;

const code = `Try to open the following page in a browser:

&lt;!DOCTYPE html&gt;
&lt;html lang="en"&gt;
&lt;head&gt;
    &lt;meta charset="UTF-8"&gt;
    &lt;meta name="viewport" content="width=device-width, initial-scale=1.0"&gt;
    &lt;title&gt;Document&lt;/title&gt;
&lt;/head&gt;
&lt;body&gt;
    &lt;script&gt;
        console.log('&lt;/script&gt;');
    &lt;/script&gt;
&lt;/body&gt;
&lt;/html&gt;`;

const firefox_releases = `Firefox Releases

144.0_
143.0_ 143.0.1 143.0.3 143.0.4
142.0_ 142.0.1
141.0_ 141.0.2 141.0.3
140.0_ 140.0.1 140.0.2 140.0.4 140.1.0 140.2.0 140.3.0 140.3.1 140.4.0 
139.0_ 139.0.1 139.0.4
138.0_ 138.0.1 138.0.3 138.0.4
137.0_
`;

function seed()
{
    const password1 = generate_password();
    console.log('user1 password:', password1);
    const user1_id = db_op.insert_user(hash_password(password1));

    const password2 = generate_password();
    console.log('user2 password:', password2);
    const user2_id = db_op.insert_user(hash_password(password2));

    const password3 = generate_password();
    console.log('user3 password:', password3);
    const user3_id = db_op.insert_user(hash_password(password3));

    let post_id;
    
    post_id = db_op.insert_post(user1_id, 'What do you think of DRM in a browser?');
    post_id = db_op.insert_post(user1_id, code);
    
    post_id = db_op.insert_post(user1_id, lorem_ipsum);
              db_op.insert_reply(post_id, 'Amen');
    
    post_id = db_op.insert_post(user2_id, 'The quick brown fox jumps over the lazy dog');
    post_id = db_op.insert_post(user2_id, 'What do you think of "Il Nome della Rosa?"');
    post_id = db_op.insert_post(user2_id, Google_Chrome);
    
    post_id = db_op.insert_post(user2_id, 'Write me anything you want');
              db_op.insert_reply(post_id, 'This, this and that');
              db_op.insert_reply(post_id, list);

    post_id = db_op.insert_post(user3_id, 'A blog I suggest: https://www.jwz.org/blog/');
    post_id = db_op.insert_post(user3_id, firefox_releases);
              db_op.insert_reply(post_id, 'So what? Is it a question');
              db_op.insert_reply(post_id, 'I don\'t get it. What do you want to say?');
}

seed();
