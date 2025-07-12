async function req(path, search_params, method, payload) 
{
    let url = path;
    if (search_params) {
        const params = new URLSearchParams(search_params).toString();
        url += `?${params}`;
    }

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

export default req;
