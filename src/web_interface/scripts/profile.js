/* Profile Image Art
I generate a kind of profile icon every time the page is accessed.
I felt the page was too emtpy and without an identity. */

const profile_img = document.querySelector('#profile-img');

const num_of_divs = Math.max(10, Math.floor(Math.random() * 50));

for (let i = 0; i < num_of_divs; i++)
{
    const div = document.createElement('div');
    div.className = 'profile-img-component';

    const size = Math.floor(Math.random() * 120);
    div.style.width = `${size}px`;
    div.style.top = `${Math.floor(Math.random() * 270)}px`;
    div.style.left = `${Math.floor(Math.random() * 270)}px`;

    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    div.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

    profile_img.appendChild(div)
}
