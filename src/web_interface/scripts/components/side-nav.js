import { generate_profile_picture, switch_class } from "../_utils.js";

const side_nav = document.querySelector('#side-nav');
const open_side_nav_btn = document.querySelector('#open-side-nav-btn');
const main = document.querySelector('main');
const minify_nav_btn = side_nav.querySelector('button[title="minify nav"]');
const expand_nav_btn = side_nav.querySelector('button[title="expand nav"]');

generate_profile_picture('a[href=profile] span', 50, 70);

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

main.addEventListener('click', e => 
{
    switch_class(side_nav, 'display-block', 'display-none');    
    switch_class(open_side_nav_btn, 'display-none', 'display-block');
    main.classList.remove('display-opaque');
});

// const eventSource = new EventSource('api/active-clients');

// const notifications_item = side_nav.querySelector('li[itemprop=notifications]');

// eventSource.onmessage = function(event) {
//     console.log(event.data);
//     notifications_item.classList.add('new-notification');
// };

// notifications_item?.addEventListener('click', () => {
//     notifications_item.classList.remove('new-notification');
// });

// eventSource.onerror = function(err) {
//     console.error("Event failed:", err);
// };
