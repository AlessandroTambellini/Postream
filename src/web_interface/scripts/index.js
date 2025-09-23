import { req, show_feedback_card, hide_feedback_card } from './_utils.js';

const PAGE_LIMIT = 20;

const posts_container = document.querySelector('#posts-container');

// This is a slightly more hard-coded version of the same function present inside templates.js
function post_card(post)
{
    const { id, content, created_at } = post;

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

    return `
        <article class="card post-card">
            <p>${content.length > 70*10 ? 
                content.substring(0, 70*10) + `...<a href='read-post?id=${id}'>read entirely</a>` : 
                content}</p>
            <time datetime="${created_at}">${prettify_date(created_at)}</time>
            <a href='write-reply?id=${id}'>Reply</a>
        </article>
    `;
}

async function fill_stream(flags, displayed_posts, f_reload = false)
{
    const feedback_card = document.querySelector('.feedback-card');
    hide_feedback_card(feedback_card);

    const search_params = {};
    search_params.page  = flags.sort === 'asc' ? flags.page_asc : flags.page_desc;
    search_params.sort  = flags.sort;
    search_params.limit = PAGE_LIMIT;

    const { status_code, payload, req_error } = await req('api/posts/page', 'GET', search_params);

    if (req_error) {
        show_feedback_card(feedback_card, 'error', req_error);
        return;
    }

    const { posts, page, num_of_posts } = payload;

    if (flags.sort !== 'rand') console.assert(search_params.page === page);
    
    if (f_reload) posts_container.replaceChildren(); // Empty the stream

    let new_posts = 0;

    posts.forEach(post => {
        if (displayed_posts.has(post.id)) return;
        displayed_posts.add(post.id);
        new_posts++;

        posts_container.innerHTML += post_card(post);
    });

    if (!new_posts)
    {
        if (num_of_posts === displayed_posts.size) {
            show_feedback_card(feedback_card, 'info', 'There aren\'t new posts.');
        } else {
            show_feedback_card(feedback_card, 'warn', 'No new posts retrieved. They where retrieved just posts already present in the stream.');
        }
    }

    if (flags.sort === 'asc') flags.page_asc++;
    else if (flags.sort === 'desc') flags.page_desc++;
};

/* Keep track of the posts rendered from the server on first loading of the page. */
function identify_displayed_posts(flags, displayed_posts)
{
    for (const post of posts_container.children)
    {
        const id = Number(post.querySelector('a').href.split('id=')[1]);
        displayed_posts.add(id);
    }

    flags.page_desc++; // Because the posts are retrieved in descending order on first loading
}

(function main() 
{
    const reload_posts_btn = document.querySelector('#reload-posts-btn');
    const controls = document.querySelectorAll('.control');
    const displayed_posts = new Set();

    const flags = {
        sort: 'desc',
        // Keep track of how many pages are retrieved in both ascending and descending order
        page_asc: 1, 
        page_desc: 1,
    };

    controls.forEach(ctrl => {
        ctrl.addEventListener('click', function() {
            flags.sort = this.value;
            controls.forEach(_ctrl => _ctrl.classList.remove('selected'));
            this.classList.add('selected');
        })
    });

    reload_posts_btn.addEventListener('click', () => 
    {
        // Reset
        flags.page_asc = 1;
        flags.page_desc = 1;
        displayed_posts.clear();

        fill_stream(flags, displayed_posts, true);
    });

    document.querySelector('#load-more-posts-btn').addEventListener('click', () => 
    {
        fill_stream(flags, displayed_posts);
    });

    /*
     * 
     *  Calls
     */

    identify_displayed_posts(flags, displayed_posts);
})();

