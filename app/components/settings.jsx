import Login from './settings_login.jsx';
import General from './settings_general.jsx';
import Feeds from './settings_feeds.jsx';
import About from './settings_about.jsx';

const nuke = () => {
  window.onunload = null;
  window.localStorage.clear();
  window.localStorage.setItem('user', JSON.stringify({name: '', password: ''}));
  window.location.assign('');
};

const Settings = props =>
  <dialog open onClick={() => props.configure(false)}>
    <div className="dark settings overflow" onClick={event => event.stopPropagation()}>
      <aside>
        <button classList={{'blue selected': props.configuring === 'Login' }} onClick={() => props.configure('Login')}><span className="icon fa fa-user-circle" />Login</button>
        <button classList={{'blue selected': props.configuring === 'General' }} onClick={() => props.configure('General')}><span className="icon fa fa-wrench" />General</button>
        <button classList={{'blue selected': props.configuring === 'Feeds' }} onClick={() => props.configure('Feeds')}><span className="icon fa fa-rss" />Feeds</button>
        <button classList={{'blue selected': props.configuring === 'About' }} onClick={() => props.configure('About')}><span className="icon fa fa-terminal" />About</button>
        <span className="grow" />
        <button className="red" onClick={nuke}><span className="fa fa-power-off icon" />Logout</button>
      </aside>
      <section className="grow spread" style="position: relative">
        <Show when={props.configuring === 'Login'}><Login error={props.error} /></Show>
        <Show when={props.configuring === 'General'}><General set={props.set} settings={props.settings} /></Show>
        <Show when={props.configuring === 'Feeds'}><Feeds set={props.set} settings={props.settings} feeds={props.feeds} add={props.replace} /></Show>
        <Show when={props.configuring === 'About'}><About /></Show>
      </section>
    </div>
  </dialog>

export default Settings;
