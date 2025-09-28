import { req, show_feedback_card, hide_feedback_card, err_msg } from './_universal.js';

const write_post_form = document.querySelector('form');
const textarea = write_post_form.querySelector('textarea');
const feedback_card = write_post_form.querySelector('.feedback-card');

write_post_form.addEventListener('submit', handle_post_submission);

async function handle_post_submission(e)
{
    e.preventDefault();
    hide_feedback_card(feedback_card);

    const path = write_post_form.attributes.action.value;
    const method = write_post_form.attributes.method.value;
    
    const content = textarea.value;
    const created_at = new Date().toLocaleString();
    
    const { status_code, req_error } = await req(path, method, null, { content, created_at });

    if (req_error) {
        show_feedback_card(feedback_card, 'Error', err_msg(status_code, 'post', 'send'));
    } else {
        show_feedback_card(feedback_card, 'Success', 'Post created successfully');
    }
}

