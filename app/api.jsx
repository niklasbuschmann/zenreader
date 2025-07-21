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
});

const load = () => query('api/').then(check).then(response => response.json());

const save = (param, value) => query(`api/${param}/`, value).then(check);

const articles = url => fetch(`feed/${encodeURIComponent(url)}`)
  .then(response => response.ok ? response : Promise.reject(`Connection failed: Could not load articles from ${url}`))
  .then(data => data.json() || Promise.reject(`Parsing failed: Could not load articles from ${url}`))
  .then(data => data.sort((a, b) => b.date - a.date));

const notify = (feed, articles) => {
  const message = {
    title: `${feed.title}: ${articles.length} new article` + articles.length === 1 ? '' : 's',
    body: articles.map(article => article.title).join('\n'),
    icon: `https://${feed.url.split('/')[2]}/favicon.ico`
  };
  if (articles.length && document.hidden && Notification.permission === 'granted')
    new Notification(message.title, message);
};

const init = () => {
  let state = {
    feeds: [],
    read: {},
    articles: {},
    settings: {
      load: 100,
      frequency: 5,
      cache: true,
      notify: false,
      invert: false,
      layout: false,
      dark: false,
      showread: false
    }
  };

  if (localStorage.getItem('state'))
    state = JSON.parse(localStorage.getItem('state'));

  state.loading = true;
  state.error = false;

  return state;
};

export default {user, login, load, save, articles, notify, init};
