import { createStore } from 'solid-js/store';

import Time from './time.jsx';
import Favicon from './favicon.jsx';

const Article = props => {
  const [state, setState] = createStore({open: false});
  const close = isread => {state.open && props.mark(props.article.id, isread); setState({open: !state.open})};

  return <article className={state.open ? 'open' : ''} onClick={() => close(true)}>
    <header className="flex">
      <span><Favicon src={props.article.link} /><a href={props.article.link} style={{opacity: props.isread ? '0.6' : '1'}} onClick={() => close(true)} target="_blank">{props.article.title}</a></span>
      <Time time={new Date(props.article.date)} />
    </header>
    <Show when={state.open || props.layout}>
      <div className="content" onClick={event => event.stopPropagation()}>
        <header className="flex">
          <span>{props.article.author}</span>
          <button title="mark as unread" className="fa fa-eye-slash" onClick={() => close(false)} />
        </header>
        <div innerHTML={props.article.content} />
      </div>
    </Show>
  </article>;
};

export default Article;
