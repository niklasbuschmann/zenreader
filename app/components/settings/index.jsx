import Login from './login.jsx';
import General from './general.jsx';
import Feeds from './feeds.jsx';
import About from './about.jsx';

const pages = {Login, General, Feeds, About};

const icons = {Login: 'fa-user-circle', General: 'fa-wrench', Feeds: 'fa-rss', About: 'fa-terminal'};

const nuke = () => {
  window.onunload = null;
  window.localStorage.clear();
  window.localStorage.setItem('user', JSON.stringify({name: '', password: ''}));
  window.location.assign('');
};

const Settings = props =>
  <dialog open onClick={() => props.configure(false)}>
    <div className="dark settings" onClick={event => event.stopPropagation()}>
      <aside className="column">
        <For each={Object.keys(pages)}>
          {key => <li className={props.configured === key && 'blue selected'} onClick={() => props.configure(key)}><span><span className={'icon fa ' + icons[key]} />{key}</span></li>}
        </For>
        <footer className="red" onClick={nuke}><li><span className="fa fa-power-off icon" />Logout</li></footer>
      </aside>
      <main className="column grow" style={{position: 'relative'}}>{pages[props.configured](props)}</main>
    </div>
  </dialog>

export default Settings;
