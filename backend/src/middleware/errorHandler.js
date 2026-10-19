export function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';

  let message = err.message || 'Error interno del servidor';
  if (isProd && status === 500 && !err.expose) {
    message = 'Error interno del servidor';
  }

  if (status >= 500) {
    console.error('[error]', err);
  }

  res.status(status).json({
    success: false,
    error: {
      message,
      ...(err.code ? { code: err.code } : {}),
    },
  });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({
    success: false,
    error: { message: 'Ruta no encontrada' },
  });
}
