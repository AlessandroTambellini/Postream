import req from "./utils/req.js";
import { setup_feedback_cards, err_msg } from "./utils/feedback.js";

const write_reply_form = document.querySelector('form');
const textarea = write_reply_form.querySelector('textarea');
const feedback = write_reply_form.querySelector('.feedback-card');

(function main()
{
    setup_feedback_cards();
    write_reply_form.addEventListener('submit', handle_reply_submission);
})();

async function handle_reply_submission(e)
{
    e.preventDefault();
    feedback.hide();

    const path = write_reply_form.attributes.action.value;
    const method = write_reply_form.attributes.method.value;
    
    const post_id = document.URL.split('?id=')[1];
    const content = textarea.value;

    const { status_code, payload, req_error } = await req(path, method, null, { post_id, content, created_at: new Date().toString() });

    if (req_error) {
        feedback.show('error', err_msg(status_code, 'reply', 'send'));
    } else {
        feedback.show('success', 'Reply created successfully');
    }
}

