import Article from './article.jsx';

const background = props => {
  if (!props.feeds.length)
    return 'Welcome';
  if (props.loading)
    return 'Loading ...';
  if (props.selected.length === 1 && !props.articles[props.selected[0]])
    return <>Loading feed from <a href={props.selected[0]}>{props.selected[0]}</a> failed</>;
  if (props.searching)
    return 'Nothing found ...';
  return 'No new articles available';
};

const articles = props => props.selected
  .flatMap(feed => props.articles[feed] || [])
  .filter(props.searching ? article => ['title', 'author', 'content'].some(prop => (article[prop] || '').toLowerCase().includes(props.searching)) : !props.settings.showread ? article => !props.read[article.id] : () => true)
  .sort((a, b) => b.date - a.date);

const Articles = props =>
  <div className="overflow grow">
    <For each={articles(props)} fallback={<h2 style="text-align: center">{background(props)}</h2>}>
      {article => <Article article={article} isread={props.read[article.id]} open={props.settings.layout} mark={props.mark} />}
    </For>
  </div>

export default Articles;
