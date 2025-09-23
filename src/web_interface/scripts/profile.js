import { generate_profile_picture, req, hide_feedback_card, show_feedback_card, err_msg } from './_utils.js';

const feedback_card = document.querySelector('.feedback-card');

generate_profile_picture('#profile-picture', 50, 300);

document.querySelectorAll('.delete-post-btn').forEach(btn => 
{
    btn.addEventListener('click', async () => 
    {
        hide_feedback_card(feedback_card);

        const post_id = btn.id.split('-')[1];
        const { status_code, payload, req_error } = await req('api/post', 'DELETE', { id: post_id });
    
        if (req_error) {
            show_feedback_card(feedback_card, 'error', err_msg(status_code, 'post', 'delete'));
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
