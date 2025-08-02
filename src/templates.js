function reply_card(reply)
{
    const { content, created_at } = reply;

    return `
        <article class='reply-card'>
            <p>${content}</p>
            <time datetime="${created_at}">${new Date(created_at).toLocaleString()}</time>
        </article>
    `;
}

function post_card(post, reply_link_type = false, cut_post_content = false)
{
    const { id, content, created_at } = post;

    /* Sometimes I don't want the reply link to be shown. 
    E.g. if you are the author of the post and you are simply visualizing it in the profile page
    (even though, you can reply to your own posts) */
    const reply_link_types = ['', `<a href='read-post?id=${id}'>Read Replies</a>`, `<a href='write-reply?id=${id}'>Reply</a>`];

    return `
        <article class="post-card">
            <p>${cut_post_content && content.length > 70*10 ? 
                content.substring(0, 70*10) + `...<a href='read-post?id=${id}'>read entirely</a>` : 
                content}</p>
            <time datetime="${created_at}">${new Date(created_at).toLocaleString()}</time>
            ${reply_link_types[reply_link_type]}
        </article>
    `;
}

// Meh, I don't know. I use this function just for the index page.
function nav_links(logged_in) {
    if (logged_in)
    {
        return `
            <a href="profile">Profile</a>
            <a href="logout">Logout</a>
        `;
    } else {
        return `
            <a href="login">Login</a>
            <a href="create-account">Create Account</a>        
        `;
    }
}

function write_post_link() {
    return `
        <nav id="write-post-link-wrapper">
            <a href="write-post" id="write-post-link" class="secondary-btn" title="Write a post">
                <img src="assets/write-post.svg" class="icon" alt="Write post icon">
            </a>            
        </nav>
    `;
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
            
            <link rel="icon" type="image/svg+xml" href="assets/mailbox.svg">
            <link rel="stylesheet" href="style/_universal.css">

            <style>
                body {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                h1 {
                    margin-top: 1em;
                    margin-inline: .5em;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <h1>${reason} | ${status_code}</h1>
            <p class="info-msg">
                ${msg}
            </p>
        </body>
        </html>
    `;
}

function fallback_info_msg(msg) 
{
    return `<p class='info-msg'>${msg}</p>`
}

export {
    reply_card,
    post_card,
    nav_links,
    write_post_link,
    fallback_page,
    fallback_info_msg,
};
