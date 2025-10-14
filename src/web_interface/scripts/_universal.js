// 
// Convert dates to local time

document.querySelectorAll('.post-card').forEach(post => {
    const time = post.querySelector('time');
    time.textContent = prettify_date(time.dateTime);
});
document.querySelectorAll('.reply-card').forEach(reply => {
    const time = reply.querySelector('time');
    time.textContent = prettify_date(time.dateTime);
});


/*
 *
 *  Side-Nav
 */

const side_panel = document.querySelector('#side-panel');
const show_side_panel_btn = document.querySelector('#show-side-panel-btn');
const main = document.querySelector('main');
const sun_mode_btn = side_panel.querySelector('#sun-mode-btn');
const moon_mode_btn = side_panel.querySelector('#moon-mode-btn');
const html = document.querySelector('html');

// I assume there isn't more than a single feedback-card per page.
const feedback_card = document.querySelector('.feedback-card');

show_side_panel_btn.addEventListener('click', e => 
{    
    side_panel.classList.add('shown');
    main.classList.add('display-opaque');
    e.stopPropagation();
});

document.body.addEventListener('click', e => 
{
    if (e.composedPath().includes(side_panel)) return;
    side_panel.classList.remove('shown');
    main.classList.remove('display-opaque');
});

sun_mode_btn.addEventListener('click', () => 
{
    html.classList.remove('moon-mode');
    sun_mode_btn.classList.replace('display-flex', 'display-none');
    moon_mode_btn.classList.replace('display-none', 'display-block');
    localStorage.removeItem('light-mode');
});

moon_mode_btn.addEventListener('click', () => 
{
    html.classList.add('moon-mode');
    sun_mode_btn.classList.replace('display-none', 'display-flex');
    moon_mode_btn.classList.replace('display-block', 'display-none');
    localStorage.setItem("light-mode", "moon-mode");
});

feedback_card?.querySelector('.close-btn').addEventListener('click', () => {
    hide_feedback_card(feedback_card);
});


/*
 * 
 *  Utils 
 */

// This is a slightly more hard-coded version of the same function present inside templates.mjs
function post_card(post)
{
    const { id, content, created_at } = post;

    return (
        `<article class="card post-card">` +
            `<p>` +
                `${content.length > 70*10 ? 
                    content.substring(0, 70*10) + `...<a href='/read-post?id=${id}'>Read-Entirely</a>` : 
                    content}` + 
            `</p>` +
            `<time datetime="${created_at}">${prettify_date(created_at)}</time>` +
            `<a href='/write-reply?id=${id}'>Reply</a>` +
        `</article>`
    );
}

function prettify_date(date) 
{
    const locale_date = new Date(date).toLocaleString()
    
    const week_days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [0, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const week_day = new Date(locale_date).getDay();
    const [year_time, day_time] = locale_date.split(', ');
    const [month, day, year] = year_time.split('/');

    const [clock_time, am_pm] = day_time.split(' ');
    const [hour, mins, secs] = clock_time.split(':');

    return `${week_days[week_day]}, ${day} ${months[month]} ${year}, ${hour}:${mins} ${am_pm}`;
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
    if (!['info', 'success', 'warning', 'error'].includes(type)) {
        console.error(`Invalid feedback type. Passed '${type}.'`);
        return;
    }

    // reset the classes
    feedback_card.className = 'card feedback-card';

    feedback_card.classList.add(type);
    feedback_card.querySelector('p .type').textContent = type;
    feedback_card.querySelector('p .msg').textContent = msg;
}

function hide_feedback_card(feedback_card) {
    feedback_card.className = 'card feedback-card deleting';
}

/* This function is to show more meaningful error messages to the final user
compared to the ones coming from the server. */
function err_msg(status_code, entity, action) 
{
    if (status_code === 500) return 'Un unknown error has occured in the server. Please, try again later.';
    else if (status_code === 413) return `The ${entity} is too big. Its max size is ~128KB (Roughly 50-60 pages of a book).`;
    else if (status_code === 403 && entity === 'reply') return 'You can\'t reply to your own post.';
    else if (status_code === 401) return `You aren't authenticated. Please, login before trying to ${action} a ${entity}.`;
    else return `Invalid ${entity}.`;
}

function sanitize_input(input) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
    };
    const reg = /[&<>"'/]/gi;

    return input.replace(reg, (match) => map[match]);
}

export {
    post_card,
    req,
    show_feedback_card,
    hide_feedback_card,
    err_msg,
    prettify_date,
    sanitize_input,
};
