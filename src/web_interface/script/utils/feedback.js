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

// Feedback prop
function hide_feedback() {
    this.className = 'feedback-card';
    this.classList.add('none');
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

export default setup_feedback_cards;
