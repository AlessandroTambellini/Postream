# Post Stream
It is basically a website where posts are shared anonymously and they can receive replies,
but the replies are only visible to the author of the post. 

## Setup
Node.js version used: `v22.14.0`

1) Create a `.env` file in the root folder
2) Fill the `.env` file with the following content:
    ```.env
    HASHING_SECRET=your_hashing_secret
    ENVIRONMENT=development
    ```
3) Generate the private key and the certificate:
    ```sh
    openssl req -newkey rsa:2048 -nodes -x509 -keyout -sha256 -subj '/CN=localhost' private-key.pem -out certificate.pem
    ```
4) Install the dependencies: `npm install`

Now you are ready to go. Run `npm run dev` to start the app.
Note: the database will be created automatically on first run.

## Considerations
1) **Why is the password generated automatically?**
    Because the password serves as the sole identifier for the user and so it must be unique.
    Therefore, during the account creation, I cannot tell the user if the choosen password is available or not, otherwise I would practically give him access to someone else profile.

2) **Navigation of the website**:
    The website is composed of 10 pages, 6 of which are basically forms.
    * The links that can be present in the side-nav are: 
        * if logged-in: 
            `[profile, index, notifications, write-post, logout, delete-account] - current-page`
        * if logged-out: 
            `[index, login, create-account] - current-page`
        * delete-account is present only if the current-page is profile.
    * There are also read-post and write-reply, but these pages are accessible from the post-card itself.
    * I don't show the login and create-account links while you are logged-in because it would be confusing, but it's still possible to access them:
        * If you login again, you simply extend the session.
        * If you create an account, you create a new account and you are switched to it.

3) **HTTPS**:
It is required only for login and create-account because the password is transmitted in the payload of the request. See `API.user.POST` and `API.token.POST` in `handlers.js`
