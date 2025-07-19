const crypto = require('crypto');
const needle = require('needle');
const feedparser = require('feedparser');
const JSONStream = require('JSONStream');
const es = require('event-stream');
const xss = require('xss');

const parser = () => es.map((entry, callback) => {
  callback(null, {
    author: entry.author || entry.meta.author || entry.meta.title,
    title: entry.title,
    link: entry.link,
    date: Date.parse(entry.date || entry.pubDate),
    id: crypto.createHash('sha256').update(entry.link).digest('base64').substring(0, 6),
    content: xss(entry.description || entry.summary, {stripIgnoreTag: true, stripIgnoreTagBody: ['script', 'style']})
  });
});

const feedapi = function (req, res) {
  const handleError = function (error) {
    res.status(500).send(error);
    this.unpipe();
  };
  const checkStatus = function (response) {
    if (response.statusCode >= 400)
      this.emit('error', {message: response.statusMessage});
  };
  needle.get(req.params.url, {parse: false, follow: 4}).on('error', handleError).on('response', checkStatus)
    .pipe(feedparser({feedurl: req.params.url}).on('error', handleError))
    .pipe(parser().on('error', handleError))
    .pipe(JSONStream.stringify().on('error', handleError))
    .pipe(res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60'
    })
  );
};

module.exports = feedapi;
