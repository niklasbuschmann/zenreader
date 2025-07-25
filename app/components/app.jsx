import Settings from './settings.jsx';
import Menu from './menu.jsx';
import Header from './header.jsx';
import Edit from './edit.jsx';
import Articles from './articles.jsx';

const App = props =>
  <div className={`flex shadow ${props.settings.dark ? 'dark' : 'light'}`} onDragOver={() => props.configure('Feeds')}>
    <Show when={props.editing}>
      <Edit old={props.editing} replace={props.replace} />}
    </Show>
    <Show when={props.configuring}>
      <Settings {...props} />
    </Show>
    <Menu {...props} />
    <div className="main column grow overflow">
      <Header {...props.settings} set={props.set} search={props.search} markall={props.markall} />
      <Articles {...props} />
    </div>
  </div>

export default App;
