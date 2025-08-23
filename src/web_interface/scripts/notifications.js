import { err_msg, setup_feedback_cards } from "./utils/feedback.js";
import req from "./utils/req.js";

const feedback = document.querySelector('.feedback-card');

setup_feedback_cards();

document.querySelectorAll('.delete-notification-btn').forEach(btn => {
    btn.addEventListener('click', async () => 
    {
        const notification_id = btn.id.split('-')[1];
        const { status_code, payload, req_error } = await req('api/user/notifications', 'DELETE', { id: notification_id });
    
        const notification_card = document.querySelector(`#notification-card-${notification_id}`);
        notification_card.classList.add('deleting');
        btn.disabled = true;

        if (req_error) 
        {
            notification_card.classList.remove('deleting');
            btn.disabled = false;
            feedback.show('error', err_msg(status_code, 'notification', 'delete'));
        } 
        else {
            setTimeout(() => {
                notification_card.remove();
            }, 300); // Matches the .notification-card transition duration
        }
    });
});
