const values = () => [{
  title: document.querySelector('#title').value,
  url: document.querySelector('#url').value,
  tags: document.querySelector('#tags').value.split(', ').filter(tag => tag)
}];

const Edit = props =>
  <dialog open onClick={() => props.replace([])}>
    <div className="dark edit" onClick={event => event.stopPropagation()}>
      <main className="grow">
        <h2>{props.old.title || 'Subscribe'}</h2>
        <input id="title" placeholder="Title" type="text" value={props.old.title} />
        <input id="url" placeholder="Link" type="url" value={props.old.url} />
        <input id="tags" placeholder="Tags" type="text" value={props.old.tags ? props.old.tags.join(', ') : ''} />
        <div style={{margin: '1em 0 .5em'}}>
          <span><button className="red" onClick={() => props.replace([], props.old)}><span className="icon fa fa-trash" />Delete</button></span>
          <span>
            <button className="blue" onClick={() => props.replace([])} style={{margin: '0 1em'}}><span className="icon fa fa-times-circle" />Cancel</button>
            <button className="green" onClick={() => props.replace(values(), props.old)}><span className="icon fa fa-check-square-o" />Save</button>
          </span>
        </div>
      </main>
    </div>
  </dialog>

export default Edit;
