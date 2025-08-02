import req from "./utils/req.js";
import { setup_feedback_cards, err_msg } from "./utils/feedback.js";

const delete_account_form = document.querySelector('form');
const feedback = delete_account_form.querySelector('.feedback-card');

(function main()
{
    setup_feedback_cards();
    delete_account_form.addEventListener('submit', handle_account_deletion);
})();

async function handle_account_deletion(e)
{
    e.preventDefault();
    feedback.hide();

    const path = delete_account_form.attributes.action.value;
    const method = delete_account_form.attributes.method.value;
    
    const { status_code, req_error } = await req(path, method);

    if (req_error) {
        feedback.show('error', err_msg(status_code, 'user', 'delete'));
    } else {
        document.cookie = 'password_hash=';
        location.href = '/';
    }
}
