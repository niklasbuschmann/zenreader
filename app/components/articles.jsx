import Article from './article.jsx';

const background = props => {
  if (props.loading)
    return 'Loading ...';
  if (props.selected.length === 1 && !props.articles[props.selected[0]])
    return <span>Parsing articles from <a href={props.selected[0]}>{props.selected[0]}</a> failed</span>;
  if (props.search)
    return 'Nothing found ...';
  return 'No new articles available';
};

const articles = props => props.selected
  .flatMap(feed => props.articles[feed] || [])
  .filter(props.search ? article => ['title', 'author', 'content'].some(prop => (article[prop] || '').toLowerCase().includes(props.search)) : !props.showread ? article => !props.read[article.id] : () => true)
  .sort((a, b) => b.date - a.date);

const Articles = props =>
  <div className="overflow">
    <Index each={articles(props)} fallback={<h2 className="center">{background(props)}</h2>}>
      {article => <Article article={article()} isread={props.read[article().id]} layout={props.layout} key={article().id} mark={props.mark} />}
    </Index>
  </div>

export default Articles;
