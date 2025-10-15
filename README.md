# Postream
A proof of concept of website built with native web technologies.  
The website is an application where posts are shared anonymously and they can receive replies,
but the replies are visible only to the author of the post. 

## Setup
Node.js version used: `v22.14.0`

1) Create a `.env` file in the root folder
2) Fill the `.env` file with the following content:
    ```.env
    HASHING_SECRET=your_hashing_secret
    NODE_ENV=development
    ```
3) Install the dependencies: `npm install`
4) Optionally, if you want to fill the website with some account, post and reply, you can run `seed.mjs` via `node src/seed.mjs`. Then, you can also login with the passwords of the accounts created outputted on the console.

Now you are ready to go. Run `npm run dev` to start the app.  

## Considerations
1) **Why is the password generated automatically?**
    Because the password serves as the only identifier of the user and so it must be unique.
    Therefore, during the account creation, I cannot tell the user if the choosen password is available or not, otherwise I would practically give him access to someone else profile.

2) **Navigation of the website**:
    The website is composed of 10 pages, 6 of which are basically forms.
    * The links that can be present in the side-panel are: 
        * if logged-in: `[profile, index, notifications, write-post, logout, delete-account]`
        * if logged-out: `[index, login, create-account]`
        * delete-account is present only if the current-page is profile.
    * There are also read-post and write-reply, but these pages are accessible from the post-card itself, not from the side-panel.
    * I don't show the login and create-account links while you are logged-in because it would be confusing, but it's still possible to access them:
        * If you login again, you simply extend the session.
        * If you create an account, you are switched to the newly created account.

3) **Production**:
    This webapp isn't meant for production. There are topics not covered that are outside the scope of this project:
    - **Minification/Compression** of the files sent to the client
    - **A Cache Policy**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
    - **Rate limiting and bot identifier**: The server can be easily bombarded with requests
    - **HTTPS** is disabled but it is easily implementable by uncommenting the code in `server.mjs`. 
    Then, to generate private-key and certificate run:
    `openssl req -newkey rsa:2048 -nodes -x509 -keyout -sha256 -subj '/CN=localhost' private-key.pem -out certificate.pem`.
    HTTPS is required for the transmission of the account password over the network when creating an account and while logging-in.

5) **A side note on commits**:
    My commit messages usually don't mean anything, for a couple of reasons:
    * I develop alone
    * I don't develop per fixed isolated chunks of changes. Usually I play around and a change has a domino effect
    on other parts of the code and once I made the 'big' change, I commit it. 
    Still, sometimes I don't even commit with a meaningful msg because I find it to be mostly useless.
    I usually scroll the commit history to navigate the changes I made over time.

## TODO
Implement pagination for user posts in the profile page and for the notifications (in the notifications page)
