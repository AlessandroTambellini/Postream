import { switch_class, hide_feedback_card } from "./_utils.js";

const side_nav = document.querySelector('#side-nav');
const open_side_nav_btn = document.querySelector('#open-side-nav-btn');
const main = document.querySelector('main');
const minify_nav_btn = side_nav.querySelector('#minify-nav-btn');
const expand_nav_btn = side_nav.querySelector('#expand-nav-btn');

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

const feedback_cards = document.querySelectorAll('.feedback-card');
        
feedback_cards.forEach(card => {
    card.querySelector('.close-btn').addEventListener('click', () => {
        hide_feedback_card(card);
    });
});
