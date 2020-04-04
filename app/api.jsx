const user = JSON.parse(localStorage.getItem('user')) || {name: 'user', password: ''};

const login = (name, password) => {
  localStorage.setItem('user', JSON.stringify({name, password, credentials: true}));
  location.assign('');
};

const check = response => response.ok ? response : Promise.reject({
  message: `Could not connect to backend: ${response.status} ${response.statusText}`,
  status: response.status
});

const query = (url, body) => fetch(url, {
  headers: {
    'Authorization': `Basic ${btoa(user.name + ':' + user.password)}`,
    'Content-Type': 'application/json'
  },
  method: body ? 'PUT' : 'GET',
  body: JSON.stringify(body)
})

const load = () => query('api/').then(check).then(response => response.json());

const save = (param, value) => query(`api/${param}/`, value).then(check);

const feeds = (url, num) => fetch(`feed/${encodeURIComponent(url)}`)
  .then(response => response.ok ? response : Promise.reject(`Connection failed: Could not load articles from ${url}`))
  .then(data => data.json())
  .then(data => data || Promise.reject(`Parsing failed: Could not load articles from ${url}`))
  .then(data => data.sort((a, b) => b.date - a.date).slice(0, num));

const notify = (feed, articles) => {
  const message = {
    title: `${feed.title}: ${articles.length} new article` + articles.length === 1 ? '' : 's',
    body: articles.map(article => article.title).join('\n'),
    icon: `https://${feed.url.split('/')[2]}/favicon.ico`
  };
  if (articles.length && document.hidden && Notification.permission === 'granted')
    new Notification(message.title, message);
}

export default {user, login, load, save, feeds, notify};
