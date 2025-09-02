import { req, show_feedback_card, hide_feedback_card, err_msg, switch_class } from './_utils.js';

const create_account_form = document.querySelector('form');
const feedback_card = create_account_form.querySelector('.feedback-card');
const password_container = document.querySelector('div:has(#password)');
const password_p = document.querySelector('#password');
const copy_password_btn = password_container.querySelector('button');

feedback_card.querySelector('.close-btn').addEventListener('click', () => hide_feedback_card(feedback_card));

create_account_form.addEventListener('submit', handle_registration);
copy_password_btn.addEventListener('click', copy_password);

async function handle_registration(e) 
{
    e.preventDefault();
    hide_feedback_card(feedback_card);
    
    const { status_code, payload, req_error } = await req('api/user', 'POST');
    
    if (req_error) {
        show_feedback_card(feedback_card, 'error', err_msg(status_code, 'user'));
    } else {
        password_p.textContent = payload.password;
        // Once a registration happens, the previous cookie is deleted to avoid conflicts with a previous user while logging in 
        document.cookie = 'password_hash=';

        switch_class(password_container, 'display-none', 'display-block');
    }
}

let timeout_id = -1;
function copy_password() 
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
}
