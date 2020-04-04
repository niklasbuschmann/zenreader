const values = () => [{
  title: document.querySelector('#title').value,
  url: document.querySelector('#url').value,
  tags: document.querySelector('#tags').value.split(', ').filter(tag => tag)
}];

const Edit = props =>
  <dialog open onClick={() => props.replace([])}>
    <div className="dark edit full" onClick={event => event.stopPropagation()} style={{width: '35em'}}>
      <main>
        <h2>{props.old.title || 'Subscribe'}</h2>
        <input id="title" placeholder="Title" type="text" defaultValue={props.old.title} />
        <input id="url" placeholder="Link" type="url" defaultValue={props.old.url} />
        <input id="tags" placeholder="Tags" type="text" defaultValue={props.old.tags ? props.old.tags.join(', ') : ''} />
        <div style={{margin: '1em 0 .5em'}}>
          <span><button className="danger" onClick={() => props.replace([], props.old)}><span className="icon fa fa-trash" />Delete</button></span>
          <span>
            <button className="cancel" onClick={() => props.replace([])} style={{margin: '0 1em'}}><span className="icon fa fa-times-circle" />Cancel</button>
            <button className="save" onClick={() => props.replace(values(), props.old)}><span className="icon fa fa-check-square-o" />Save</button>
          </span>
        </div>
      </main>
    </div>
  </dialog>

export default Edit;
