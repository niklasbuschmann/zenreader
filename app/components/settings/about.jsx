import Github from './github.jsx';

const About = props =>
  <main style={{position: 'relative'}}>
    <h2>Zen Reader</h2>
    <Github background="#4b6fff" color="white" repo="niklasbuschmann/zenreader" />
    <a href="https://github.com/niklasbuschmann/zenreader" style={{textAlign: 'center'}}><img src="zen.svg" style={{width: '14em', margin: '1.75em 0', transition: '.4s transform'}} className="rotate"/></a>
    <footer style={{padding: '.75em 2em', position: 'absolute', left: 0, right: 0, bottom: 0}}>
      <span>
        <span className="fa fa-code" />
        <span style={{margin: '0 .4em'}}>with</span>
        <span style={{fontWeight: 'bold', color: '#f45'}}>&lt;3</span>
      </span>
      <a href="https://github.com/niklasbuschmann">Niklas Buschmann</a>
      <span style={{width: '5em', textAlign: 'right'}}>2020</span>
    </footer>
  </main>

export default About;
