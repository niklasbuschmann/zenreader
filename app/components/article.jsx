import { createSignal } from 'solid-js';

import Time from './time.jsx';
import Favicon from './favicon.jsx';

const Article = props => {
  const [open, setState] = createSignal(false);
  const close = isread => {open() && props.mark(props.article.id, isread); setState(!open())};

  return <article className="shadow" onClick={() => close(true)}>
    <header>
      <span classList={{meta: props.isread}} >
        <Favicon src={props.article.link} />
        <a href={props.article.link} onClick={() => close(true)} target="_blank">{props.article.title}</a>
      </span>
      <Time className="meta" time={new Date(props.article.date)} />
    </header>
    <Show when={open() || props.open}>
      <section onClick={event => event.stopPropagation()}>
        <header className="meta">{props.article.author}<button title="mark as unread" className="fa fa-eye-slash" onClick={() => close(false)} /></header>
        <div innerHTML={props.article.content} />
      </section>
    </Show>
  </article>;
};

export default Article;
