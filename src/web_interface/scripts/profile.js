import generate_profile_picture from "./utils/generate-profile-pic.js";

// function generate_profile_picture(max_num_of_circles, size)
// {
//     const rand_int = (max) => Math.floor(Math.random() * max + 1);

//     const profile_picture = document.querySelector('#profile-picture');

//     const num_of_circles = Math.max(10, rand_int(max_num_of_circles));

//     for (let i = 0; i < num_of_circles; i++)
//     {
//         const circle = document.createElement('div');
//         circle.classList.add('circle');

//         circle.style.width = `${rand_int(size/2.5)}px`;
//         circle.style.backgroundColor = `rgb(${rand_int(256)}, ${rand_int(256)}, ${rand_int(256)})`;
//         circle.style.top = `${rand_int(size/10*9)}px`;
//         circle.style.left = `${rand_int(size/10*9)}px`;

//         profile_picture.appendChild(circle)
//     }
// }

generate_profile_picture('#profile-picture', 50, 300);
