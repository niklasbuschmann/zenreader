let state = {
  feeds: [],
  read: {},
  articles: {},
  settings: {
    load: 50,
    frequency: 5,
    zoom: 0,
    cache: true,
    overwrite: true,
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
state.editing = state.error = state.search = state.configure = false;
state.selected = state.feeds.map(feed => feed.url);

export default state;
