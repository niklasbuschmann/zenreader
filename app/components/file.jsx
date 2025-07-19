import { createStore } from 'solid-js/store';

const prevent = fn => event => {event.preventDefault(); fn(event)};

const objectUrl = (content, type) => URL.createObjectURL(new Blob([content]), {type: type || 'text/plain'});

const parse = files => Array.from(files).map(file => 
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = event => resolve(event.target.result);
    reader.readAsText(file);
  }));

const Output = props => <span onClick={event => event.currentTarget.firstChild.click()}>
    <a download={props.name} href={objectUrl(props.getContent(), props.type)} style="display: none" />
    {props.children}
  </span>

const Input = props => <span onClick={event => event.currentTarget.firstChild.click()}>
    {<input type="file" multiple={props.multiple} accept={props.accept} style="display: none" onChange={prevent(event => parse(event.target.files).map(file => file.then(props.handleData)))} />}
    {props.children}
  </span>

const Dropzone = props => {
  const [state, setState] = createStore({error: false, success: false, drag: false});

  const drop = event => parse(event.dataTransfer.files).forEach(file => file
    .then(props.handleData)
    .then(() => setState({drag: false, success: true, error: false}))
    .catch(error => setState({drag: false, error}))
  );
  const dragOver = () => setState({drag: true});
  const dragLeave = () => setState({drag: false});
  
  return <div onDrop={prevent(drop)} onDragOver={prevent(dragOver)} onDragLeave={dragLeave}>{(typeof props.children === 'function') ? props.children(state) : props.children}</div>;
};

export {Output, Input, Dropzone};
