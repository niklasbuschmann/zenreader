import Github from './github.jsx';

const About = props =>
  <>
    <h2>Zen Reader</h2>
    <Github background="#4b6fff" color="white" repo="niklasbuschmann/zenreader" />
    <a href="https://github.com/niklasbuschmann/zenreader" style={{'text-align': 'center'}}><img src="zen.svg" style={{width: '14em', transition: '.4s transform'}} onMouseEnter={event => event.target.style.transform = 'rotate(180deg)'} onMouseOut={event => event.target.style.transform = 'rotate(0deg)'} /></a>
    <footer>
      <span>
        <span className="fa fa-code" />
        <span>&nbsp; with &nbsp;</span>
        <strong style={{color: '#f45'}}>&lt;3</strong>
      </span>
      <a href="https://github.com/niklasbuschmann">Niklas Buschmann</a>
      <span>2020</span>
    </footer>
  </>

export default About;
