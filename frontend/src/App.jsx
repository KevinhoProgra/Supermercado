import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import CustomerShop from './pages/CustomerShop.jsx';

function ProtectedRoute({ children, customerOnly = false }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (customerOnly && user?.nombre_rol !== 'Cliente') return <Navigate to="/dashboard" replace />;
  if (!customerOnly && user?.nombre_rol === 'Cliente') return <Navigate to="/store" replace />;
  return children;
}

export default function App() {
  const { token, user } = useAuth();
  const home = user?.nombre_rol === 'Cliente' ? '/store' : '/dashboard';

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to={home} replace /> : <Login />} />
      <Route
        path="/store"
        element={
          <ProtectedRoute customerOnly>
            <CustomerShop />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={token ? home : '/login'} replace />} />
    </Routes>
  );
}
