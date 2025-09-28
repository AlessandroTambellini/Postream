import { req, show_feedback_card, hide_feedback_card, err_msg } from './_universal.js';

const delete_account_form = document.querySelector('form');
const feedback_card = delete_account_form.querySelector('.feedback-card');

delete_account_form.addEventListener('submit', handle_account_deletion);

async function handle_account_deletion(e)
{
    e.preventDefault();
    hide_feedback_card(feedback_card);

    const path = delete_account_form.attributes.action.value;
    const method = delete_account_form.attributes.method.value;
    
    const { status_code, req_error } = await req(path, method);

    if (req_error) {
        show_feedback_card(feedback_card, 'Error', err_msg(status_code, 'user', 'delete'));
    } else {
        document.cookie = 'password_hash=';
        location.href = '/';
    }
}
