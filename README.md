# Post Stream
It is basically a website where posts are shared anonymously and they can receive replies,
but the replies are only visible to the author of the post. 

## Setup
Node.js version used: `v22.14.0`

```bash
npm install
npm run dev
```
The database will be created automatically on first run.

## Map of the website
https://excalidraw.com/#json=CF1WWhoiTgfj_nCEqNzpR,BcgmPkWFjCUH4OuFcXjnPQ  
You can also load the scene data file `Website-Map.excalidraw` into Excalidraw.

## Considerations
1) **Why is the password generated automatically?**
    Because the password serves as the sole identifier for the user and so it must be unique.
    Therefore, during the account creation, I cannot tell the user if the choosen password is available or not, otherwise I would practically give him access to someone else profile.

2) **Navigation of the website**:
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
It is required only for login and create-account because the password is transmitted in the payload of the request. See `API.user.POST` and `API.token.POST` in handlers.js
