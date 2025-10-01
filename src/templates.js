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
    const reply_link_types = ['', `<a href='read-post?id=${id}'>Read-Replies</a>`, `<a href='write-reply?id=${id}'>Reply</a>`];    

    return `
        <article id='post-card-${id}' class="card post-card">
            <p>${cut_post_content && content.length > 70*10 ? 
                content.substring(0, 70*10) + `...<a href='read-post?id=${id}'>Read-Entirely</a>` : 
                content}</p>
            <time datetime="${created_at}">${prettify_date(created_at)}</time>
            <footer>
                ${reply_link_types[reply_link_type]}
                ${reply_link_type === 1 ? 
                    `<button type='button' id='post-${id}' class='delete-post-btn secondary-btn'>Delete</button>` : ''}
            </footer>
        </article>
    `;
}

DOMElements['.reply-card'] = function(reply)
{
    const { id, content, created_at } = reply;

    return `
        <article id='reply-${id}' class='card reply-card'>
            <p>${content}</p>
            <time datetime="${created_at}">${prettify_date(created_at)}</time>
        </article>
    `;
}

DOMElements['.notification-card'] = function(notification)
{
    const { id, post_id, post_content_snapshot, first_new_reply_id, num_of_replies } = notification;

    return `
        <article id='notification-card-${id}' class='card notification-card'>
            <p><b>${num_of_replies} new reply(s) for:</b> "${post_content_snapshot}..."</p>
            <footer>
                <a href='read-post?id=${post_id}#reply-${first_new_reply_id}'>Read-Reply</a>
                <button type='button' id='notification-${id}' class='delete-notification-btn secondary-btn'>Delete</button>
            </footer>
        </article>
    `;
}

DOMElements['#profile-picture'] = function(max_num_of_circles, size)
{
    const rand_int = (max) => Math.floor(Math.random() * max + 1);

    const num_of_circles = Math.max(20, rand_int(max_num_of_circles));

    let circles = [];
    for (let i = 0; i < num_of_circles; i++)
    {
        circles.push(`
            <span class='circle' style="
                width: ${rand_int(size/2.5)}px; 
                background-color: rgb(${rand_int(256)}, ${rand_int(256)}, ${rand_int(256)}); 
                top: ${rand_int(size/10*9)}px; 
                left: ${rand_int(size/10*9)}px;"
            ></span>`);
    }

    return `
        <span id="profile-picture" role="img">${circles.join('')}</span>
    `;
};

DOMElements['#side-nav'] = function(logged_in, page)
{
    let menu_entries = logged_in ? 
        ['index', 'notifications', 'write-post', 'logout'] : 
        ['index', 'login', 'create-account'];

    menu_entries = menu_entries.filter(entry => entry !== page);
    if (page === 'profile') menu_entries.push('delete-account');

    const side_nav = `
        <nav id='side-nav' class="display-none">
            <menu>
                ${(logged_in && page !== 'profile') ? 
                    `<li itemprop="profile">
                        <a href="profile">
                            ${DOMElements['#profile-picture'](50, 70)}
                        </a>
                    </li>` : ''}
                ${menu_entries.reduce((accumulator, page) => {
                    return accumulator + `
                        <li itemprop="${page}">
                            <a href="${page}">${page}</a>
                        </li>
                    `;
                }, '')}
            </menu>
            <button id='minify-nav-btn' aria-label='minify nav' class='display-block'>
                <span role='img' alt='minify nav'>〈</span>
            </button>
            <button id='expand-nav-btn' aria-label='expand nav' class='display-none'>
                <span role='img' alt='expand nav'>〉</span>
            </button>
        </nav>
    `;

    // Otherwise the button is too high
    while (menu_entries.length > 3) menu_entries.pop();

    const open_side_nav_btn = `
        <button id="open-side-nav-btn" class="secondary-btn display-block" aria-label='open side-nav'>
            <span role='img' alt='open side-nav icon'>
                ${menu_entries.reduce((accumulator, page) => {
                    return accumulator + `
                        <span itemprop=${page}>
                            <span class='bullet'></span><span class='row'></span>
                        </span>
                    `;
                }, '')}
            </span>
        </button>
    `;

    return side_nav + open_side_nav_btn;
}

DOMElements['.info-msg'] = function(msg) 
{
    return `<p class='info-msg'>${msg}</p>`
}


/* fallback_page may be called (but not only) in case I'm not able to load the wanted page from disk using readFile().
Therefore, I don't store this page as an HTML file because 
I would have to read it from disk and potentially have the same issue. */
function fallback_page(status_code)
{
    let reason, msg;

    if (status_code === 500) {
        reason = 'Server Error';
        msg = `There has been un unknown error in the server. 
            Please, consider changing website because the developer is really bad.`;
    } 
    else if (status_code === 401) {
        reason = 'Unauthorized Access';
        msg = `You cannot access the content of this page because you are logged out. 
            Please, <a href='login'>Login</a> or <a href='create-account'>Create-Account</a> :)`
    }

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="description" content="Redirection page for ${reason}">
            
            <title>Page ${status_code}</title>
            
            <link rel="icon" type="image/webp" href="../assets/logo.webp">
            <link rel="stylesheet" href="../stylesheets/_universal.css">
            <script type="module" src="../scripts/_universal.js"></script>

            <style> 
                h1 {
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <main>
                <h1>${reason} | ${status_code}</h1>
                ${DOMElements['.info-msg'](msg)}
            </main>

            ${DOMElements['#side-nav'](false, 'fallback-page')}
        </body>
        </html>
    `;
}

function prettify_date(date) 
{
    const week_days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [0, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const week_day = new Date(date).getDay();
    const [year_time, day_time] = date.split(', ');
    const [month, day, year] = year_time.split('/');

    const [clock_time, am_pm] = day_time.split(' ');
    const [hour, mins, secs] = clock_time.split(':');

    return `${week_days[week_day]}, ${day} ${months[month]} ${year}, ${hour}:${mins} ${am_pm}`;
}

export {
    DOMElements,
    fallback_page,
};
