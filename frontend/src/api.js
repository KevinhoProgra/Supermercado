const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export async function apiRequest(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error?.message || 'No se pudo completar la solicitud.');
    error.status = response.status;
    error.code = body.error?.code;
    throw error;
  }
  return body.data;
}
