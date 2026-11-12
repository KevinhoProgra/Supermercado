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
      navigate(data.user.nombre_rol === 'Cliente' ? '/store' : '/dashboard', { replace: true });
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
        <a className="login-brand" href="/login" aria-label="Mercado, inicio">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>mercado<span className="brand-period">.</span></span>
        </a>
        <p className="eyebrow">TU SUPERMERCADO, MÁS SIMPLE</p>
        <h1 id="login-title">Qué gusto verte.</h1>
        <p className="muted">Inicia sesión para continuar con tu día.</p>

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
        <div className="login-promo">
          <span className="aside-label">FRESCO, FÁCIL Y EN ORDEN</span>
          <h2>Lo bueno de<br />tu negocio.</h2>
          <p>Ventas, inventario y compras trabajando juntos para que todo fluya.</p>
          <div className="produce-art" aria-hidden="true">
            <span className="produce produce-orange">🍊</span>
            <span className="produce produce-leaf">🥬</span>
            <span className="produce produce-berry">🍓</span>
            <span className="produce-caption">Hecho para el día a día</span>
          </div>
        </div>
        <span className="aside-footnote"><span aria-hidden="true">✦</span> Acceso seguro para tu equipo</span>
      </aside>
    </main>
  );
}
