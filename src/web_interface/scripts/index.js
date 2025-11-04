import { req, show_feedback_card, hide_feedback_card, prettify_date } from './_universal.js';

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
        controls.forEach(ctrl => ctrl.classList.remove('selected'));
        this.classList.add('selected');
    });
});

reload_posts_btn.addEventListener('click', () =>
{
    // Reset
    flags.page_asc = 1;
    flags.page_desc = 1;
    displayed_posts.clear();

    fill_stream(flags, displayed_posts, true);
});

load_more_posts_btn.addEventListener('click', () => {
    fill_stream(flags, displayed_posts)
});

async function fill_stream(flags, displayed_posts, f_reload = false)
{
    hide_feedback_card(feedback_card);

    const search_params = {};
    search_params.page  = flags.sort === 'asc' ? flags.page_asc : flags.page_desc;
    search_params.sort  = flags.sort;

    const { status_code, payload: posts, req_error } = await req('api/posts/page', 'GET', search_params);

    if (req_error) {
        show_feedback_card(feedback_card, 'error', req_error);
        return;
    }

    if (f_reload) {
        // Empty the stream first
        posts_container.replaceChildren();
    }

    let new_posts_displayed = 0;
    posts.forEach(post => {
        if (!displayed_posts.has(post.id)) {
            displayed_posts.add(post.id);
            new_posts_displayed++;
            posts_container.appendChild(build_post_card(post));
        }
    });

    if (!new_posts_displayed) {
        show_feedback_card(feedback_card, 'info', 'No new posts retrieved. ' +
            'Either were retrieved only posts already present in the stream or there aren\'t more posts in the database.');
    }

    if (flags.sort === 'asc') flags.page_asc++;
    else if (flags.sort === 'desc') flags.page_desc++;
};

/* Keep track of the posts rendered from the server on first loading of the page. */
function identify_displayed_posts(flags, displayed_posts)
{
    posts_container.querySelectorAll('.post-card').forEach(post => {
        displayed_posts.add(Number(post.dataset.postId));
    });

    // The posts are retrieved in descending order on first loading
    flags.page_desc++;
}

function build_post_card({ id, content, created_at })
{
    const post_card_template = document.querySelector('#post-card-template');
    const post_card = post_card_template.content.cloneNode(true);

    // TODO this variable is repeated in post-card of templates
    const MAX_CHARS_PER_POST_PREVIEW = 55*20;

    // The id is needed to delete the post.
    // I don't put it here given it isn't possible to delete a post from the index page

    const p = post_card.querySelector('p');
    if (content.length > MAX_CHARS_PER_POST_PREVIEW) {
        p.textContent = content.substring(0, MAX_CHARS_PER_POST_PREVIEW) + `...<a href='/read-post?id=${id}'>Read-Entirely</a>`
    } else {
        p.textContent = content;
    }

    const time = post_card.querySelector('time');
    time.dateTime = created_at;
    time.textContent = prettify_date(created_at);

    post_card.querySelector('footer a').href = `/write-reply?id=${id}`;

    return post_card;
}


