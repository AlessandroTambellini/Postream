import { log_error } from "./utils.mjs";

/* Little Unimportant Note: for the name of objects I use snake_case, 
but in this case I used the camelCase to reflect the Browser API convention 
given I find this object related to it. */
const DOMElements = {};

DOMElements['.post-card'] = function(post, reply_link_type = 0, cut_post_content = false)
{
    const { id, content, created_at } = post;

    /* Sometimes I don't want the reply link to be shown. 
    E.g. if you are the author of the post and you are simply visualizing it in the profile page
    (even though, you can reply to your own posts) */
    const reply_link_types = ['', `<a href='/read-post?id=${id}'>Read-Replies</a>`, `<a href='/write-reply?id=${id}'>Reply</a>`];    

    const post_card = 
        `<article id='post-card-${id}' class="card post-card">` +
            `<p>` + 
                `${cut_post_content && content.length > 70*10 ? 
                    content.substring(0, 70*10) + `...<a href='/read-post?id=${id}'>Read-Entirely</a>` : 
                    content}` +
            `</p>` +
            `<time datetime="${created_at}"></time>` +
            `<footer>` +
                `${reply_link_types[reply_link_type]}` +
                `${reply_link_type === 1 ? 
                    `<button type='button' id='post-${id}' class='delete-post-btn secondary-btn'>Delete</button>` : ''}` +
            `</footer>` +
        `</article>`
    ;

    return post_card;
}

DOMElements['.reply-card'] = function(reply)
{
    const { id, content, created_at } = reply;

    const reply_card = 
        `<article id='reply-${id}' class='card reply-card'>` +
            `<p>${content}</p>` + 
            `<time datetime="${created_at}"></time>` +
        `</article>`
    ;

    return reply_card;
}

DOMElements['.notification-card'] = function(notification)
{
    const { id, post_id, post_content_snapshot, first_new_reply_id, num_of_replies } = notification;

    const notification_card = 
        `<article id='notification-card-${id}' class='card notification-card'>` +
            `<p><b>${num_of_replies} new reply(s) for:</b> "${post_content_snapshot}..."</p>` +
            `<footer>` +
                `<a href='/read-post?id=${post_id}#reply-${first_new_reply_id}'>Read-Reply</a>` +
                `<button type='button' id='notification-${id}' class='delete-notification-btn secondary-btn'>Delete</button>` +
            `</footer>` +
        `</article>`
    ;

    return notification_card;
}

DOMElements['#profile-picture'] = function(max_num_of_circles, size)
{
    const rand_int = (max) => Math.floor(Math.random() * max + 1);

    const num_of_circles = Math.max(20, rand_int(max_num_of_circles));

    let circles = [];
    for (let i = 0; i < num_of_circles; i++)
    {
        circles.push(
            `<span class='circle' style="` +
                `width: ${rand_int(size/2.5)}px;` +
                `background-color: rgb(${rand_int(256)}, ${rand_int(256)}, ${rand_int(256)});` +
                `top: ${rand_int(size/10*9)}px;` +
                `left: ${rand_int(size/10*9)}px;">` +
            `</span>`
        );
    }

    return `<span id="profile-picture" role="img">${circles.join('')}</span>`;
};

DOMElements['#side-panel'] = function(logged_in, page)
{
    let menu_entries = logged_in ? 
        ['index', 'notifications', 'write-post', 'logout'] : 
        ['index', 'login', 'create-account'];

    menu_entries = menu_entries.filter(entry => entry !== page);
    if (page === 'profile') menu_entries.push('delete-account');

    const side_nav = 
        `<aside id='side-panel'>` + // class="display-none"

            `<button id="moon-mode-btn" aria-label='toggle moon-mode'>` +
                `<span id="moon-icon" role="img" alt='moon icon'>` +
                    `<span id="moon"></span>` +
                    `<span id="sky"></span>` +
                `</span>` +
            `</button>` +

            `<button id="sun-mode-btn" aria-label='toggle sun-mode'>` +
                `<span id="sun-icon" role="img" alt='sun icon'>` +
                    `<span class="ray"></span>` +
                    `<span class="ray"></span>` +
                    `<span class="ray"></span>` +
                    `<span class="ray"></span>` +
                    `<span id="sun"></span>` +
                `</span>` +
            `</button>` +

            `<script>` +
                `const sun_mode_btn = document.querySelector('#sun-mode-btn');` +
                `const moon_mode_btn = document.querySelector('#moon-mode-btn');` +

                `if (light_mode === 'moon-mode') {` +
                    `sun_mode_btn.classList.add('display-flex');` +
                    `moon_mode_btn.classList.add('display-none');` +
                `} else {` +
                    `sun_mode_btn.classList.add('display-none');` +
                    `moon_mode_btn.classList.add('display-block');` +
                `}` +
            `</script>` +

            `<menu>` +
                `${(logged_in && page !== 'profile') ? 
                    `<li itemprop="profile">` +
                        `<a href="/profile">` +
                            `${DOMElements['#profile-picture'](50, 70)}` +
                        `</a>` +
                    `</li>` : ''}` +
                `${menu_entries.reduce((accumulator, page) => {
                    return accumulator +
                        `<li itemprop="${page}">` + 
                            `<a href="/${page}">${page}</a>` +
                        `</li>`;
                }, '')}` +
            `</menu>` +
        `</aside>`
    ;

    const show_side_nav_btn = 
        `<button id="show-side-panel-btn" aria-label='show side-panel' class='display-block'>` +
            `<span role='img' alt='show side-panel icon'>〈</span>` +
        `</button>`
    ;

    return side_nav + show_side_nav_btn;
}

DOMElements['.info-msg'] = function(msg) 
{
    return `<p class='info-msg'>${msg}</p>`
}


/* fallback_page may be called (but not only) in case I'm not able to load the wanted page from disk using readFile().
Therefore, I don't store this page as an HTML file because 
I would have to read it from disk and potentially have the same issue. */
function fallback_page(status_code, custom_msg)
{
    const statuses = {
        401: {
            reason: 'Unauthorized Access',
            msg: custom_msg ? custom_msg : "You cannot access the content of this page because you are logged out. " + 
                "Please, <a href='/login'>Login</a> or <a href='/create-account'>Create-Account</a> :)"
        },
        500: {
            reason: 'Server Error',
            msg: "There has been un unknown error in the server. " +
                "Please, consider changing website because the developer is really bad."
        },
    };

    if (!statuses[status_code]) {
        try {
            // I want the stack trace to see WHO sent this status_code 
            throw new Error(`There isn't a status code '${status_code}' in statuses`);
        } catch (error) {
            log_error(error);
        }
        status_code = 500;
    }

    const { reason, msg } = statuses[status_code];

    const page =
        `<!DOCTYPE html>` +
        `<html lang="en">` +
        `<head>` +
            `<meta charset="UTF-8">` +
            `<meta name="viewport" content="width=device-width, initial-scale=1.0">` +
            `<meta name="description" content="Redirection page for ${reason}">` +

            `<title>Page ${status_code}</title>` +

            `<link rel="icon" type="image/webp" href="../assets/logo.webp">` +
            `<link rel="stylesheet" href="../stylesheets/_universal.css">` +
            `<script type="module" src="../scripts/_universal.js"></script>` +

            `<style> ` +
                `h1 {` +
                    `text-align: center;` +
                `}` +
            `</style>` +
        `</head>` +
        `<body>` +
            `<script>` +
                `const light_mode = localStorage.getItem('light-mode');` +
                `if (light_mode === 'moon-mode')` +
                `{` +
                    `document.querySelector('html').classList.add('moon-mode');` +
                `}` +
            `</script>` +
            
            `<main>` +
                `<h1>${reason} | ${status_code}</h1>` +
                `${DOMElements['.info-msg'](msg)}` +
            `</main>` +

            `${DOMElements['#side-panel'](false, 'fallback-page')}` +
        `</body>` +
        `</html>`
    ;

    return page;
}

export {
    DOMElements,
    fallback_page,
};
