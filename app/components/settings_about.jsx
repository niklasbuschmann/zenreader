import Github from './github.jsx';

const About = props =>
  <>
    <Github background="#46f" color="white" repo="niklasbuschmann/zenreader" />
    <h2 style="margin: auto; font-size: 2.2em"><a href="https://github.com/niklasbuschmann/zenreader" target="_blank">Zen Reader</a></h2>
    <footer style="margin-top: 0">
      <div>
        <span className="fa fa-code" />
        <span>&nbsp; with &nbsp;</span>
        <strong style="color: #f45">&lt;3</strong>
      </div>
      <div>Niklas Buschmann</div>
      <div>2015-2025</div>
    </footer>
  </>

export default About;
