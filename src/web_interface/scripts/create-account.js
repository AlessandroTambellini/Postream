import req from "./utils/req.js";
import { setup_feedback_cards, err_msg } from "./utils/feedback.js";

const create_account_form = document.querySelector('form');
const feedback = create_account_form.querySelector('.feedback-card');
const password_container = create_account_form.querySelector('p');

(function main()
{
    setup_feedback_cards();
    create_account_form.addEventListener('submit', handle_registration);
})();

async function handle_registration(e) 
{
    e.preventDefault();
    feedback.hide();
    
    const { status_code, payload, req_error } = await req('api/user', 'POST');
    
    if (req_error) {
        feedback.show('error', err_msg(status_code, 'user'));
    } else {
        password_container.textContent = payload.password;
        // Once a registration happens, the previous cookie is deleted to avoid conflicts with a previous user while logging in 
        document.cookie = 'password_hash='
    }
}
