import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function assertJwtConfigured() {
  if (!env.jwt.secret || env.jwt.secret.length < 16) {
    throw new Error('JWT_SECRET debe definirse en .env (mínimo 16 caracteres).');
  }
}

export function signAccessToken(payload) {
  assertJwtConfigured();
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

export function verifyAccessToken(token) {
  assertJwtConfigured();
  return jwt.verify(token, env.jwt.secret);
}
