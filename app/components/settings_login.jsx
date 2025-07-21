import api from '../api.jsx';

const message = error => {
  if (!error)
    return `Logged in as: ${api.user.name}`;
  if (error.status !== 401)
    return error.message || error;
  if (api.user.credentials)
    return 'Wrong username / password combination';
  return 'Please log in to continue';
};

const Login = props =>
  <>
    <h2>Login</h2>
    <div style={`border-radius: 2px; padding: 1em 1.5em; background: ${(!props.error || props.error.status === 401) ? '#0c4' : '#f35'}`}>{message(props.error)}</div>
    <Show when={props.error}>
      <div><input id="email" type="text" placeholder="Username" value={api.user.name || 'user'} style="width: inherit; text-align: inherit" /></div>
      <div><input id="password" type="password" placeholder="Password" value={api.user.password} style="width: inherit; text-align: inherit" /></div>
      <div><button title="Login" onClick={() => api.login(document.querySelector('#email').value, document.querySelector('#password').value)} style="width: inherit"><span className="icon fa fa-sign-in" /><span>Login</span></button></div>
    </Show>
  </>

export default Login;
