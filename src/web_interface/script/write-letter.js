import setup_feedback_cards from "./utils/feedback.js";
import req from "./utils/req.js";

const letter_form = document.querySelector('form');
const feedback = letter_form.querySelector('.feedback-card');
const textarea = letter_form.querySelector('textarea');

(function main()
{
    setup_feedback_cards();

    letter_form.addEventListener('submit', handle_msg_submission);
})();

async function handle_msg_submission(e)
{
    e.preventDefault();
    feedback.hide();

    const path = letter_form.attributes.action.value;
    const method = letter_form.attributes.method.value;
    const msg = textarea.value;

    const { status_code, payload } = await req(path, null, method, { msg });

    if (status_code === 200) 
        feedback.show('success', payload.Success);
    else 
        feedback.show('error', payload.Error);
}
