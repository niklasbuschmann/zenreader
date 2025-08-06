import Github from './github.jsx';

const About = props =>
  <>
    <Github background="#46f" color="white" repo="niklasbuschmann/zenreader" />
    <h2 className="grow"><a href="https://github.com/niklasbuschmann/zenreader" target="_blank" style="font-size: 2em; color: #fff">Zen Reader</a></h2>
    <div>
      <span>
        <span className="fa fa-code" />
        <span>&nbsp; with &nbsp;</span>
        <strong style="color: #f45">&lt;3</strong>
      </span>
      <span>Niklas Buschmann</span>
      <span>2015-2025</span>
    </div>
  </>

export default About;
