import { verifyAccessToken } from '../utils/jwt.js';
import { roleHasPermission } from '../constants/roles.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { message: 'No autenticado', code: 'UNAUTHORIZED' },
    });
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    if (!payload || typeof payload !== 'object' || !payload.id_usuario || !payload.username || !payload.id_rol) {
      return res.status(401).json({
        success: false,
        error: { message: 'Sesión inválida o expirada', code: 'INVALID_TOKEN' },
      });
    }
    req.user = {
      id: payload.id_usuario,
      id_usuario: payload.id_usuario,
      username: payload.username,
      nombre: payload.nombre,
      id_rol: payload.id_rol,
      idRol: payload.id_rol,
      nombre_rol: payload.nombre_rol,
      rol: payload.nombre_rol,
    };
    next();
  } catch (err) {
    if (!['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err?.name)) {
      return next(err);
    }
    return res.status(401).json({
      success: false,
      error: { message: 'Sesión inválida o expirada', code: 'INVALID_TOKEN' },
    });
  }
}

export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'No autenticado', code: 'UNAUTHORIZED' },
      });
    }
    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        success: false,
        error: { message: 'No tiene permiso para esta operación', code: 'FORBIDDEN' },
      });
    }
    next();
  };
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'No autenticado', code: 'UNAUTHORIZED' },
      });
    }
    if (!roleHasPermission(req.user.rol, permission)) {
      return res.status(403).json({
        success: false,
        error: { message: 'No tiene permiso para esta operación', code: 'FORBIDDEN' },
      });
    }
    next();
  };
}
