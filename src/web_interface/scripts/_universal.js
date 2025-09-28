const side_nav = document.querySelector('#side-nav');
const open_side_nav_btn = document.querySelector('#open-side-nav-btn');
const main = document.querySelector('main');
const minify_nav_btn = side_nav.querySelector('#minify-nav-btn');
const expand_nav_btn = side_nav.querySelector('#expand-nav-btn');
const feedback_cards = document.querySelectorAll('.feedback-card');

open_side_nav_btn.addEventListener('click', () => 
{    
    switch_class(side_nav, 'display-none', 'display-block');
    switch_class(open_side_nav_btn, 'display-block', 'display-none');    
    main.classList.add('display-opaque');
});

minify_nav_btn.addEventListener('click', () => 
{
    side_nav.querySelector('ul').classList.add('minified-list');
    switch_class(minify_nav_btn, 'display-block', 'display-none');
    switch_class(expand_nav_btn, 'display-none', 'display-block');
});

expand_nav_btn.addEventListener('click', () => 
{
    side_nav.querySelector('ul').classList.remove('minified-list');
    switch_class(expand_nav_btn, 'display-block', 'display-none');
    switch_class(minify_nav_btn, 'display-none', 'display-block');
});

main.addEventListener('click', e => 
{
    switch_class(side_nav, 'display-block', 'display-none');    
    switch_class(open_side_nav_btn, 'display-none', 'display-block');
    main.classList.remove('display-opaque');
});
        
feedback_cards.forEach(card => {
    card.querySelector('.close-btn').addEventListener('click', () => {
        hide_feedback_card(card);
    });
});

// This is a slightly more hard-coded version of the same function present inside templates.js
function post_card(post)
{
    const { id, content, created_at } = post;

    function prettify_date(date) 
    {
        const week_days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = [0, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const week_day = new Date(date).getDay();
        const [year_time, day_time] = date.split(', ');
        const [month, day, year] = year_time.split('/');

        const [clock_time, am_pm] = day_time.split(' ');
        const [hour, mins, secs] = clock_time.split(':');

        return `${week_days[week_day]}, ${day} ${months[month]} ${year}, ${hour}:${mins} ${am_pm}`;
    }

    return `
        <article class="card post-card">
            <p>${content.length > 70*10 ? 
                content.substring(0, 70*10) + `...<a href='read-post?id=${id}'>read entirely</a>` : 
                content}</p>
            <time datetime="${created_at}">${prettify_date(created_at)}</time>
            <a href='write-reply?id=${id}'>Reply</a>
        </article>
    `;
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

function show_feedback_card(feedback_card, fdk_type, msg) 
{
    // reset the classes
    feedback_card.className = 'card feedback-card';

    const icon = feedback_card.querySelector('span[role=img]');
    const type = feedback_card.querySelector('p .type');

    if (fdk_type === 'Info') {
        icon.textContent = 'i';
        feedback_card.classList.add('vanish');
    } else if (fdk_type === 'Success') {
        icon.textContent = '✓';
        feedback_card.classList.add('vanish');
    } else if (fdk_type === 'Warn') { 
        icon.textContent = '!';
        feedback_card.classList.add('flex');
    } else if (fdk_type === 'Error') {
        icon.textContent = '!';
        feedback_card.classList.add('flex');
    } else {
        console.error(`Invalid feedback fdk_type. Passed '${fdk_type}.'`);
        return;
    }

    type.textContent = fdk_type;
    feedback_card.classList.add(fdk_type);
    feedback_card.querySelector('p .msg').textContent = msg;
}

function hide_feedback_card(feedback_card) {
    feedback_card.className = 'card feedback-card';
    feedback_card.classList.add('display-none');
}

/* This function is to give more meaning to the possible errors coming from the server 
that to the user wouldn't make much sense. 
That errors returned from the server are useful when playing around with the API, not on the website. */
function err_msg(status_code, entity, action) 
{
    if (status_code === 500) return 'Un unknown error has occured in the server. Please, try again later.';
    else if (status_code === 401) return `You aren't authenticated. Please, login before trying to ${action} a ${entity}.`;
    else return `Invalid ${entity}`;
}

function switch_class(element, old, _new) {
    element.classList.remove(old);
    element.classList.add(_new)
}

export {
    post_card,
    req,
    show_feedback_card,
    hide_feedback_card,
    err_msg,
    switch_class,
};
