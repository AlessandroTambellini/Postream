/*
 *
 *  Side-Panel
 */

const side_panel = document.querySelector('#side-panel');
const show_side_panel_btn = document.querySelector('#show-side-panel-btn');
const main = document.querySelector('main');
const sun_mode_btn = side_panel.querySelector('#sun-mode-btn');
const moon_mode_btn = side_panel.querySelector('#moon-mode-btn');
const html = document.querySelector('html');

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


/*
 *
 *  Utils
 */

async function req(path, method, search_params, req_payload = null)
{
    class ReqError {
        constructor(code, msg) {
            this.code = code;
            this.msg = msg;
        }

        interpret(entity, action) 
        {
            let error_msg = '';
            switch (this.code) {
                case 500:
                    error_msg = 'Unexpected error has occured in the server.';
                    break;
                case 413:
                    error_msg = `The ${entity} is too big. Its max size is ~128KB (Roughly 50-60 pages of a book).`;
                    break;
                case 401:
                    error_msg = `You aren't authenticated. Please, login before trying to ${action} a ${entity}.`;
                    break;
            
                default:
                    error_msg = this.msg;
                    break;
            }

            return error_msg;
        } 
    }

    const res = {
        payload: null,
        req_error: null,
    };

    try {
        const url = search_params ? `${path}?${new URLSearchParams(search_params)}` : path;

        const options = {
            method: method.toUpperCase(),
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (req_payload && !['HEAD', 'GET'].includes(options.method)) {
            options.body = JSON.stringify(req_payload);
        }

        const server_res = await fetch(url, options);
        const res_payload = await server_res.json();

        if (res_payload.Error) {
            res.req_error = new ReqError(server_res.status, res_payload.Error);
        } else {
            res.payload = res_payload;
        }

    } catch (error) {
        console.error(error);
        res.req_error = new ReqError(400, error.message);
    }

    return res;
}

function prettify_date(date)
{
    const locale_date = new Date(date).toLocaleString();

    const week_days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [null, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const week_day = new Date(locale_date).getDay();
    const [year_time, day_time] = locale_date.split(', ');
    const [month, day, year] = year_time.split('/');

    const [clock_time, am_pm] = day_time.split(' ');
    const [hour, mins] = clock_time.split(':');

    return `${week_days[week_day]}, ${day} ${months[month]} ${year}, ${hour}:${mins} ${am_pm}`;
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

class FeedbackCard {
    constructor(element) {
        this.element = element;
        this.element.querySelector('.close-btn').addEventListener('click', () => {
            this.hide();
        });
    }

    show(type, msg) 
    { 
        /* I could do this check when the request to the server fails,
        but I would be 'dragging' this info uselessly among functions.
        So, I check it just before showing the error to the user. */
        if (!navigator.onLine) {
            msg = 'You are offline.';
        }

        this.element.className = 'card feedback-card';

        this.element.classList.add(type);
        this.element.querySelector('p .type').textContent = type;
        this.element.querySelector('p .msg').textContent = msg;
    }
    
    hide() { 
        this.element.className = 'card feedback-card deleting'; 
    }
}

export {
    req,
    prettify_date,
    sanitize_input,
    FeedbackCard,
};
