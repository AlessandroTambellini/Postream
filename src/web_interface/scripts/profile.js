/* Profile Image Art
I generate a kind of profile icon every time the page is accessed.
I felt the page was without an identity. It was not clear it is a profile page. */

const rand_int = (max) => Math.floor(Math.random() * max + 1);

const profile_picture = document.querySelector('#profile-picture');

const profile_face = profile_picture.querySelector('img');
profile_face.style.top = `${Math.max(20, rand_int(250))}px`;
profile_face.style.left = `${Math.max(10, rand_int(250))}px`;

const num_of_circles = Math.max(10, rand_int(50));

for (let i = 0; i < num_of_circles; i++)
{
    const circle = document.createElement('div');
    circle.classList.add('circle');

    circle.style.width = `${rand_int(120)}px`;
    circle.style.backgroundColor = `rgb(${rand_int(256)}, ${rand_int(256)}, ${rand_int(256)})`;
    circle.style.top = `${rand_int(270)}px`;
    circle.style.left = `${rand_int(270)}px`;

    profile_picture.appendChild(circle)
}
