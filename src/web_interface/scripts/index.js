import { req, setup_feedback_cards } from "./utils.js";

const msg_stream = document.querySelector('#msg-stream');
const msgs_container = msg_stream.querySelector('#msgs-container');

const PAGE_LIMIT = 20;

async function fill_stream(flags, displayed_msgs)
{
    const feedback = msg_stream.querySelector('.feedback-card');
    feedback.hide();

    const search_params = {};
    search_params.page  = flags.sort === 'asc' ? flags.page_asc : flags.page_desc;
    search_params.sort  = flags.sort;
    search_params.limit = PAGE_LIMIT;

    const { status_code, payload } = await req('api/msg/page', search_params, 'GET', null);
    
    if (status_code !== 200) {
        feedback.show('error', payload.Error);
        return;
    }
        
    if (flags.sort !== 'rand') console.assert(search_params.page === payload.page);
    
    let new_msgs = 0;

    for (const msg_obj of payload.msgs)
    {
        if (displayed_msgs.has(msg_obj.id)) continue;
        displayed_msgs.add(msg_obj.id);
        new_msgs++;

        const msg_txt = document.createElement('p');
        msg_txt.classList.add('msg-txt');
        msg_txt.textContent = msg_obj.content;

        const msg_date = document.createElement('time');
        msg_date.dateTime = msg_obj.timestamp;
        msg_date.textContent = new Date(msg_obj.timestamp).toLocaleString()
        
        const msg_card = document.createElement('article');
        msg_card.classList.add('msg-card');
        
        msg_card.appendChild(msg_txt);
        msg_card.appendChild(msg_date);
        msgs_container.appendChild(msg_card);
    }

    if (!new_msgs)
    {
        if (payload.num_of_msgs === displayed_msgs.size) {
            feedback.show('info', 'All msgs have been already retrieved.');
        } else {
            feedback.show('warn', 'No new msgs retrieved. They where retrieved just msgs already present in the stream.');
        }
    }

    if (flags.sort === 'asc') flags.page_asc++;
    else if (flags.sort === 'desc') flags.page_desc++;
};

(function main() 
{
    /*
     * 
     *  Msg Stream 
     */

    const reload_msgs_btn = document.querySelector('#reload-msgs-btn');
    const controls = document.querySelectorAll('.control');
    const displayed_msgs = new Set();

    const flags = {
        sort: 'asc',
        // Keep track of how many pages are retrieved in both ascending and descending order
        page_asc: 1,
        page_desc: 1,
    };

    controls.forEach(ctrl => {
        ctrl.addEventListener('click', function() {
            flags.sort = this.value;
            controls.forEach(_ctrl => _ctrl.classList.remove('selected'));
            this.classList.add('selected');
        })
    });

    reload_msgs_btn.addEventListener('click', () => 
    {
        // Reset
        flags.page_asc = 1;
        flags.page_desc = 1;
        displayed_msgs.clear();
        msgs_container.replaceChildren(); // Empty the stream

        fill_stream(flags, displayed_msgs);
    });

    msg_stream.querySelector('#load-more-msgs-btn').addEventListener('click', () => 
    {
        fill_stream(flags, displayed_msgs);
    });

    /*
     * 
     *  Msg Form 
     */



    /*
     * 
     *  Misc 
     */

    setup_feedback_cards();

    // fill_stream is asynchronous, but in this case doesn't make any difference
    fill_stream(flags, displayed_msgs);
})();

