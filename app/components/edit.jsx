const values = () => [{
  title: document.querySelector('#title').value,
  url: document.querySelector('#url').value,
  tags: document.querySelector('#tags').value.split(', ').filter(tag => tag)
}];

const Edit = props =>
  <dialog open onClick={() => props.replace([])}>
    <main className="dark edit spread">
      <h2>{props.old.title || 'Subscribe'}</h2>
      <div><input className="grow" id="title" placeholder="Title" type="text" value={props.old.title || ''} /></div>
      <div><input className="grow" id="url" placeholder="Link" type="url" value={props.old.url || ''} /></div>
      <div><input className="grow" id="tags" placeholder="Tags" type="text" value={props.old.tags ? props.old.tags.join(', ') : ''} /></div>
      <div>
        <button className="red" onClick={() => props.replace([], props.old)}><span className="icon fa fa-trash" />Delete</button>
        <span>
          <button className="blue" onClick={() => props.replace([])} style="margin: 1.5em 1em"><span className="icon fa fa-times-circle" />Cancel</button>
          <button className="green" onClick={() => props.replace(values(), props.old)}><span className="icon fa fa-floppy-o" />Save</button>
        </span>
      </div>
    </main>
  </dialog>

export default Edit;
