import Github from './github.jsx';

const About = props =>
  <main style={{position: 'relative'}} className="grow">
    <h2>Zen Reader</h2>
    <Github background="#4b6fff" color="white" repo="niklasbuschmann/zenreader" />
    <a href="https://github.com/niklasbuschmann/zenreader" style={{'text-align': 'center', 'margin-top': '-5em'}}><img src="zen.svg" style={{width: '14em', transition: '.4s transform'}} onMouseEnter={event => event.target.style.transform = 'rotate(180deg)'} onMouseOut={event => event.target.style.transform = 'rotate(0deg)'} /></a>
    <footer style={{padding: '0'}}>
      <span>
        <span className="fa fa-code" />
        <span>&nbsp; with &nbsp;</span>
        <strong style={{color: '#f45'}}>&lt;3</strong>
      </span>
      <a href="https://github.com/niklasbuschmann" style={{'color': 'inherit'}}>Niklas Buschmann</a>
      <span>2020</span>
    </footer>
  </main>

export default About;
