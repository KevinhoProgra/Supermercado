import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'sistemanegocio.session';
const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY);
    if (!serialized) return { token: null, user: null };
    const session = JSON.parse(serialized);
    if (typeof session.token !== 'string' || !session.user) {
      window.localStorage.removeItem(STORAGE_KEY);
      return { token: null, user: null };
    }
    return session;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);

  const login = useCallback((token, user) => {
    const nextSession = { token, user };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession({ token: null, user: null });
  }, []);

  const value = useMemo(
    () => ({ token: session.token, user: session.user, login, logout }),
    [session]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return context;
}
