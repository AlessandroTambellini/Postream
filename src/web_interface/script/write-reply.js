import setup_feedback_cards from "./utils/feedback.js";

const reply_form = document.querySelector('form');
const feedback = document.querySelector('.feedback-card');

(function main()
{
    setup_feedback_cards();

    reply_form.addEventListener('submit', handle_reply_submission);
})();

async function handle_reply_submission(e)
{
    e.preventDefault();
    feedback.hide();

    console.log('form logic not implemented yet.');
    feedback.show('warn', 'form logic not implemented yet.');
}

