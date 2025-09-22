import { req, show_feedback_card, hide_feedback_card, err_msg } from './_utils.js';

const feedback_card = document.querySelector('.feedback-card');

feedback_card.querySelector('.close-btn').addEventListener('click', () => hide_feedback_card(feedback_card));

document.querySelectorAll('.delete-notification-btn').forEach(btn => 
{
    btn.addEventListener('click', async () => 
    {
        hide_feedback_card(feedback_card);

        const notification_id = btn.id.split('-')[1];
        const { status_code, payload, req_error } = await req('api/user/notifications', 'DELETE', { id: notification_id });
    
        if (req_error) 
        {
            notification_card.classList.remove('deleting');
            btn.disabled = false;
            show_feedback_card(feedback_card, 'error', err_msg(status_code, 'notification', 'delete'));
        } 
        else {
            const notification_card = document.querySelector(`#notification-card-${notification_id}`);
            notification_card.classList.add('deleting');
            btn.disabled = true;

            setTimeout(() => {
                notification_card.remove();
            }, 300); // Matches the .notification-card transition duration
        }
    });
});
