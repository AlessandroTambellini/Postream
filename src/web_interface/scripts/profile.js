import { req, hide_feedback_card, show_feedback_card, err_msg, prettify_date } from './_universal.js';

/*
 *
 *  Delete-Post Logic
 */

const delete_post_dialog = document.querySelector('#delete-post-dialog');
const close_dialog_btn = document.querySelector('#close-dialog-btn');
const yes_btn = delete_post_dialog.querySelector('button[type=submit]');
const delete_post_feedback_card = delete_post_dialog.querySelector('.feedback-card');

close_dialog_btn.addEventListener("click", () => {
    delete_post_dialog.close();
    hide_feedback_card(delete_post_feedback_card);
});

/* I'd like to close the dialog when clicking on its background,
but I can't append a listener to ::backdrop,
and using e.composedPath() or e.currentTarget doesn't really help,
because ::backdrop is still part of the dialog.
The only option would be to let the elements inside the dialog to fill all the space available
inside the dialog itself, but it's a bit of an hack and not really precise. */

yes_btn.addEventListener('click', async e =>
{
    e.preventDefault();

    const post_id = delete_post_dialog.returnValue;
    const { status_code, payload, req_error } = await req('api/post', 'DELETE', { id: post_id });

    if (req_error) {
        show_feedback_card(delete_post_feedback_card, 'error', err_msg(status_code, 'post', 'delete'));
    }
    else {
        delete_post_dialog.close();
        const post_card = document.querySelector(`#post-card-${post_id}`);
        post_card.classList.add('deleting');
    }
});


/*
 *
 *  Load Posts Logic
 */

const posts_container = document.querySelector('#posts-container');
const load_page_form = document.querySelector('#load-page-form');
const posts_page_input = load_page_form.querySelector('input');
const retrieve_posts_feedback_card = document.querySelector('main > .feedback-card');

const displayed_posts = new Set();
let last_action_is_search = false;
const num_of_pages = Number(posts_page_input.max);

posts_container.querySelectorAll('.post-card').forEach(post => {
    displayed_posts.add(Number(post.dataset.postId));
});

document.querySelectorAll('.delete-post-btn').forEach(button => {
    append_click_event(button)
});

load_page_form.addEventListener('submit', async e =>
{
    e.preventDefault();
    hide_feedback_card(retrieve_posts_feedback_card);

    const PAGE_SIZE = 3;

    const page  = Number(posts_page_input.value);

    const { status_code, payload: posts, req_error } = await req('api/posts/user/page', 'GET', { page, limit: PAGE_SIZE });

    // TODO handle possible error

    if (last_action_is_search) {
        posts_container.replaceChildren();
        last_action_is_search = false;
    }

    let new_posts_displayed = 0;
    posts.forEach(post => {
        if (!displayed_posts.has(post.id)) {
            displayed_posts.add(post.id);
            new_posts_displayed++;
            const post_card = build_post_card(post);
            append_click_event(post_card.querySelector('.delete-post-btn'));
            posts_container.appendChild(post_card);
        }
    });

    if (new_posts_displayed < PAGE_SIZE && page < num_of_pages) {
        const msg = `Expected to retrieve ${PAGE_SIZE} posts, ` +
            `but ${new_posts_displayed} post${new_posts_displayed === 1 ? ' was' : 's were'} ` +
            'retrieved instead. Either this page was already loaded or new posts where created in the meanwhile.';
        show_feedback_card(retrieve_posts_feedback_card, 'info', msg);
    }

});

function build_post_card({ id, content, created_at })
{
    const post_card = document.querySelector('#post-card-template').content.cloneNode(true);

    post_card.querySelector('article').id = `post-card-${id}`;
    post_card.querySelector('article').dataset.postId = id;

    const MAX_CHARS_PER_POST_PREVIEW = 55*20;

    const p = post_card.querySelector('p');
    if (content.length > MAX_CHARS_PER_POST_PREVIEW) {
        p.textContent = content.substring(0, MAX_CHARS_PER_POST_PREVIEW) + `...<a href='/read-post?id=${id}'>Read-Entirely</a>`
    } else {
        p.textContent = content;
    }

    const time = post_card.querySelector('time');
    time.dateTime = created_at;
    time.textContent = prettify_date(created_at);

    post_card.querySelector('footer a').href = `/read-post?id=${id}#replies-container`;

    const delete_post_btn = post_card.querySelector('footer button');
    delete_post_btn.dataset.postId = id;

    return post_card;
}

function append_click_event(btn)
{
    btn.addEventListener('click', () =>
    {
        delete_post_dialog.showModal();
        delete_post_dialog.returnValue = btn.dataset.postId;
    });
}


/*
 *
 *  Search Post Logic
 */

const search_post_form = document.querySelector('#search-post-form');
const search_post_input = search_post_form.querySelector('input');

search_post_form.addEventListener('submit', async e =>
{
    e.preventDefault();
    hide_feedback_card(retrieve_posts_feedback_card);

    const { status_code, payload: posts, req_error } = await req('api/posts/user/search', 'GET', { search_term: search_post_input.value });

    if (req_error) {
        show_feedback_card(retrieve_posts_feedback_card, 'error', req_error);
    } else {
        last_action_is_search = true;
        posts_container.replaceChildren();
        posts.forEach(post => {
            posts_container.appendChild(build_post_card(post));
        });

        displayed_posts.clear();

        if (posts.length === 0) {
            show_feedback_card(retrieve_posts_feedback_card, 'info', 'There aren\'t posts matching the search parameters');
        }
    }
});
