const Header = props =>
  <header className="flex shadow">
    <div>
      <span className="fa fa-search icon" />
      <input type="text" placeholder="search" onInput={event => props.search(event.target.value.toLowerCase())} />
    </div>
    <nav className="flex buttons">
      <button title="mark all articles as read" onClick={props.markall}><span className="fa fa-eye" /></button>
      <button title="show read articles" onClick={() => props.set({showread: !props.showread})}><span className={props.showread ? 'fa fa-toggle-on' : 'fa fa-toggle-off'} /></button>
      <button title="expand articles" onClick={() => props.set({layout: !props.layout})}><span className={props.layout ? 'fa fa-folder-open-o' : 'fa fa-folder-o'} /></button>
    </nav>
  </header>

export default Header;
