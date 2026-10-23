import { verifyAccessToken } from '../utils/jwt.js';
import { roleHasPermission } from '../services/accessService.js';
import { findUserById } from '../services/userService.js';

export async function authenticate(req, res, next) {
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
    const user = await findUserById(Number(payload.id_usuario));
    if (!user || user.estado !== 'Activo') {
      return res.status(user?.estado === 'Bloqueado' ? 423 : 401).json({
        success: false,
        error: {
          message: user?.estado === 'Bloqueado' ? 'La cuenta está bloqueada.' : 'La cuenta ya no está activa.',
          code: user?.estado === 'Bloqueado' ? 'ACCOUNT_BLOCKED' : 'ACCOUNT_INACTIVE',
        },
      });
    }
    req.user = {
      id: user.id_usuario,
      id_usuario: user.id_usuario,
      username: user.username,
      nombre: user.nombre,
      id_rol: user.id_rol,
      idRol: user.id_rol,
      nombre_rol: user.nombre_rol,
      rol: user.nombre_rol,
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
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'No autenticado', code: 'UNAUTHORIZED' },
      });
    }
    try {
      if (!(await roleHasPermission(req.user.rol, permission))) {
        return res.status(403).json({
          success: false,
          error: { message: 'No tiene permiso para esta operación', code: 'FORBIDDEN' },
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
