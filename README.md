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
2) **Why don't I use a template for the html pages (e.g. to include `<head>` and few other universal components)?**
    * I should read two files instead of one: the template file and the page-specific file.
    * Copy-pasting a couple of components isn't a problem for my fingers **+** I have an Emmet abbreviation to create the boilerplate of an HTML page
    * I don't want to complicate the code with useless interpolations. I use them where necessary.
