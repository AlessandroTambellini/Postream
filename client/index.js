const msg_form = document.querySelector('#msg-form');
const msg_textarea = msg_form.querySelector('textarea');
const req_feedback = msg_form.querySelector('#req-feedback');
const req_feedback_p = req_feedback.querySelector('p');
const messages_stream = document.querySelector('#msg-stream');

msg_form.addEventListener('submit', async e => 
{
    e.preventDefault();
    req_feedback.style.display = 'none';

    if (msg_textarea.value.trim().length === 0) {
        req_feedback.className = 'error';
        req_feedback_p.textContent = 'The msg is empty.';
        req_feedback.style.display = 'block';
        return;
    }

    const path = msg_form.attributes.action.value;
    const method = msg_form.attributes.method.value;
    const msg = msg_textarea.value;

    const { status_code, payload } = await req(path, method, { msg });

    if (status_code === 200) {
        req_feedback.className = 'success';
        req_feedback_p.textContent = payload.Success;
    } else {
        req_feedback.className = 'error';
        req_feedback_p.textContent = payload.Error;
    }

    req_feedback.style.display = 'block';
    msg_textarea.value = null;
});

async function req(path, method, payload = {}) 
{
    let url = path;
    method = method.toUpperCase();
    // const params = new URLSearchParams(search_params);
    // if (params.toString()) {
    //     url += '?' + params.toString();
    // }

    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (method !== 'GET' && method !== 'HEAD') {
        options.body = JSON.stringify(payload);
    }

    try {
        const res_obj = {
            status_code: 0,
            payload: []
        };

        const res = await fetch(url, options);

        let payload;
        try {
            const text = await res.text();
            if (text) {
                payload = JSON.parse(text);
            }
        } catch (error) {
            console.error('ERROR:', error);
            return res_obj;
        }

        res_obj.payload = payload;
        res_obj.status_code = res.status;

        return res_obj;
        
    } catch (error) {
        console.error('ERROR:', error);
        return {
            status_code: 0,
            payload: []
        };
    }
}

async function fill_stream()
{
    const { status_code, payload } = await req('api/msg/get-all', 'GET', null);

    if (status_code === 200) 
    {
        for (const msg of payload)
        {
            const msg_p = document.createElement('p');
            msg_p.classList.add('letter-msg', 'libertinus-mono-regular');
            msg_p.textContent = msg;
            
            const msg_article = document.createElement('article');
            msg_article.classList.add('letter');
            msg_article.appendChild(msg_p);
            
            messages_stream.appendChild(msg_article);
        }
        
    } else {
        req_feedback.className = 'error';
        req_feedback_p.textContent = payload.Error;
        req_feedback.style.display = 'block';
    }
};

fill_stream();

const x = req_feedback.querySelector('img');
x.addEventListener('click', () => {
    req_feedback.style.display = 'none';
});
