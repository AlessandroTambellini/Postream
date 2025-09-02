import { generate_profile_picture, switch_class } from "../_utils.js";

const side_nav = document.querySelector('#side-nav');
const open_side_nav_btn = document.querySelector('#open-side-nav-btn');
const main = document.querySelector('main');
const minify_nav_btn = side_nav.querySelector('button[title="minify nav"]');
const expand_nav_btn = side_nav.querySelector('button[title="expand nav"]');

generate_profile_picture('a[href=profile] span', 50, 70);

/* When one of these elements is clicked, 
I stop the propagation, because also the document has a listener:
close the side-nav when clicking outside of it. */
side_nav.addEventListener('click', e => e.stopPropagation());
open_side_nav_btn.addEventListener('click', e => e.stopPropagation());

open_side_nav_btn.addEventListener('click', () => 
{    
    switch_class(side_nav, 'display-none', 'display-block');
    switch_class(open_side_nav_btn, 'display-block', 'display-none');    
    main.classList.add('display-opaque');
});

minify_nav_btn.addEventListener('click', () => 
{
    side_nav.querySelector('ul').classList.add('minified-list');
    switch_class(minify_nav_btn, 'display-block', 'display-none');
    switch_class(expand_nav_btn, 'display-none', 'display-block');
});

expand_nav_btn.addEventListener('click', () => 
{
    side_nav.querySelector('ul').classList.remove('minified-list');
    switch_class(expand_nav_btn, 'display-block', 'display-none');
    switch_class(minify_nav_btn, 'display-none', 'display-block');
});

document.addEventListener('click', () => 
{
    switch_class(side_nav, 'display-block', 'display-none');    
    switch_class(open_side_nav_btn, 'display-none', 'display-block');
    main.classList.remove('display-opaque');
});

// function switch_class(old, _new) {
//     this.classList.remove(old);
//     this.classList.add(_new)
// }

