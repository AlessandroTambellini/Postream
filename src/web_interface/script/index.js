import make_HTML_letter_card from "./utils/template.js";
import setup_feedback_cards from "./utils/feedback.js";
import req from "./utils/req.js";

const letters_container = document.querySelector('#letters-container');

const PAGE_LIMIT = 20;

async function fill_stream(flags, displayed_letters, f_reload = false)
{
    const feedback = document.querySelector('.feedback-card');
    feedback.hide();

    const search_params = {};
    search_params.page  = flags.sort === 'asc' ? flags.page_asc : flags.page_desc;
    search_params.sort  = flags.sort;
    search_params.limit = PAGE_LIMIT;

    const { status_code, payload } = await req('api/letter/page', search_params, 'GET', null);
           
    if (status_code !== 200) {
        feedback.show('error', payload.Error);
        return;
    }
    
    if (flags.sort !== 'rand') console.assert(search_params.page === payload.page);
    
    if (f_reload) letters_container.replaceChildren(); // Empty the stream

    let new_letters = 0;

    for (const letter of payload.letters)
    {
        if (displayed_letters.has(letter.id)) continue;
        displayed_letters.add(letter.id);
        new_letters++;

        letters_container.innerHTML += make_HTML_letter_card(letter.id, letter.message, letter.timestamp, true, true);
    }

    if (!new_letters)
    {
        if (payload.num_of_letters === displayed_letters.size) {
            feedback.show('info', 'There aren\'t new letters.');
        } else {
            feedback.show('warn', 'No new letters retrieved. They where retrieved just letters already present in the stream.');
        }
    }

    if (flags.sort === 'asc') flags.page_asc++;
    else if (flags.sort === 'desc') flags.page_desc++;
};

/* For now I implemented this function to keep track of the letters rendered from the server on first loading of the page.
I may 'share' flags and displayed_letters between web-interface and server, 
but not for now that I have really few, little things.  */
function identify_displayed_letters(flags, displayed_letters)
{
    for (const letter of letters_container.children)
    {
        const id = Number(letter.querySelector('a').href.split('id=')[1]);
        displayed_letters.add(id);
    }

    flags.page_asc++; // Because the letters are retrieved in ascending order on first paint
}

(function main() 
{
    const reload_letters_btn = document.querySelector('#reload-letters-btn');
    const controls = document.querySelectorAll('.control');
    const displayed_letters = new Set();

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

    reload_letters_btn.addEventListener('click', () => 
    {
        // Reset
        flags.page_asc = 1;
        flags.page_desc = 1;
        displayed_letters.clear();

        fill_stream(flags, displayed_letters, true);
    });

    document.querySelector('#load-more-letters-btn').addEventListener('click', () => 
    {
        fill_stream(flags, displayed_letters);
    });

    /*
     * 
     *  Calls
     */

    setup_feedback_cards();
    identify_displayed_letters(flags, displayed_letters);
})();

