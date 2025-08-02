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

export default req;
