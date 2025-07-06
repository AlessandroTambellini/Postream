import { req, show_feedback, hide_feedback } from "./utils.js";

const msg_stream = document.querySelector('#msg-stream');
const load_more_btn = msg_stream.querySelector('#load-more-msgs-btn');
const msg_form = document.querySelector('#msg-form');

async function fill_stream(page_obj)
{
    const msgs_container = msg_stream.querySelector('#msgs-container');
    const feedback = msg_stream.querySelector('.feedback-card');

    feedback.hide();

    const { status_code, payload } = await req('api/msg/page', page_obj, 'GET', null);

    if (status_code === 200) 
    {
        // console.log(payload);
        page_obj.page++;
        const msgs_arr = payload.msgs;

        if (msgs_arr.length === 0) {
            console.log('There aren\'t new messages.');
            feedback.show('info', 'There aren\'t new messages.');
        } 

        for (const msg_obj of msgs_arr)
        {
            const msg_txt = document.createElement('p');
            msg_txt.classList.add('msg-txt', 'libertinus-mono-regular');
            msg_txt.textContent = msg_obj.content;
            
            const msg_card = document.createElement('article');
            msg_card.classList.add('msg-card');
            msg_card.appendChild(msg_txt);
            
            msgs_container.appendChild(msg_card);
        }
        
    } else {
        feedback.show('error', payload.Error);
    }
};

async function handle_msg_submission(e)
{
    e.preventDefault();

    const feedback = msg_form.querySelector('.feedback-card');
    const textarea = msg_form.querySelector('textarea');

    feedback.hide();

    if (textarea.value.trim().length === 0) {
        feedback.show('error', 'The msg is empty.');
        return;
    }

    const path = msg_form.attributes.action.value;
    const method = msg_form.attributes.method.value;
    const msg = textarea.value;

    const { status_code, payload } = await req(path, null, method, { msg });

    if (status_code === 200) 
        feedback.show('success', payload.Success);
    else 
        feedback.show('error', payload.Error);
    
    textarea.value = null;
}

(function main() 
{
    document.querySelectorAll('.feedback-card').forEach(card => {
        card.show = show_feedback;
        card.hide = hide_feedback;
        card.querySelector('.close-btn').addEventListener('click', () => card.hide());
    });
    
    msg_form.addEventListener('submit', handle_msg_submission);
    
    const page_obj = {
        page: 1,
        limit: 50,
    };
    
    fill_stream(page_obj);
    load_more_btn.addEventListener('click', () => fill_stream(page_obj));

})();

