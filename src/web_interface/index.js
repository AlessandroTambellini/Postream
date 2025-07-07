import { req, show_feedback, hide_feedback } from "./utils.js";

const msg_stream = document.querySelector('#msg-stream');
const msgs_container = msg_stream.querySelector('#msgs-container');
const msg_form = document.querySelector('#msg-form');

async function fill_stream(msgs_search_params, flags, displayed_msgs)
{
    const feedback = msg_stream.querySelector('.feedback-card');
    feedback.hide();

    if (flags.retrieved_all_msgs) {
        feedback.show('info', 'No new msgs retrieved. All msgs have been already retrieved.');
        return;
    }

    msgs_search_params.page = msgs_search_params.asc ? flags.page_asc : flags.page_desc; 
    
    const { status_code, payload } = await req(flags.rand ? 'api/msg/page-rand' : 'api/msg/page', msgs_search_params, 'GET', null);
    
    if (status_code !== 200) {
        feedback.show('error', payload.Error);
        return;
    }
        
    if (!flags.rand) console.assert(msgs_search_params.page === payload.page);
    
    let new_msgs = 0;

    for (const msg_obj of payload.msgs)
    {
        if (displayed_msgs.has(msg_obj.id)) continue;
        displayed_msgs.add(msg_obj.id);
        new_msgs++;

        const msg_id = document.createElement('p');
        msg_id.textContent = msg_obj.id;

        const msg_txt = document.createElement('p');
        msg_txt.classList.add('msg-txt');
        msg_txt.textContent = msg_obj.content;

        const msg_date = document.createElement('time');
        msg_date.dateTime = msg_obj.timestamp;
        msg_date.textContent = new Date(msg_obj.timestamp).toLocaleString()
        
        const msg_card = document.createElement('article');
        msg_card.classList.add('msg-card');
        
        msg_card.appendChild(msg_id);
        msg_card.appendChild(msg_txt);
        msg_card.appendChild(msg_date);
        msgs_container.appendChild(msg_card);
    }

    if (!flags.rand && new_msgs === 0 && !payload.has_next) {
        feedback.show('info', 'No new msgs retrieved. All msgs have been already retrieved.');
        flags.retrieved_all_msgs = true;
    } else if (new_msgs === 0) {
        feedback.show('warn', 'No new msgs retrieved. They where retrieved just msgs already present in the stream.');
    }

    if (msgs_search_params.asc && !flags.rand) flags.page_asc++;
    if (!msgs_search_params.asc && !flags.rand) flags.page_desc++;
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

(async function main() 
{
    /*
     * 
     *  Msg Stream 
     */

    const reload_msgs_btn = msg_stream.querySelector('#reload-msgs-btn');
    // Controls
    const asc_msgs_btn = msg_stream.querySelector('#asc-msgs-btn');
    const desc_msgs_btn = msg_stream.querySelector('#desc-msgs-btn');
    const rand_msgs_btn = msg_stream.querySelector('#rand-msgs-btn');    
    const controls = msg_stream.querySelectorAll('.control');

    const displayed_msgs = new Set();

    const flags = {
        rand: false,
        page_asc: 1,
        page_desc: 1,
        retrieved_all_msgs: false,
    };

    const msgs_search_params = {
        page: 1,
        limit: 3,
        asc: false,
    };

    reload_msgs_btn.addEventListener('click', () => 
    {
        // Reset
        flags.page_asc = 1;
        flags.page_desc = 1;
        flags.retrieved_all_msgs = false;
        displayed_msgs.clear();
        msgs_container.replaceChildren(); // Empty the stream

        fill_stream(msgs_search_params, flags, displayed_msgs);
    });

    asc_msgs_btn.addEventListener('click', function() {
        msgs_search_params.asc = true;
        flags.rand = false;
        controls.forEach(control => control.classList.remove('selected'));
        this.classList.add('selected');
    });

    desc_msgs_btn.addEventListener('click', function() {
        msgs_search_params.asc = false;
        flags.rand = false;
        controls.forEach(control => control.classList.remove('selected'));
        this.classList.add('selected');
    });
    
    rand_msgs_btn.addEventListener('click', function() {
        flags.rand = true;
        controls.forEach(control => control.classList.remove('selected'));
        this.classList.add('selected');
    });

    msg_stream.querySelector('#load-more-msgs-btn').addEventListener('click', () => 
    {
        fill_stream(msgs_search_params, flags, displayed_msgs);
    });

    /*
     * 
     *  Msg submission 
     */

    msg_form.addEventListener('submit', handle_msg_submission);

    /*
     * 
     *  Misc 
     */

    document.querySelectorAll('.feedback-card').forEach(card => {
        card.show = show_feedback;
        card.hide = hide_feedback;
        card.querySelector('.close-btn').addEventListener('click', () => card.hide());
    });

    // fill_stream is asynchronous, but in this case doesn't make any difference
    fill_stream(msgs_search_params, flags, displayed_msgs);
})();

