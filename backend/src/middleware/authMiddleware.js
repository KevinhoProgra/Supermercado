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
    req.user = {
      id: payload.sub,
      username: payload.username,
      nombre: payload.nombre,
      idRol: payload.idRol,
      rol: payload.rol,
    };
    next();
  } catch {
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
