async function req(path, search_params, method, payload) 
{
    const params = new URLSearchParams(search_params).toString();
    const url = params ? `${path}?${params}` : path;

    method = method.toUpperCase();
    
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (method !== 'GET' && method !== 'HEAD') {
        // I expect a payload to be there
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
            console.error('ERROR:', error.message);
            return res_obj;
        }

        res_obj.payload = payload;
        res_obj.status_code = res.status;

        return res_obj;
        
    } catch (error) {
        console.error('ERROR:', error.message);
        return {
            status_code: 0,
            payload: []
        };
    }
}

// Feedback prop
function show_feedback(type, msg) 
{
    this.className = 'feedback-card';

    const icon = this.querySelector('.feedback-icon');
    const title = this.querySelector('.feedback-title');

    if (type === 'info') {
        this.classList.add('feedback-info');
        icon.textContent = 'i';
        title.textContent = 'Info';
        this.classList.add('vanish');
    } else if (type === 'success') {
        this.classList.add('feedback-success');
        icon.textContent = '✓';
        title.textContent = 'Success';
        this.classList.add('vanish');
    } else if (type === 'error') {
        this.classList.add('feedback-error');
        icon.textContent = '!';
        title.textContent = 'Error';
        this.classList.add('flex');
    } else {
        console.error(`Invalid feedback type. Passed '${type}.'`);
    }

    this.querySelector('.feedback-text').textContent = msg;
}

// Feedback prop
function hide_feedback() {
    this.className = 'feedback-card';
    this.classList.add('none');
}

export {
    req,
    show_feedback,
    hide_feedback
};
