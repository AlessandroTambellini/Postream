import generate_profile_picture from "./generate-profile-pic.js";

generate_profile_picture('#profile-pic-mini', 50, 70);

const side_nav = document.querySelector('#side-nav');
const open_side_nav_btn = document.querySelector('#open-side-nav-btn');
const main = document.querySelector('main');

open_side_nav_btn.addEventListener('click', () => 
{    
    side_nav.classList.remove('display-none');
    side_nav.classList.add('display-block');

    open_side_nav_btn.classList.remove('display-block');
    open_side_nav_btn.classList.add('display-none');
    
    main.classList.add('display-opaque');
});

side_nav.addEventListener('click', e => e.stopPropagation());
open_side_nav_btn.addEventListener('click', e => e.stopPropagation());

document.addEventListener('click', () => {
    side_nav.classList.remove('display-block');
    side_nav.classList.add('display-none');

    open_side_nav_btn.classList.remove('display-none');
    open_side_nav_btn.classList.add('display-block');

    main.classList.remove('display-opaque');
});

