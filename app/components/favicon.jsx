const noicon = new Set();

const url = url => `https://${url.split('/')[2]}/favicon.ico`;

const handle = event => {
  noicon.add(event.target.src);
  event.target.outerHTML = '<span class="icon fa fa-globe"></span>';
};

const Favicon = ({src}) => noicon.has(url(src)) ? <span className="icon fa fa-globe" /> : <img className="icon" src={url(src)} onError={handle} />

export default Favicon;
