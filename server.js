const express = require('express');
const compression = require('compression');
const bodyParser = require('body-parser');
const basicAuth = require('express-basic-auth');
const storage = require('node-persist');
const feedapi = require('./feedapi.js');
const users = require('./users.json');

const app = express();

storage.init();

app.use(compression());

app.use('/', express.static('./public'));

app.use('/api/', bodyParser.json());
app.use('/api/', basicAuth({users: users}));
app.use('/api/', function (req, res, next) {
  storage.getItem(req.auth.user).then(function (user) {
    req.user = user || {};
    next();
  });
  res.on('finish', function () {
    storage.setItem(req.auth.user, req.user);
  });
});

app.get('/api/', function (req, res) {
  res.json(req.user);
});

app.put('/api/:key', function (req, res) {
  req.user[req.params.key] = req.body;
  res.send('success');
});

app.get('/feed/:url', feedapi);

app.listen(process.argv[2] || process.env.PORT || 8080, function () {
  console.log('Listening on port ' + this.address().port);
});
