import { req, hide_feedback_card, show_feedback_card, err_msg } from './_universal.js';

const delete_post_dialog = document.querySelector('#delete-post-dialog');
const close_dialog_btn = document.querySelector('#close-dialog-btn');
const yes_btn = delete_post_dialog.querySelector('button[type=submit]');
const feedback_card = delete_post_dialog.querySelector('.feedback-card');

document.querySelectorAll('.delete-post-btn').forEach(btn => 
{
    btn.addEventListener('click', async e => 
    {
        delete_post_dialog.showModal();
        delete_post_dialog.returnValue = btn.id.split('-')[1];
    });
});

close_dialog_btn.addEventListener("click", () => {    
    delete_post_dialog.close();
    hide_feedback_card(feedback_card);
});

/* I'd like to close the dialog when clicking on its background, 
but I can't append a listener to ::backdrop,
and using e.composedPath() or e.currentTarget doesn't really help,
because ::backdrop is still part of the dialog.
The only option would be to let the elements inside the dialog to fill all the space available
inside the dialog itself, but it's a bit of an hack and not really precise. */

yes_btn.addEventListener('click', async e => 
{
    e.preventDefault();

    const post_id = delete_post_dialog.returnValue;
    const { status_code, payload, req_error } = await req('api/post', 'DELETE', { id: post_id });
    
    if (req_error) {
        show_feedback_card(feedback_card, 'error', err_msg(status_code, 'post', 'delete'));
    } 
    else {
        delete_post_dialog.close();
        const post_card = document.querySelector(`#post-card-${post_id}`);
        post_card.classList.add('deleting');
    }
});
