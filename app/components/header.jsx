const Header = props =>
  <header>
    <div>
      <button><span className="fa fa-search icon" /></button>
      <input type="text" placeholder="search" onInput={event => props.search(event.target.value.toLowerCase())} />
    </div>
    <nav>
      <button title="mark all articles as read" onClick={props.markall}><span className="fa fa-check" /></button>
      <button title="show read articles" onClick={() => props.set({showread: !props.showread})}><span className={props.showread ? 'fa fa-toggle-on' : 'fa fa-toggle-off'} /></button>
      <button title="expand articles" onClick={() => props.set({layout: !props.layout})}><span className={props.layout ? 'fa fa-list' : 'fa fa-bars'} /></button>
    </nav>
  </header>

export default Header;
