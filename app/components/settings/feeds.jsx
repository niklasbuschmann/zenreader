import {parse, stringify} from '../../opml.jsx';
import {Input, Output, Dropzone} from '../file.jsx';

const dropzone = state => <p style={{background: state.drag ? '#222' : 'transparent', color: state.error ? '#f45' : (state.drag || state.success) ? '#0c6' : '#68f', border: '2px dashed', margin: '2em 0', padding: '1.5em', 'text-align': 'center'}}>{state.error ? state.error : state.success ? 'Successfully imported OPML' : 'Drop opml here to import'}</p>;

const Feeds = props =>
  <main>
    <h2>Import / Export</h2>
    <div>Overwrite existing feeds<button onClick={() => props.set({overwrite: !props.settings.overwrite})}><span className={props.settings.overwrite ? 'fa fa-toggle-on' : 'fa fa-toggle-off'} /></button></div>
    <div>Import OPML<Input readAs="Text" handleData={text => parse(text).length ? props.upload(parse(text)) : Promise.reject('Could not parse file')}><button title="import OPML"><span className="fa fa-upload" /></button></Input></div>
    <div>Export OPML<Output getContent={() => stringify('Zen Reader export', props.feeds)} name="exported feeds.opml" type="application/xml"><button title="export OPML"><span className="fa fa-download" /></button></Output></div>
    <Dropzone handleData={text => parse(text).length ? props.upload(parse(text)) : Promise.reject('Could not parse file')}>{dropzone}</Dropzone>
  </main>

export default Feeds;
