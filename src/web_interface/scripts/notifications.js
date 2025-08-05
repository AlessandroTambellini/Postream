import { err_msg, setup_feedback_cards } from "./utils/feedback.js";
import req from "./utils/req.js";

const feedback = document.querySelector('.feedback-card');

setup_feedback_cards();

document.querySelectorAll('.delete-notification-btn').forEach(btn => {
    btn.addEventListener('click', async () => 
    {
        const notification_id = btn.id.split('-')[1];
        const { status_code, payload, req_error } = await req('api/user/notifications', 'DELETE', { id: notification_id });
    
        if (req_error) {
            feedback.show('error', err_msg(status_code, 'notification', 'delete'));
        } else {
            document.querySelector(`#notification-card-${notification_id}`).remove()
        }
    });
});
