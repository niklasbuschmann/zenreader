import './index.sass'
import { createStore } from 'solid-js/store';
import { render } from 'solid-js/web';
import api from './api.jsx';
import App from './components/app.jsx';

const [state, setState] = createStore(api.init());
const actions = {
  select: selected => setState({selected}),
  edit: editing => setState({editing}),
  search: searching => setState({searching}),
  configure: configuring => setState({configuring}),
  throwerror: error => setState({error}),
  set: changed => {
    setState('settings', changed);
    api.save('settings', state.settings).catch(actions.throwerror);
  },
  replace: (updated, old, discard) => {
    const feeds = discard ? updated : updated.concat(state.feeds.filter(feed => feed !== old)).filter((feed, index, self) => self.map(feed => feed.url).indexOf(feed.url) === index);
    setState({feeds, editing: false, selected: false});
    api.save('feeds', state.feeds).catch(actions.throwerror);
    actions.fetch();
  },
  mark: (id, isread) => {
    setState('read', id, isread);
    api.save('read', state.read).catch(actions.throwerror);
  },
  markall: () => {
    (state.selected || state.feeds.map(feed => feed.url)).flatMap(url => state.articles[url]).forEach(article => setState('read', article.id, 1));
    api.save('read', state.read).catch(actions.throwerror);
  },
  fetch: () => Promise.all(state.feeds.map(feed => api.articles(feed.url)
    .then(articles => articles.slice(0, state.settings.load))
    .then(articles => {
      if (articles[feed.url] && state.settings.notify)
        api.notify(feed, articles.filter(article => state.articles[feed.url].every(current => current.id !== article.id)));
      setState('articles', feed.url, articles);
      return articles;
    }).catch(error => [])
  ))
};

api.load().then(updated => {
  setState(updated);
  actions.fetch().then(articles => {
    setState({loading: false, read: Object.fromEntries(articles.flat().filter(article => state.read[article.id]).map(article => [article.id, 1]))});
    setInterval(actions.fetch, 60000 * state.settings.frequency);
  });
}).catch(error => {
  setState({error, configuring: 'Login'});
});
window.onunload = () => {
  localStorage.setItem('state', state.settings.cache ? JSON.stringify(state) : '');
};

render(() => <App {...state} {...actions} selected={state.selected || state.feeds.map(feed => feed.url)} />, document.body)
