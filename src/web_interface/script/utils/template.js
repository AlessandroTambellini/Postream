function letter_to_HTML(id, content, timestamp, f_reply = false, f_cut_content = false)
{
    let letter_text = `<p>{{ letter_text }}{{ read_entirely_link }}</p>`;
    if (f_cut_content && content.length > 70*10)
    {
        const first_part_of_content = content.substring(0, 70*10) + '...';
        const read_entirely_link = `<a href='read-letter?id=${id}'>read entirely</a>`;
        letter_text = letter_text.replace('{{ letter_text }}', first_part_of_content);
        letter_text = letter_text.replace('{{ read_entirely_link }}', read_entirely_link);
    } else {
        letter_text = letter_text.replace('{{ letter_text }}', content);
        letter_text = letter_text.replace('{{ read_entirely_link }}', '');
    }

    const date = `<time datetime="${timestamp}">${new Date(timestamp).toLocaleString()}</time>`;
    let reply_link = f_reply ? `<a href='write-reply?id=${id}'>Reply</a>` : '';

    const letter_HTML = `
        <article class="msg-card">
            ${letter_text}
            ${date}
            ${reply_link}
        </article>
    `;

    return letter_HTML;
}

export default letter_to_HTML;
