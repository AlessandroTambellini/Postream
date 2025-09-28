import { req, show_feedback_card, hide_feedback_card, post_card } from './_universal.js';

const controls = document.querySelectorAll('.control');
const reload_posts_btn = document.querySelector('#reload-posts-btn');
const posts_container = document.querySelector('#posts-container');
const load_more_posts_btn = document.querySelector('#load-more-posts-btn');
const feedback_card = document.querySelector('.feedback-card');

const displayed_posts = new Set();

const flags = {
    sort: 'desc',
    // Keep track of how many pages are retrieved in both asc and desc order
    page_asc: 1, 
    page_desc: 1,
};

identify_displayed_posts(flags, displayed_posts);

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

load_more_posts_btn.addEventListener('click', () => fill_stream(flags, displayed_posts));

async function fill_stream(flags, displayed_posts, f_reload = false)
{
    hide_feedback_card(feedback_card);

    const search_params = {};
    search_params.page  = flags.sort === 'asc' ? flags.page_asc : flags.page_desc;
    search_params.sort  = flags.sort;
    search_params.limit = 20;
    // search_params.format = 'html';

    const { status_code, payload, req_error } = await req('api/posts/page', 'GET', search_params);

    if (req_error) {
        show_feedback_card(feedback_card, 'Error', req_error);
        return;
    }
    
    const { posts, num_of_posts } = payload;
    
    if (f_reload) posts_container.replaceChildren(); // Empty the stream

    let posts_html = [];
    posts.forEach(post => {
        if (!displayed_posts.has(post.id)) {
            displayed_posts.add(post.id);
            posts_html.push(post_card(post));
        }
    });

    if (posts_html.length > 0) {
        posts_container.innerHTML += posts_html.join('');
    } 
    else {
        if (num_of_posts === displayed_posts.size) {
            show_feedback_card(feedback_card, 'Info', 'There aren\'t new posts.');
        } else {
            show_feedback_card(feedback_card, 'Warn', 'No new posts retrieved. They where retrieved just posts already present in the stream.');
        }
    }

    if (flags.sort === 'asc') flags.page_asc++;
    else if (flags.sort === 'desc') flags.page_desc++;
};

/* Keep track of the posts rendered from the server on first loading of the page. */
function identify_displayed_posts(flags, displayed_posts)
{
    const posts = posts_container.querySelectorAll('.post-card');
    for (const post of posts)
    {
        const id = Number(post.querySelector('a').href.split('id=')[1]);
        displayed_posts.add(id);
    }

    flags.page_desc++; // Because the posts are retrieved in descending order on first loading
}



