function make_HTML_letter_card(letter, f_reply = false, f_cut_message = false)
{
    const { id, message, timestamp } = letter;

    let message_HTML = `<p>{{ message }}{{ read_entirely_link }}</p>`;
    if (f_cut_message && message.length > 70*10)
    {
        const first_part_of_message = message.substring(0, 70*10) + '...';
        const read_entirely_link = `<a href='read-letter?id=${id}'>read entirely</a>`;
        message_HTML = message_HTML.replace('{{ message }}', first_part_of_message);
        message_HTML = message_HTML.replace('{{ read_entirely_link }}', read_entirely_link);
    } else {
        message_HTML = message_HTML.replace('{{ message }}', message);
        message_HTML = message_HTML.replace('{{ read_entirely_link }}', '');
    }

    const date = `<time datetime="${timestamp}">${new Date(timestamp).toLocaleString()}</time>`;
    let reply_link = f_reply ? `<a href='write-reply?id=${id}'>Reply</a>` : '';

    const letter_HTML = `
        <article class="letter-card">
            ${message_HTML}
            ${date}
            ${reply_link}
        </article>
    `;

    return letter_HTML;
}

export default make_HTML_letter_card;
