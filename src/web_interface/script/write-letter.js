import setup_feedback_cards from "./utils/feedback.js";
import req from "./utils/req.js";

const letter_form = document.querySelector('form');
const textarea = letter_form.querySelector('textarea');
const feedback = letter_form.querySelector('.feedback-card');
const email_input = letter_form.querySelector('input');

(function main()
{
    setup_feedback_cards();

    letter_form.addEventListener('submit', handle_letter_submission);
})();

async function handle_letter_submission(e)
{
    e.preventDefault();
    feedback.hide();

    const path = letter_form.attributes.action.value;
    const method = letter_form.attributes.method.value;
    
    const message = textarea.value;
    const email = email_input.value;

    const { status_code, payload } = await req(path, null, method, { message, email });

    if (status_code === 200) {
        feedback.show('success', payload.Success);
    } else {
        feedback.show('error', payload.Error);
    }
}
