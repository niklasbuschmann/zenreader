import Favicon from './favicon.jsx';

const tags = feeds => feeds
  .flatMap(feed => feed.tags)
  .filter((value, index, self) => self.indexOf(value) === index)
  .map(name => ({name: name, urls: feeds.filter(feed => feed.tags.includes(name)).map(feed => feed.url)}))
  .filter(tag => tag.urls.length > 1);

const size = (articles, read) => (articles || []).filter(article => !read[article.id]).length;

const Category = props =>
  <li className={'hover ' + (props.selected && 'selected')} onClick={props.select}>
    <div><span className="icon fa fa-folder" /><span>{props.title}</span></div>
    <span><span>{props.count || ''}</span></span>
  </li>

const MenuItem = props =>
  <li className={'clear hover ' + (props.selected && 'selected')} onClick={props.select}>
    <div><Favicon src={props.url} /><span>{props.title}</span></div>
    <span className="show"><span>{props.count || ''}</span></span>
    <button className="hide fa fa-pencil" onClick={props.edit} />
  </li>

const Menu = props =>
  <aside className={'sidebar ' + (props.invert && 'dark')} style={{width: '20em'}}>
    <div>
      <header><button className="subscribe" onClick={() => props.edit({})}><span className="fa fa-rss icon" />Subscribe</button></header>
      <nav>
        <For each={[{name: "all feeds", urls: props.feeds.map(feed => feed.url)}].concat(tags(props.feeds))}>
          {category => <Category title={category.name} selected={props.selected.length > 1 && props.selected.join() === category.urls.join()} key={category.name} select={() => props.select(category.urls)} count={category.urls.map(url => size(props.articles[url], props.read)).reduce((a, b) => a + b, 0)} />}
        </For>
        <For each={props.feeds}>
          {feed => <MenuItem {...feed} selected={props.selected.length === 1 && props.selected[0] === feed.url} key={feed.url} select={() => props.select([feed.url])} count={size(props.articles[feed.url], props.read)} edit={event => {event.stopPropagation(); props.edit(feed)}}  />}
        </For>
      </nav>
    </div>
    <footer>
      <button title="switch theme" onClick={() => props.set({dark: !props.dark})}><span className="fa fa-adjust" /></button>
      <button title="settings" onClick={() => props.configure('Login')}><span className={props.error ? 'fa fa-warning' : 'fa fa-cogs'} /></button>
    </footer>
  </aside>

export default Menu;
