import { req, show_feedback_card, hide_feedback_card,  } from './_universal.js';

const write_reply_form = document.querySelector('form');
const textarea = write_reply_form.querySelector('textarea');
const feedback_card = write_reply_form.querySelector('.feedback-card');

write_reply_form.addEventListener('submit', handle_reply_submission);

async function handle_reply_submission(e)
{
    e.preventDefault();
    hide_feedback_card(feedback_card);

    const path = write_reply_form.attributes.action.value;
    const method = write_reply_form.attributes.method.value;
    
    const post_id = document.URL.split('?id=')[1];
    const content = textarea.value;
    const created_at = new Date().toLocaleString();

    // I have to create the date on the client because it has to be locale to it
    const { status_code, payload, req_error } = await req(path, method, null, { post_id, content, created_at });

    if (req_error) {
        show_feedback_card(feedback_card, 'Error', err_msg(status_code, 'reply', 'send'));
    } else {
        show_feedback_card(feedback_card, 'Success', 'Reply created successfully');
    }
}

