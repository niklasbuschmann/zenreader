import Settings from './settings/index.jsx';
import Menu from './menu.jsx';
import Header from './header.jsx';
import Edit from './edit.jsx';
import Articles from './articles.jsx';

const App = props =>
  <div className="flex shadow" className={props.settings.dark ? 'dark' : 'light'} onDragOver={() => props.configure === 'Feeds' || props.actions.configure('Feeds')}>
    {props.editing && <Edit old={props.editing} replace={props.actions.replace} />}
    {props.configure && <Settings settings={props.settings} feeds={props.feeds} configure={props.actions.configure} configured={props.configure} error={props.error} set={props.actions.set} upload={props.actions.upload} throwerror={props.actions.throwerror} />}
    <Menu feeds={props.feeds} selected={props.selected} read={props.read} articles={props.articles} dark={props.settings.dark} invert={props.settings.invert} error={props.error} select={props.actions.select} edit={props.actions.edit} set={props.actions.set} configure={props.actions.configure} />
    <div className="main column grow overflow">
      <Header menu={props.settings.menu} showread={props.settings.showread} layout={props.settings.layout} set={props.actions.set} search={props.actions.search} markall={props.actions.markall} />
      {props.feeds.length ? <Articles articles={props.articles} read={props.read} selected={props.selected} search={props.search} loading={props.loading} showread={props.settings.showread} layout={props.settings.layout} mark={props.actions.mark} /> : <div className="center"><h1>Welcome</h1></div>}
    </div>
  </div>

export default App;
