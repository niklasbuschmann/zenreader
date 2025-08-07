const Header = props =>
  <header className="shadow">
    <div>
      <span className="fa fa-search icon" />
      <input type="text" placeholder="search" onInput={event => props.search(event.target.value.toLowerCase())} />
    </div>
    <div>
      <button className="fa fa-eye" title="mark all articles as read" onClick={props.markall} />
      <button className={props.showread ? 'fa fa-toggle-on' : 'fa fa-toggle-off'} title="show read articles" onClick={() => props.set({showread: !props.showread})} />
      <button className={props.layout ? 'fa fa-align-justify' : 'fa fa-bars'} title="expand articles" onClick={() => props.set({layout: !props.layout})} />
    </div>
  </header>

export default Header;
