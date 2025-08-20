/* WARN! these functions aren't used. just playin around */

let notification_allowed = false;

function get_notification_permission() {
    Notification.requestPermission().then(permission => {
        if (permission === 'granted')
            notification_allowed = true;
    });
}

function send_reply_notification(body) {
    if (notification_allowed) {
        new Notification('New reply', {
            body: `New reply for: ${body}...`
        });
    }
}

// get_notification_permission();

export {
    send_reply_notification,
}
