import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      login(data.token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err.code === 'ACCOUNT_BLOCKED') {
        setError('La cuenta está bloqueada tras 2 intentos fallidos. Contacte a un administrador.');
      } else if (err.code === 'INVALID_CREDENTIALS') {
        setError('Usuario o contraseña incorrectos. Al segundo intento fallido, la cuenta se bloquea.');
      } else {
        setError(err.message || 'No fue posible iniciar sesión. Intente de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">SN</div>
        <p className="eyebrow">SISTEMA DE GESTIÓN</p>
        <h1 id="login-title">Bienvenido</h1>
        <p className="muted">Inicie sesión en SistemaNegocio</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            maxLength={50}
            required
          />

          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error && <div className="alert" role="alert">{error}</div>}

          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>
      </section>
      <aside className="login-aside">
        <div>
          <span className="aside-label">SISTEMANEGOCIO</span>
          <h2>Todo tu negocio,<br />en un solo lugar.</h2>
          <p>Acceso seguro para la operación diaria de tu empresa.</p>
        </div>
        <span className="aside-footnote">Acceso protegido · Registro de actividad</span>
      </aside>
    </main>
  );
}
