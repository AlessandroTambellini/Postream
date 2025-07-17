import setup_feedback_cards from "./utils/feedback.js";
import req from "./utils/req.js";

const reply_form = document.querySelector('form');
const textarea = reply_form.querySelector('textarea');
const feedback = reply_form.querySelector('.feedback-card');

(function main()
{
    setup_feedback_cards();

    reply_form.addEventListener('submit', handle_reply_submission);
})();

async function handle_reply_submission(e)
{
    e.preventDefault();
    feedback.hide();

    const path = reply_form.attributes.action.value;
    const method = reply_form.attributes.method.value;
    
    const letter_id = document.URL.split('?')[1];
    const reply = textarea.value;

    const { status_code, payload } = await req(path, letter_id, method, reply);

    if (status_code > 299 || payload.Error) {
        feedback.show(status_code === 501 ? 'warn' : 'error', payload.Error);
        return;
    }
        
    // payload.Success may be undefined
    feedback.show('success', payload.Success);
}

