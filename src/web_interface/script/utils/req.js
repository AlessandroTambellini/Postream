async function req(path, search_params, method, payload = null) 
{
    let url = path;
    if (search_params) {
        const params = new URLSearchParams(search_params).toString();
        url += `?${params}`;
    }
    
    method =  method.toUpperCase();
    
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
    };

    if (method !== 'GET' && method !== 'HEAD') {
        // If the payload is present or not, I send it anyway.
        options.body = JSON.stringify(payload);
    }

    const res_obj = {
        status_code: 0,
        payload: []
    };

    let server_res;
    try {
        server_res = await fetch(url, options);   
        res_obj.status_code = server_res.status;   
    } catch (error) {
        console.error('ERROR:', error.message);
        res_obj.payload = { Error: error.message };
        return res_obj;
    }
    
    try {
        // const text = await server_res.text();
        // if (text) {
        //     res_obj.payload = JSON.parse(text);
        // }
        res_obj.payload = await server_res.json();
    } catch (error) {
        console.error('ERROR:', error.message);
        res_obj.payload = { Error: error.message };
        return res_obj;
    }

    return res_obj;
}

export default req;
