function generate_profile_picture(element, max_num_of_circles, size)
{
    const rand_int = (max) => Math.floor(Math.random() * max + 1);

    const profile_picture = document.querySelector(element);

    // In the profile page or when logged out, there is no profile-icon in the side-nav
    if (!profile_picture) return;
    
    const num_of_circles = Math.max(20, rand_int(max_num_of_circles));

    for (let i = 0; i < num_of_circles; i++)
    {
        const circle = document.createElement('span');
        circle.classList.add('circle');

        circle.style.width = `${rand_int(size/2.5)}px`;
        circle.style.backgroundColor = `rgb(${rand_int(256)}, ${rand_int(256)}, ${rand_int(256)})`;
        circle.style.top = `${rand_int(size/10*9)}px`;
        circle.style.left = `${rand_int(size/10*9)}px`;

        profile_picture.appendChild(circle);
    }
}

export default generate_profile_picture;
