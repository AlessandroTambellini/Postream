import { req, setup_feedback_cards } from "./utils.js";

const msg_form = document.querySelector('#msg-form');

(function main()
{
    setup_feedback_cards();

    msg_form.addEventListener('submit', handle_msg_submission);
})();

async function handle_msg_submission(e)
{
    e.preventDefault();

    const feedback = msg_form.querySelector('.feedback-card');
    const textarea = msg_form.querySelector('textarea');

    feedback.hide();

    if (textarea.value.trim().length === 0) {
        feedback.show('error', 'The msg is empty.');
        return;
    }

    const path = msg_form.attributes.action.value;
    const method = msg_form.attributes.method.value;
    const msg = textarea.value;

    const { status_code, payload } = await req(path, null, method, { msg });

    if (status_code === 200) 
        feedback.show('success', payload.Success);
    else 
        feedback.show('error', payload.Error);
    
    textarea.value = null;
}
