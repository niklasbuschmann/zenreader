import {parse, stringify} from '../opml.jsx';
import {Input, Output, Dropzone} from './file.jsx';

const dropzone = state => <p style={`color: ${state.error ? '#f24' : (state.drag || state.success) ? '#0c0' : '#57f'}; border: 2px dashed; margin: 1.5em 0; padding: 1.5em; text-align: center; border-radius: 5px; width: 100%`}>{state.error ? state.error : state.success ? 'Successfully imported OPML' : 'Drop opml here to import'}</p>;

const Feeds = props =>
  <>
    <h2>Import / Export</h2>
    <div>Import OPML<Input readAs="Text" handleData={text => parse(text).length ? props.add(parse(text)) : Promise.reject('Could not parse file')}><button className="blue" title="import OPML"><span className="fa fa-upload" /></button></Input></div>
    <div>Export OPML<Output getContent={() => stringify('Zen Reader export', props.feeds)} name="exported feeds.opml" type="application/xml"><button className="blue" title="export OPML"><span className="fa fa-download" /></button></Output></div>
    <div>Delete Feeds <button onClick={() => props.add([], false, true)} className="red" title="Delete feeds"><span className="fa fa-trash" /></button></div>
    <Dropzone handleData={text => parse(text).length ? props.add(parse(text)) : Promise.reject('Could not parse file')}>{dropzone}</Dropzone>
  </>

export default Feeds;
