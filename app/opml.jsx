const stringify = (title, feeds) =>
`<opml version="1.0">
  <head>
    <title>${title}</title>
  </head>
  <body>
    ${feeds.map(feed => `<outline text="${feed.title}" title="${feed.title}" type="rss" xmlUrl="${feed.url}" />`).join('')}
  </body>
</opml>`;

const outlines = xml => Array.from(new DOMParser().parseFromString(xml, 'text/xml').querySelectorAll('outline'))

const parse = xml => outlines(xml)
  .filter(element => element.getAttribute('xmlUrl'))
  .map(element => ({
    title: element.getAttribute('title') || element.getAttribute('text'),
    url: element.getAttribute('xmlUrl'),
    tags: []
  }));

export {stringify, parse};
