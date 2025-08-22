import generate_profile_picture from "./generate-profile-pic.js";

const side_nav = document.querySelector('#side-nav');
const open_side_nav_btn = document.querySelector('#open-side-nav-btn');
const main = document.querySelector('main');
const minify_nav_btn = side_nav.querySelector('button[title="minify nav"]');
const expand_nav_btn = side_nav.querySelector('button[title="expand nav"]');

(function main() 
{
    generate_profile_picture('a[href=profile] span', 50, 70);
    
    open_side_nav_btn.switch_class = 
    minify_nav_btn.switch_class    = 
    expand_nav_btn.switch_class    = 
    side_nav.switch_class          = switch_class;

    /* When one of these elements is clicked, 
    I stop the propagation, because also the document has a listener:
    close the side-nav when clicking outside of it. */
    side_nav.addEventListener('click', e => e.stopPropagation());
    open_side_nav_btn.addEventListener('click', e => e.stopPropagation());
})();

open_side_nav_btn.addEventListener('click', () => 
{    
    side_nav.switch_class('display-none', 'display-block');
    open_side_nav_btn.switch_class('display-block', 'display-none');    
    main.classList.add('display-opaque');
});

minify_nav_btn.addEventListener('click', () => 
{
    side_nav.querySelector('ul').classList.add('minified-list');
    minify_nav_btn.switch_class('display-block', 'display-none');
    expand_nav_btn.switch_class('display-none', 'display-block');
});

expand_nav_btn.addEventListener('click', () => 
{
    side_nav.querySelector('ul').classList.remove('minified-list');
    expand_nav_btn.switch_class('display-block', 'display-none');
    minify_nav_btn.switch_class('display-none', 'display-block');
});

document.addEventListener('click', () => 
{
    side_nav.switch_class('display-block', 'display-none');    
    open_side_nav_btn.switch_class('display-none', 'display-block');
    main.classList.remove('display-opaque');
});

function switch_class(old, _new) {
    this.classList.remove(old);
    this.classList.add(_new)
}

