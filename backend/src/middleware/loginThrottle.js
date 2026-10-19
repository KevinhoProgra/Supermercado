import { env } from '../config/env.js';

/** @type {Map<string, number>} clave -> timestamp hasta el cual bloquear */
const unknownUserLocks = new Map();

function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function checkLoginThrottle(req, res, next) {
  const key = clientKey(req);
  const until = unknownUserLocks.get(key);
  if (until && until > Date.now()) {
    const retryAfterSec = Math.ceil((until - Date.now()) / 1000);
    res.set('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      success: false,
      error: {
        message: 'Demasiados intentos. Espere antes de volver a intentar.',
        code: 'LOGIN_THROTTLED',
        retryAfterSec,
      },
    });
  }
  if (until) unknownUserLocks.delete(key);
  next();
}

export function applyUnknownUserLock(req) {
  const key = clientKey(req);
  unknownUserLocks.set(key, Date.now() + env.auth.unknownUserLockMs);
}
