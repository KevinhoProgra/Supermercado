import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Operations from './Operations.jsx';

const MODULES = {
  Administrador: [
    ['home', 'Resumen'],
    ['sales', 'Cajas / Facturación'],
    ['inventory', 'Inventario'],
    ['purchases', 'Compras'],
    ['reports', 'Informes'],
    ['admin', 'Administración'],
  ],
  Cajero: [
    ['sales', 'Cajas / Facturación'],
    ['reports', 'Informes'],
  ],
  'Encargado de compras': [
    ['purchases', 'Compras'],
    ['inventory', 'Inventario'],
  ],
};

function modulesForUser(user) {
  if (user?.nombre_rol === 'Administrador') return MODULES.Administrador;
  const permissions = user?.permisos || [];
  const modules = [];
  if (permissions.includes('ventas:create')) modules.push(['sales', 'Cajas / Facturación']);
  if (permissions.includes('reportes:ventas') || permissions.includes('reportes:caja')) modules.push(['reports', 'Informes']);
  if (permissions.includes('compras:read')) modules.push(['purchases', 'Compras']);
  if (permissions.includes('productos:read') && !permissions.includes('ventas:create')) modules.push(['inventory', 'Inventario']);
  return modules;
}

export default function Dashboard() {
  const { token, user, login, logout } = useAuth();
  const [module, setModule] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const modules = useMemo(() => modulesForUser(user), [user]);

  useEffect(() => {
    let active = true;
    apiRequest('/auth/me', { token })
      .then((data) => {
        if (!active) return;
        login(token, data.user);
        setModule((current) => current || (modulesForUser(data.user)[0]?.[0] ?? ''));
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

  async function handleLogout() {
    try {
      await apiRequest('/auth/logout', { token, method: 'POST' });
    } catch (err) {
      setStatusMessage(`No se pudo registrar el cierre de sesión: ${err.message}`);
    } finally {
      logout();
      navigate('/login', { replace: true });
    }
  }

  return (
    <main className="dashboard-layout">
      <header className="topbar">
        <a className="wordmark" href="/dashboard"><span>SP</span> Sistema Supermercado</a>
        <div className="topbar-actions">
          <span className="role-badge">{user?.nombre_rol || 'Rol asignado'}</span>
          <button className="secondary-button" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </header>
      <div className="workspace">
        <aside className="module-nav" aria-label="Módulos">
          <p className="profile-label">MÓDULOS</p>
          {modules.map(([id, label]) => (
            <button
              key={id}
              className={`nav-item ${module === id ? 'selected' : ''}`}
              onClick={() => setModule(id)}
            >
              {label}
            </button>
          ))}
        </aside>
        <section className="dashboard-content module-content">
          {statusMessage && <div className="alert" role="alert">{statusMessage}</div>}
          {loading ? (
            <p className="muted">Verificando sesión...</p>
          ) : module === 'home' ? (
            <>
              <p className="eyebrow">PANEL PRINCIPAL</p>
              <h1>Hola, {user?.nombre || user?.username || 'usuario'}</h1>
              <p className="muted">Bienvenido al sistema de gestión del supermercado.</p>
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
              <div className="module-tiles">
                {modules.filter(([id]) => id !== 'home').map(([id, label]) => (
                  <button className="module-tile" key={id} onClick={() => setModule(id)}>
                    <span>{label}</span><strong>›</strong>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <Operations
              module={module}
              token={token}
              user={user}
              onMessage={setStatusMessage}
            />
          )}
        </section>
      </div>
    </main>
  );
}
