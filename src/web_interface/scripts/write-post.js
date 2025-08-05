import req from "./utils/req.js";
import { setup_feedback_cards, err_msg } from "./utils/feedback.js";

const write_post_form = document.querySelector('form');
const textarea = write_post_form.querySelector('textarea');
const feedback = write_post_form.querySelector('.feedback-card');

(function main()
{
    setup_feedback_cards();
    write_post_form.addEventListener('submit', handle_post_submission);
})();

async function handle_post_submission(e)
{
    e.preventDefault();
    feedback.hide();

    const path = write_post_form.attributes.action.value;
    const method = write_post_form.attributes.method.value;
    
    const content = textarea.value;

    const { status_code, req_error } = await req(path, method, null, { content, created_at: new Date().toString() });

    if (req_error) {
        feedback.show('error', err_msg(status_code, 'post', 'send'));
    } else {
        feedback.show('success', 'Post created successfully');
    }
}

