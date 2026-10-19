import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Dashboard() {
  const { token, user, login, logout } = useAuth();
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    apiRequest('/auth/me', { token })
      .then((data) => {
        if (active) login(token, data.user);
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          logout();
          navigate('/login', { replace: true });
        } else {
          setStatusMessage(err.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, login, logout, navigate]);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <main className="dashboard-layout">
      <header className="topbar">
        <a className="wordmark" href="/dashboard"><span>SN</span> SistemaNegocio</a>
        <button className="secondary-button" onClick={handleLogout}>Cerrar sesión</button>
      </header>
      <section className="dashboard-content">
        <p className="eyebrow">PANEL PRINCIPAL</p>
        <h1>Hola, {user?.nombre || user?.username || 'usuario'}</h1>
        <p className="muted">Bienvenido al sistema de gestión del negocio.</p>
        {statusMessage && <div className="alert" role="alert">{statusMessage}</div>}
        <article className="profile-card">
          <div className="avatar" aria-hidden="true">
            {(user?.nombre || user?.username || 'U').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="profile-label">SESIÓN ACTIVA</p>
            <h2>{user?.nombre || user?.username}</h2>
            <p className="muted">@{user?.username}</p>
          </div>
          <div className="role-badge">{user?.nombre_rol || 'Rol asignado'}</div>
        </article>
        {loading && <p className="muted verification-message">Verificando sesión...</p>}
      </section>
    </main>
  );
}
