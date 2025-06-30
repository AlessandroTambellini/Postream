const tweet_form = document.querySelector('#tweet-form');
const submit_tweet_btn = tweet_form.querySelector('#submit-tweet-btn');
const req_feedback = tweet_form.querySelector('#req-feedback');

tweet_form.addEventListener('submit', async e => {
    e.preventDefault();
    console.log('trying to submit form');

    const { status_code, payload } = await client_request(undefined, 'api/tweet', 'POST', undefined, req_obj);

    if (status_code === 200) {
        feedback.className = 'success-msg';
        feedback.textContent = payload.Success;
    } else {
        feedback.className = 'error-msg';
        feedback.textContent = payload.Error;
    }
    feedback.style.display = 'block';
});

async function req(path, method, search_params = {}, payload = {}) 
{
    let url = path;
    const params = new URLSearchParams(search_params);
    if (params.toString()) {
        url += '?' + params.toString();
    }

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
        const res = await fetch(url, options);
        
        const res_obj = {
            status_code: res.status
        };

        try {
            const text = await res.text();
            if (text) {
                res_obj.payload = JSON.parse(text);
            }
        } catch (error) {
            console.error('JSON parse error:', error);
        }

        return res_obj;
        
    } catch (error) {
        return {
            status_code: 0,
            status_text: error.message
        };
    }
}
