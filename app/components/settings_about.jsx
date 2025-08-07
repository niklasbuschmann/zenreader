import Github from './github.jsx';

const About = props =>
  <>
    <Github background="#46f" color="white" repo="niklasbuschmann/zenreader" />
    <header className="grow" style="font-size: 2em"><h2><a href="https://github.com/niklasbuschmann/zenreader" target="_blank">Zen Reader</a></h2></header>
    <div>
      <span><span className="fa fa-code" />&numsp;with&numsp;<b style="color: #f45">&lt;3</b></span>
      <span>Niklas Buschmann</span>
      <span>2015-2025</span>
    </div>
  </>

export default About;
