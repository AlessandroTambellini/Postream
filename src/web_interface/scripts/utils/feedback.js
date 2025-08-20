function show_feedback(type, msg) 
{
    // reset the classes
    this.className = 'card feedback-card';

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
    } else if (type === 'warn') { 
        this.classList.add('feedback-warn');
        icon.textContent = '!';
        title.textContent = 'Warning';
        this.classList.add('flex');
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

function hide_feedback() {
    this.className = 'card feedback-card';
    this.classList.add('display-none');
}

function setup_feedback_cards()
{
    document.querySelectorAll('.feedback-card').forEach(card => {
        // Attach properties to the feedback cards.
        card.show = show_feedback;
        card.hide = hide_feedback;
        card.querySelector('.close-btn').addEventListener('click', () => card.hide());
    });
}

/* This function is to make sense of the possible errors coming from the server 
that to the user wouldn't make much sense. 
That errors returned from the server are useful when playing around with the API, not on the website. */
function err_msg(status_code, entity, action) 
{
    if (status_code === 500) return 'Un unknown error has occured in the server. Please, try again later.';
    else if (status_code === 401) return `You aren't authenticated. Please, login before trying to ${action} a ${entity}.`;
    else return `Invalid ${entity}`;
}

export { setup_feedback_cards, err_msg };
