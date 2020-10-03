import { createState } from 'solid-js';
import { render } from 'solid-js/dom';
import api from './api.jsx';
import init from './init.jsx';
import App from './components/app.jsx';

const Data = () => {
  const [state, setState] = createState(init);
  const actions = {};

  actions.select = selected => setState({selected});
  actions.edit = editing => setState({editing});
  actions.search = search => setState({search});
  actions.configure = configure => setState({configure});
  actions.throwerror = error => {setState({error}); console.error(error)};
  actions.set = changed => {
    setState('settings', changed);
    api.save('settings', state.settings).catch(actions.throwerror);
  };
  actions.update = (feed, updated) => {
    if (state.articles[feed.url] && state.settings.notify)
      api.notify(feed, updated.filter(article => state.articles[feed.url].every(current => current.id !== article.id)));

    setState('articles', feed.url, updated)
  };
  actions.fetch = () => Promise.all(state.feeds.map(feed => api
    .feeds(feed.url, state.settings.load)
    .then(articles => actions.update(feed, articles) || articles)
    .catch(error => [])
  )).then(articles => {
    setState({loading: false, read: Object.fromEntries(articles.flat().filter(article => state.read[article.id]).map(article => [article.id, 1]))});
    clearTimeout(window.timeout);
    window.timeout = setTimeout(actions.fetch, 60000 * state.settings.frequency);
  });
  actions.sync = feeds => {
    setState({feeds, selected: feeds.map(feed => feed.url), editing: false});
    api.save('feeds', feeds).catch(actions.throwerror);
    actions.fetch();
  };
  actions.replace = (updated, old) => actions.sync(updated.concat(state.feeds.filter(feed => feed !== old)));
  actions.upload = feeds => actions.sync(state.settings.overwrite ? feeds : feeds.concat(state.feeds));
  actions.mark = (id, isread) => {
    setState('read', id, isread || undefined);
    api.save('read', state.read).catch(actions.throwerror);
  };
  actions.markall = () => {
    state.selected.flatMap(url => state.articles[url]).forEach(article => setState('read', article.id, true))
    api.save('read', state.read).catch(actions.throwerror);
  };

  api.load().then(updated => {
    setState(updated);
    actions.sync(state.feeds);
  }).catch(error => {
    setState({error, configure: 'Login'});
  });
  window.onunload = () => {
    localStorage.setItem('state', state.settings.cache ? JSON.stringify(state) : '');
  };

  return <App {...state} actions={actions} />
}

window.onload = () => render(Data, document.body);
