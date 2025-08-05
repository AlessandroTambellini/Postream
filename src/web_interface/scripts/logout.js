import { setup_feedback_cards } from "./utils/feedback.js";

const logout_form = document.querySelector('form');
const feedback = logout_form.querySelector('.feedback-card');

(function main()
{
    setup_feedback_cards();
    logout_form.addEventListener('submit', handle_logout);
})();

async function handle_logout(e)
{
    e.preventDefault();
    feedback.hide();

    document.cookie = 'password_hash=';
    location.href = '/';
}
