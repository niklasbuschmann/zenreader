const values = () => [{
  title: document.querySelector('#title').value,
  url: document.querySelector('#url').value,
  tags: document.querySelector('#tags').value.split(', ').filter(tag => tag)
}];

const Edit = props =>
  <dialog className="full" open onClick={() => props.replace([])}>
    <div className="dark spread edit column" onClick={event => event.stopPropagation()}>
      <h2 className="center">{props.old.title || 'Subscribe'}</h2>
      <div>
        <input id="title" placeholder="Title" type="text" value={props.old.title || ''} />
        <input id="url" placeholder="Link" type="url" value={props.old.url || ''} />
        <input id="tags" placeholder="Tags" type="text" value={props.old.tags ? props.old.tags.join(', ') : ''} />
      </div>
      <div>
        <button className="red" onClick={() => props.replace([], props.old)}><span className="icon fa fa-trash" />Delete</button>
        <span>
          <button className="blue" onClick={() => props.replace([])} style="margin: 0 1em"><span className="icon fa fa-times-circle" />Cancel</button>
          <button className="green" onClick={() => props.replace(values(), props.old)}><span className="icon fa fa-floppy-o" />Save</button>
        </span>
      </div>
    </div>
  </dialog>

export default Edit;
