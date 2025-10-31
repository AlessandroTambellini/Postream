import { log_error } from "./utils.js";

/* Little Unimportant Note: for the name of objects I use snake_case,
but in this case I used the camelCase to reflect the browser API convention
given I find this object related to it. */
const DOMElements = {};

DOMElements['.post-card'] = function(post, reply_link_type = 0, cut_post_content = false)
{
    const { id, content, created_at } = post;

    const post_card = [
        `<article id='post-card-${id}' data-post-id=${id} class="card post-card">`,
            '<p>',
    ];

    /* ~(Half a page of a book) */
    const MAX_CHARS_PER_POST_PREVIEW = 55*20;

    if (cut_post_content && content.length > MAX_CHARS_PER_POST_PREVIEW)
        post_card.push(content.substring(0, MAX_CHARS_PER_POST_PREVIEW) + `...<a href='/read-post?id=${id}'>Read-Entirely</a>`);
    else
        post_card.push(content);

    post_card.push('</p>');
    post_card.push(`<time datetime="${created_at}"></time>`);

    /* The first type of link has the only purpose of keeping the id for the sorting of the posts (e.g. in the index page),
    but it doesn't cover any role as a link per se. */
    const reply_link_types = [
        `<a href='#id=${id}' style="display: none;"></a>`,
        `<a href='/read-post?id=${id}#replies-container'>Read-Replies</a>`,
        `<a href='/write-reply?id=${id}'>Reply</a>`
    ];

    const footer = [];
    if (reply_link_type === 0)
        footer.push(reply_link_types[reply_link_type]);
    else {
        footer.push('<footer>', reply_link_types[reply_link_type]);
        if (reply_link_type === 1)
            footer.push(`<button type='button' data-post-id=${id} class='delete-post-btn secondary-btn'>Delete Post</button>`);
        footer.push('</footer>');
    }

    post_card.push(footer.join(''));
    post_card.push('</article>');

    return post_card.join('');
}

DOMElements['.reply-card'] = function(reply)
{
    const { id, content, created_at } = reply;

    return (
        `<article id='reply-${id}' class='card reply-card'>` +
            `<p>${content}</p>` +
            `<time datetime="${created_at}"></time>` +
        `</article>`
    );
}

DOMElements['.notification-card'] = function(notification)
{
    const { id, post_id, post_content, first_new_reply_id, num_of_replies } = notification;

    const post_content_snapshot = post_content.length > 70 ? post_content.substring(0, 70) + '...' : post_content;

    return (
        `<article id='notification-card-${id}' class='card notification-card'>` +
            `<p><b>${num_of_replies} new ${num_of_replies === 1 ? 'reply' : 'replies'} for: </b>"${post_content_snapshot}"</p>` +
            `<footer>` +
                `<a href='/read-post?id=${post_id}#reply-${first_new_reply_id}'>Read-${num_of_replies === 1 ? 'Reply' : 'Replies'}</a>` +
                `<button type='button' data-notification-id=${id} class='delete-notification-btn secondary-btn'>Delete</button>` +
            `</footer>` +
        `</article>`
    );
}

DOMElements['.profile-picture'] = function(max_num_of_circles, picture_size)
{
    const num_of_circles = Math.max(20, Math.ceil(Math.random() * max_num_of_circles));

    const pick_color = () => Math.floor(Math.random() * 256);
    const pick_circle_size = () => Math.max(10, Math.floor(Math.random() * (picture_size/2.5)));

    const picked_positions = new Set();
    const pick_pos = () => {
        let pos = Math.floor(Math.random() * picture_size);
        // To distribute a bit the circles to not have them too near.
        if (pos % 2 !== 0) pos += 1;
        return pos;
    };

    const circles = new Array(num_of_circles);
    for (let i = 0; i < num_of_circles; i++)
    {
        let top = pick_pos();
        let left = pick_pos();
        while (picked_positions.has(`${top},${left}`)) {
            top = pick_pos();
            left = pick_pos();
        }
        picked_positions.add(`${top},${left}`);

        circles.push(
            `<span class='circle' style="` +
                `background: radial-gradient(circle at 50% 50%, var(--clr-ff), rgb(${pick_color()}, ${pick_color()}, ${pick_color()}));` +
                `width: ${pick_circle_size()}px;` +
                /* It may happen that all the circles remain outside the 'circular window',
                but I bet on the probability and so I don't care. */
                `top: ${top}px;` +
                `left: ${left}px;">` +
            `</span>`
        );
    }

    return `<span class="profile-picture" role="img">${circles.join('')}</span>`;
};

DOMElements['#side-panel'] = function(logged_in, page = '')
{
    let menu_entries = logged_in ?
        ['index', 'notifications', 'write-post', 'logout'] :
        ['index', 'login', 'create-account'];

    menu_entries = menu_entries.filter(entry => entry !== page);
    if (page === 'profile') menu_entries.push('delete-account');

    const side_panel = (
        `<aside id='side-panel'>` +

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
                (logged_in && page !== 'profile' ?
                    `<li itemprop="profile">` +
                        `<a href="/profile">` +
                            `${DOMElements['.profile-picture'](45, 60)}` +
                        `</a>` +
                    `</li>` : '')
                +
                (menu_entries.reduce((accumulator, page) => {
                    return accumulator + (
                        `<li itemprop="${page}">` +
                            `<a href="/${page}">${page}</a>` +
                        `</li>`
                    );
                }, '')) +
            `</menu>` +

            `<nav id='secondary-links-menu'>` +
                `<a href='/test-elements'>Test-Elements</a>` +
                `<a href='/logo'>Logo</a>` +
            `</nav>` +
        `</aside>`
    );

    const show_side_panel_btn = (
        `<button id="show-side-panel-btn" aria-label='show side-panel' class='display-block'>` +
            `<span role='img' alt='show side-panel icon'>〈</span>` +
        `</button>`
    );

    return side_panel + show_side_panel_btn;
}

DOMElements['.info-msg'] = function(msg)
{
    return `<p class='info-msg'>${msg}</p>`;
}


/* fallback_page may be called in case I'm not able to load the wanted page from disk using readFile()
(but not only for that).
Therefore, I don't store this page as an HTML file because
I would have to read it from disk and potentially have the same issue. */
function fallback_page(status_code, custom_msg)
{
    const statuses = {
        401: {
            reason: 'Unauthorized Access',
            msg: "You cannot access the content of this page because you are logged out. " +
                "Please, <a href='/login'>Login</a> or <a href='/create-account'>Create-Account</a>."
        },
        404: {
            reason: 'Not Found',
            msg: "The resource you requested to access doesn't exist. "
        },
        500: {
            reason: 'Server Error',
            msg: "There has been un unknown error in the server. " +
                "Please, consider changing website because its developer is really bad."
        },
    };

    if (!statuses[status_code]) {
        log_error(new Error(`The status code ${status_code} isn't defined in 'statuses'`));
        status_code = 500;
    }

    if (custom_msg) statuses[status_code].msg = custom_msg;
    const { reason, msg } = statuses[status_code];

    return (
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
                DOMElements['.info-msg'](msg) +
            `</main>` +

            DOMElements['#side-panel'](false) +
        `</body>` +
        `</html>`
    );
}

export {
    DOMElements,
    fallback_page,
};
