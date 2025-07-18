import api from '../../api.jsx';

const background = color => ({'border-radius': '2px', padding: '1em 1.5em', 'margin-bottom': '15em', background: color});

const message = error => {
  if (!error)
    return `Logged in as ${api.user.name}.`;
  if (error.status !== 401)
    return error.message || error;
  if (api.user.credentials)
    return 'Wrong username / password combination';
  return 'Please log in to continue';
};

const Login = props =>
  <main className="grow">
    <h2>Login</h2>
    <div style={background((!props.error || props.error.status === 401) ? '#0c4' : '#f35')}>{message(props.error)}</div>
    <Show when={props.error}>
      <div><input id="email" type="text" placeholder="Username" defaultValue={api.user.name} /></div>
      <div><input id="password" type="password" placeholder="Password" defaultValue={api.user.password} /></div>
      <div style={{'margin-top': '1.5em'}}><button title="Login" onClick={() => api.login(document.querySelector('#email').value, document.querySelector('#password').value)}><span className="icon fa fa-sign-in" /><span>Login</span></button></div>
    </Show>
  </main>

export default Login;
