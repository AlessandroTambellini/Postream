import { req, err_msg, hide_feedback_card, show_feedback_card } from "./_universal.js";

const login_form = document.querySelector('form');
const feedback_card = login_form.querySelector('.feedback-card');
const password_input = login_form.querySelector('input[name=password]');

login_form.addEventListener('submit', handle_login);

async function handle_login(e) 
{
    e.preventDefault();
    hide_feedback_card(feedback_card);

    const path = login_form.attributes.action.value;
    const password = password_input.value;
    const password_hash = parse_cookies(document.cookie).password_hash;

    /* 
    - If it's the first time that the user logs in, it's a POST.
    - If it isn't the first time that the user logs in, it's a PUT. But,
        - If previously the user logged out, I don't have anymore the password_hash on the client. Therefore,
        I first need to retrieve it (GET).
    */

    if (password_hash)
    {
        const { status_code, payload, req_error } = await req(path, 'PUT', null, { password });
        
        if (req_error) {
            show_feedback_card(feedback_card, 'Error', err_msg(status_code, 'password'));
        } else {
            document.cookie = `password_hash=${payload.password_hash}`;        
            /* I was thinking: "Why should I bother about automatically changing the location?
            The user can do it own its own". The problem is, that if the user goes back to the home page using the browser arrows,
            the old home page is shown and so the 'logged in' content isn't shown there. */
            location.href = '/';
        }
    }
    else
    {
        // Let's try to directly make a POST. Perhaps is the first login ever.
        const { status_code, payload, req_error } = await req(path, 'POST', null, { password });

        if (req_error)
        {
            // Try to get the password_hash and then update the token
            const { status_code, payload, req_error } = await req(path, 'GET', { password });
            
            if (req_error) {
                show_feedback_card(feedback_card, 'Error', err_msg(status_code, 'password'));
            } 
            else 
            {
                const { status_code, payload, req_error } = await req(path, 'PUT', null, { password });
                    
                if (req_error) {
                   show_feedback_card(feedback_card, 'Error', err_msg(status_code, 'password'));
                } else {
                    document.cookie = `password_hash=${payload.password_hash}`; 
                    location.href = '/';
                }
            }
        } 
        else 
        {
            document.cookie = `password_hash=${payload.password_hash}`; 
            location.href = '/';
        }
    }
}

function parse_cookies(cookies) 
{    
    const cookies_obj = {};
    cookies.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        if (parts.length === 2) {
            const [key, value] = parts.map(part => part.trim());
            cookies_obj[key] = value;
        }
    });

    return cookies_obj;
}
