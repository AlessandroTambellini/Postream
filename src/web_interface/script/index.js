import letter_to_HTML from "./utils/template.js";
import setup_feedback_cards from "./utils/feedback.js";
import req from "./utils/req.js";

const msgs_container = document.querySelector('#msgs-container');

const PAGE_LIMIT = 20;

async function fill_stream(flags, displayed_msgs, f_reload = false)
{
    const feedback = document.querySelector('.feedback-card');
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
    
    if (f_reload) msgs_container.replaceChildren(); // Empty the stream

    let new_msgs = 0;

    for (const msg_obj of payload.msgs)
    {
        if (displayed_msgs.has(msg_obj.id)) continue;
        displayed_msgs.add(msg_obj.id);
        new_msgs++;

        msgs_container.innerHTML += letter_to_HTML(msg_obj.id, msg_obj.content, msg_obj.timestamp, true, true);
    }

    if (!new_msgs)
    {
        if (payload.num_of_msgs === displayed_msgs.size) {
            feedback.show('info', 'There aren\'t new messages.');
        } else {
            feedback.show('warn', 'No new msgs retrieved. They where retrieved just msgs already present in the stream.');
        }
    }

    if (flags.sort === 'asc') flags.page_asc++;
    else if (flags.sort === 'desc') flags.page_desc++;
};

(function main() 
{
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

        fill_stream(flags, displayed_msgs, true);
    });

    document.querySelector('#load-more-msgs-btn').addEventListener('click', () => 
    {
        fill_stream(flags, displayed_msgs);
    });

    /*
     * 
     *  Calls
     */

    setup_feedback_cards();
})();

