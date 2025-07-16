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

    // console.log('form logic not implemented yet.');
    // feedback.show('warn', 'form logic not implemented yet.');
    
    const path = reply_form.attributes.action.value;
    const method = reply_form.attributes.method.value;
    
    const letter_id = document.URL.split('?')[1];
    const reply = textarea.value;

    const { status_code, payload } = await req(path, letter_id, method, reply);

    if (status_code > 299 || payload.Error) {
        feedback.show('error', payload.Error);
    }
        
    // payload.Success may be undefined
    feedback.show('success', payload.Success);
}

