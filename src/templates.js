function prettify_date(date) 
{
    const week_days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [0, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const week_day = new Date(date).getDay();
    const [year_time, day_time] = date.split(', ')
    const [month, day, year] = year_time.split('/')

    const [clock_time, am_pm] = day_time.split(' ');
    const [hour, mins, secs] = clock_time.split(':');

    return `${week_days[week_day]}, ${day} ${months[month]} ${year}, ${hour}:${mins} ${am_pm}`;
}

const components = {};

components['.post-card'] = function(post, reply_link_type = false, cut_post_content = false)
{
    const { id, content, created_at } = post;

    /* Sometimes I don't want the reply link to be shown. 
    E.g. if you are the author of the post and you are simply visualizing it in the profile page
    (even though, you can reply to your own posts) */
    const reply_link_types = ['', `<a href='read-post?id=${id}'>Read Replies</a>`, `<a href='write-reply?id=${id}'>Reply</a>`];

    return `
        <article class="card post-card">
            <p>${cut_post_content && content.length > 70*10 ? 
                content.substring(0, 70*10) + `...<a href='read-post?id=${id}'>read entirely</a>` : 
                content}</p>
            <time datetime="${created_at}">${prettify_date(created_at)}</time>
            ${reply_link_types[reply_link_type]}
        </article>
    `;
}

components['.reply-card'] = function(reply)
{
    const { id, content, created_at } = reply;

    return `
        <article id='reply-${id}' class='card reply-card'>
            <p>${content}</p>
            <time datetime="${created_at}">${prettify_date(created_at)}</time>
        </article>
    `;
}

components['.notification-card'] = function(notification)
{
    const { id, post_id, post_content_snapshot, reply_id, created_at } = notification;

    return `
        <article id='notification-card-${id}' class='card notification-card'>
            <time datetime="${created_at}">${prettify_date(created_at)}</time>
            <p><b>New reply for:</b> ${post_content_snapshot}...</p>
            <footer>
                <a href='read-post?id=${post_id}#reply-${reply_id}'>Read Reply</a>
                <button type='button' id='notification-${id}' class='delete-notification-btn secondary-btn'>Delete</button>
            </footer>
        </article>
    `;
}

components['universal-resources'] = 
`
    <link rel="icon" type="image/webp" href="../assets/logo.webp">
    <link rel="stylesheet" href="../stylesheets/components/side-nav.css">
    <script type="module" src="../scripts/utils/side-nav.js"></script>
`;

components['#side-nav'] = function(logged_in, page)
{
    let menu_entries = logged_in ? 
        ['index', 'notifications', 'write-post', 'logout'] : 
        ['index', 'login', 'create-account'];

    menu_entries = menu_entries.filter(entry => entry !== page);

    const side_nav = `
        <nav id='side-nav' class="display-none">
            <ul>
                ${(logged_in && page !== 'profile') ? 
                    `<li for="profile">
                        <a href="profile">
                            <div id="profile-pic-mini"></div>
                        </a>
                    </li>` : ''}
                ${menu_entries.reduce((accumulator, page) => {
                    return accumulator + `
                        <li for="${page}">
                            <a href="${page}">${page}</a>
                        </li>
                    `;
                }, '')}
            </ul>
        </nav>`;

    // if (logged_in && page !== 'profile') 
    //     menu_entries.unshift('profile');

    const open_side_nav_btn = `<button id="open-side-nav-btn" class="secondary-btn display-block">
            ${menu_entries.reduce((accumulator, page) => {
                return accumulator + `
                    <div for=${page}>
                        <span class='bullet'></span><span class='row'></span>
                    </div>
                `;
            }, '')}
        </button>
    `;

    return side_nav + open_side_nav_btn;
}

components['.info-msg'] = function(msg) 
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
            Please, <a href='login'>login</a> or <a href='create-account'>create an account</a> :)`
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

            <style>
                main {
                    max-width: unset;
                }
                    
                h1 {
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <main>
                <h1>${reason} | ${status_code}</h1>
                <p class="info-msg">
                    ${msg}
                </p>
            </main>
        </body>
        </html>
    `;
}

export {
    components,
    fallback_page,
};
