import { createStore } from 'solid-js/store';

import Time from './time.jsx';
import Favicon from './favicon.jsx';

const Article = props => {
  const [state, setState] = createStore({open: false});
  const close = isread => {state.open && props.mark(props.article.id, isread); setState({open: !state.open})};

  return <article className="shadow" onClick={() => close(true)}>
    <header className="flex">
      <a href={props.article.link} className={props.isread && 'meta'} onClick={() => close(true)} target="_blank"><Favicon src={props.article.link} />{props.article.title}</a>
      <Time className="meta" time={new Date(props.article.date)} />
    </header>
    <Show when={state.open || props.layout}>
      <div className="content" onClick={event => event.stopPropagation()}>
        <div className="flex"><span className="meta">{props.article.author}</span><button title="mark as unread" className="fa fa-eye-slash" onClick={() => close(false)} /></div>
        <div innerHTML={props.article.content} />
      </div>
    </Show>
  </article>;
};

export default Article;
