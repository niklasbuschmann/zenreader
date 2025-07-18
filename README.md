# Zenreader

**Installation**

Make sure to have [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) and [node.js](https://nodejs.org/en/download/package-manager/) installed, and then type:

```
git clone https://github.com/niklasbuschmann/zenreader.git
cd zenreader
npm install
node server.js 8080
```

**Users**

The installation comes preconfigured for a single default user named `user` with an empty password.
You can change this by editing `users.json`.
Always use a reverse proxy that enforces `https` connections if there are any sensitive passwords.

**Server**

[PM2](https://pm2.keymetrics.io/) can be used to automatically launch on boot:

```
npm install pm2 -g
pm2 start server.js
pm2 save
pm2 startup
```
