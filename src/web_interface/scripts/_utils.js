function generate_profile_picture(element, max_num_of_circles, size)
{
    const rand_int = (max) => Math.floor(Math.random() * max + 1);

    const profile_picture = document.querySelector(element);

    // In the profile page or when logged out, there is no profile-icon in the side-nav
    if (!profile_picture) return;
    
    const num_of_circles = Math.max(20, rand_int(max_num_of_circles));

    for (let i = 0; i < num_of_circles; i++)
    {
        const circle = document.createElement('span');
        circle.classList.add('circle');

        circle.style.width = `${rand_int(size/2.5)}px`;
        circle.style.backgroundColor = `rgb(${rand_int(256)}, ${rand_int(256)}, ${rand_int(256)})`;
        circle.style.top = `${rand_int(size/10*9)}px`;
        circle.style.left = `${rand_int(size/10*9)}px`;

        profile_picture.appendChild(circle);
    }
}

async function req(path, method, search_params_obj = null, payload_obj = null) 
{
    let url = path;
    if (search_params_obj) {
        const params = new URLSearchParams(search_params_obj).toString();
        url += `?${params}`;
    }
    
    method = method.toUpperCase();
    
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (method !== 'GET' && method !== 'HEAD') {
        // If the payload is present or not, I send it anyway.
        options.body = JSON.stringify(payload_obj);
    }

    const res_obj = {
        status_code: -1,
        payload: null,
        req_error: false,
    };
    
    let server_res;
    try {
        server_res = await fetch(url, options);   
        res_obj.status_code = server_res.status;
    } catch (error) {
        console.error('ERROR:', error.message);
        res_obj.req_error = error.message;
        return;
    }
    
    try {
        const payload = await server_res.json();
        if (payload.Error) res_obj.req_error = payload.Error;
        else res_obj.payload = payload;
    } catch (error) {
        console.error('ERROR:', error.message);
        res_obj.req_error = error.message;
    }

    return res_obj;
}

function show_feedback_card(feedback_card, type, msg) 
{
    // reset the classes
    feedback_card.className = 'card feedback-card';

    const icon = feedback_card.querySelector('.feedback-icon');
    const title = feedback_card.querySelector('.feedback-title');

    if (type === 'info') {
        feedback_card.classList.add('feedback-info');
        icon.textContent = 'i';
        title.textContent = 'Info';
        feedback_card.classList.add('vanish');
    } else if (type === 'success') {
        feedback_card.classList.add('feedback-success');
        icon.textContent = '✓';
        title.textContent = 'Success';
        feedback_card.classList.add('vanish');
    } else if (type === 'warn') { 
        feedback_card.classList.add('feedback-warn');
        icon.textContent = '!';
        title.textContent = 'Warning';
        feedback_card.classList.add('flex');
    } else if (type === 'error') {
        feedback_card.classList.add('feedback-error');
        icon.textContent = '!';
        title.textContent = 'Error';
        feedback_card.classList.add('flex');
    } else {
        console.error(`Invalid feedback type. Passed '${type}.'`);
    }

    feedback_card.querySelector('.feedback-text').textContent = msg;
}

function hide_feedback_card(feedback_card) {
    feedback_card.className = 'card feedback-card';
    feedback_card.classList.add('display-none');
}

// function setup_feedback_cards()
// {
//     document.querySelectorAll('.feedback-card').forEach(card => {
//         // Attach properties to the feedback cards.
//         card.show = show_feedback;
//         card.hide = hide_feedback;
//         card.querySelector('.close-btn').addEventListener('click', () => card.hide());
//     });
// }

/* This function is to make sense of the possible errors coming from the server 
that to the user wouldn't make much sense. 
That errors returned from the server are useful when playing around with the API, not on the website. */
function err_msg(status_code, entity, action) 
{
    if (status_code === 500) return 'Un unknown error has occured in the server. Please, try again later.';
    else if (status_code === 401) return `You aren't authenticated. Please, login before trying to ${action} a ${entity}.`;
    else return `Invalid ${entity}`;
}

export {
    generate_profile_picture,
    req,
    show_feedback_card,
    hide_feedback_card,
    err_msg,
};
