const General = props =>
  <main>
    <h2>Settings</h2>
    <div>Articles per feed<input type="text" min="1" max="200" value={props.settings.load} style={{width: '6.25em'}} onChange={event => props.set({load: event.target.value})} /></div>
    <div>Update interval<input type="text" min="1" max="60" value={props.settings.frequency} style={{width: '6.25em'}} onChange={event => props.set({frequency: event.target.value})} /></div>
    <div>{props.settings.notify ? 'Disable notifications' : 'Enable notifications'}<button onClick={() => {!props.settings.notify && Notification.requestPermission(); props.set({notify: !props.settings.notify})}}><span className={props.settings.notify ? 'fa fa-bell-slash' : 'fa fa-bell'} /></button></div>
    <div>Use cache<button onClick={() => props.set({cache: !props.settings.cache})}><span className={props.settings.cache ? 'fa fa-toggle-on' : 'fa fa-toggle-off'} /></button></div>
    <div>Dark menu<button onClick={() => props.set({invert: !props.settings.invert})}><span className={props.settings.invert ? 'fa fa-check-square-o' : 'fa fa-square-o'} /></button></div>
  </main>

export default General;
