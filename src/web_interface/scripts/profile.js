import { req, hide_feedback_card, show_feedback_card, err_msg, post_card } from './_utils.js';

const feedback_card = document.querySelector('.feedback-card');
const load_more_posts_btn = document.querySelector('#load-more-posts-btn');
const posts_container = document.querySelector('#posts-container');

const flags = {
    sort: 'desc',
    page: 2,
};

// load_more_posts_btn.addEventListener('click', async () => 
// {
//     const search_params = {};
//     search_params.page  = flags.page;
//     search_params.sort  = flags.sort;
//     search_params.limit = 2;

//     const { status_code, payload, req_error } = await req('api/posts/user/page', 'GET', search_params);

//     const { posts } = payload;

//     posts.forEach(post => {
//         posts_container.innerHTML += post_card(post);
//     });

//     flags.page++;
// });

document.querySelectorAll('.delete-post-btn').forEach(btn => 
{
    btn.addEventListener('click', async () => 
    {
        hide_feedback_card(feedback_card);

        const post_id = btn.id.split('-')[1];
        const { status_code, payload, req_error } = await req('api/post', 'DELETE', { id: post_id });
    
        if (req_error) {
            show_feedback_card(feedback_card, 'Error', err_msg(status_code, 'post', 'delete'));
        } 
        else {
            const post_card = document.querySelector(`#post-card-${post_id}`);
            post_card.classList.add('deleting');
            btn.disabled = true;

            setTimeout(() => {
                post_card.remove();
            }, 300); // Matches the .post-card transition duration
        }
    });
});
