
document.querySelector('form').addEventListener('submit', e => 
{
    e.preventDefault();
    document.cookie = 'password_hash=';
    location.href = '/';
});
