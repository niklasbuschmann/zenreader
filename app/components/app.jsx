import Settings from './settings.jsx';
import Menu from './menu.jsx';
import Header from './header.jsx';
import Edit from './edit.jsx';
import Articles from './articles.jsx';

const App = props =>
  <>
    <Show when={props.editing}><Edit old={props.editing} replace={props.replace} /></Show>
    <Show when={props.configuring}><Settings {...props} /></Show>
    <Menu {...props} />
    <main className="column grow overflow" onDragOver={() => props.configure('Feeds')}>
      <Header {...props.settings} set={props.set} search={props.search} markall={props.markall} />
      <Articles {...props} />
    </main>
  </>

export default App;
