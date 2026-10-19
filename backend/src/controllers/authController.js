import { env } from '../config/env.js';
import { USER_STATES } from '../constants/roles.js';
import { findUserByUsername } from '../services/userService.js';
import { incrementFailedLogin, resetFailedLogins } from '../services/authService.js';
import { registrarBitacora } from '../services/bitacoraService.js';
import { verifyPassword } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';
import { applyUnknownUserLock } from '../middleware/loginThrottle.js';

function loginError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: { code, message },
  });
}

export async function login(req, res, next) {
  const { username, password } = req.body ?? {};
  if (
    typeof username !== 'string' ||
    username.trim().length === 0 ||
    username.length > 50 ||
    typeof password !== 'string' ||
    password.length === 0
  ) {
    return loginError(res, 400, 'INVALID_CREDENTIALS', 'Ingrese usuario y contraseña válidos.');
  }

  try {
    const user = await findUserByUsername(username.trim());
    if (!user) {
      applyUnknownUserLock(req);
      await registrarBitacora({
        accion: 'LOGIN_FALLIDO',
        detalle: 'Intento de inicio de sesión para un usuario inexistente.',
        resultado: 'Fallo',
      });
      return loginError(res, 401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');
    }

    if (user.estado === USER_STATES.BLOCKED) {
      await registrarBitacora({
        idUsuario: user.id_usuario,
        accion: 'LOGIN_RECHAZADO',
        detalle: 'Intento de inicio de sesión en una cuenta bloqueada.',
        resultado: 'Advertencia',
      });
      return loginError(res, 423, 'ACCOUNT_BLOCKED', 'La cuenta está bloqueada. Contacte a un administrador.');
    }

    if (user.estado !== USER_STATES.ACTIVE) {
      await registrarBitacora({
        idUsuario: user.id_usuario,
        accion: 'LOGIN_RECHAZADO',
        detalle: 'Intento de inicio de sesión en una cuenta inactiva.',
        resultado: 'Advertencia',
      });
      return loginError(res, 403, 'ACCOUNT_INACTIVE', 'La cuenta está inactiva.');
    }

    const passwordMatches = await verifyPassword(password, user.password_hash);
    if (!passwordMatches) {
      const updatedUser = await incrementFailedLogin(user.id_usuario, env.auth.maxFailedAttempts);
      await registrarBitacora({
        idUsuario: user.id_usuario,
        accion: 'LOGIN_FALLIDO',
        detalle: 'Contraseña incorrecta.',
        resultado: 'Fallo',
      });
      if (updatedUser?.estado === USER_STATES.BLOCKED) {
        await registrarBitacora({
          idUsuario: user.id_usuario,
          accion: 'USUARIO_BLOQUEADO',
          detalle: `Cuenta bloqueada tras ${updatedUser.intentos_fallidos} intentos fallidos.`,
          resultado: 'Advertencia',
        });
        return loginError(res, 423, 'ACCOUNT_BLOCKED', 'La cuenta fue bloqueada tras varios intentos fallidos.');
      }
      if (!updatedUser) {
        const latestUser = await findUserByUsername(user.username);
        if (latestUser?.estado === USER_STATES.BLOCKED) {
          return loginError(res, 423, 'ACCOUNT_BLOCKED', 'La cuenta está bloqueada. Contacte a un administrador.');
        }
        if (latestUser?.estado === USER_STATES.INACTIVE) {
          return loginError(res, 403, 'ACCOUNT_INACTIVE', 'La cuenta está inactiva.');
        }
      }
      return loginError(res, 401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');
    }

    const reset = await resetFailedLogins(user.id_usuario);
    if (!reset) {
      return loginError(res, 423, 'ACCOUNT_BLOCKED', 'La cuenta ya no está activa. Contacte a un administrador.');
    }

    await registrarBitacora({
      idUsuario: user.id_usuario,
      accion: 'LOGIN_EXITOSO',
      detalle: 'Inicio de sesión exitoso.',
      resultado: 'Exito',
    });

    const token = signAccessToken({
      sub: String(user.id_usuario),
      id_usuario: user.id_usuario,
      username: user.username,
      id_rol: user.id_rol,
      nombre: user.nombre,
      nombre_rol: user.nombre_rol,
      idRol: user.id_rol,
      rol: user.nombre_rol,
    });
    return res.json({
      success: true,
      data: {
        token,
        user: {
          id_usuario: user.id_usuario,
          nombre: user.nombre,
          username: user.username,
          id_rol: user.id_rol,
          nombre_rol: user.nombre_rol,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

export function getCurrentUser(req, res) {
  return res.json({ success: true, data: { user: req.user } });
}
