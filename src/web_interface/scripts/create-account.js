import req from "./utils/req.js";
import { setup_feedback_cards, err_msg } from "./utils/feedback.js";

const create_account_form = document.querySelector('form');
const feedback = create_account_form.querySelector('.feedback-card');
const password_container = document.querySelector('div:has(#password)');
const password_p = document.querySelector('#password');
const copy_password_btn = password_container.querySelector('button');

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
        password_p.textContent = payload.password;
        // Once a registration happens, the previous cookie is deleted to avoid conflicts with a previous user while logging in 
        document.cookie = 'password_hash=';

        password_container.className = 'block';
    }
}

let timeout_id = -1;
copy_password_btn.addEventListener('click', () => 
{
    clearTimeout(timeout_id);
    navigator.clipboard.writeText(password_p.textContent);

    copy_password_btn.innerHTML = '&#10004; Copied';
    copy_password_btn.classList.remove('btn-unclicked');
    copy_password_btn.classList.add("btn-clicked");
    
    timeout_id = setTimeout(() => {
        copy_password_btn.classList.remove("btn-clicked");
        copy_password_btn.classList.add('btn-unclicked');
        copy_password_btn.textContent = 'Copy';
    }, 3000);
});
