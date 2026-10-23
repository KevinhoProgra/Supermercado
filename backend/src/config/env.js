import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function readAuthMode() {
  const raw = (process.env.DB_AUTH_MODE || 'windows').toLowerCase();
  if (raw === 'windows' || raw === 'integrated') return 'windows';
  if (raw === 'sql' || raw === 'sa') return 'sql';
  return 'windows';
}

export const env = {
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  auth: {
    maxFailedAttempts: Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS) || 2,
  },
  seed: {
    adminPassword: process.env.SEED_ADMIN_PASSWORD || '',
    admin1: {
      username: process.env.SEED_ADMIN1_USERNAME || 'admin1',
      nombre: process.env.SEED_ADMIN1_NOMBRE || 'Administrador Uno',
    },
    admin2: {
      username: process.env.SEED_ADMIN2_USERNAME || 'admin2',
      nombre: process.env.SEED_ADMIN2_NOMBRE || 'Administrador Dos',
    },
    cashier: {
      username: process.env.SEED_CAJERO_USERNAME || 'Cajero',
      nombre: process.env.SEED_CAJERO_NOMBRE || 'Cajero',
    },
    purchasing: {
      username: process.env.SEED_COMPRAS_USERNAME || 'Encargado de compras',
      nombre: process.env.SEED_COMPRAS_NOMBRE || 'Encargado de compras',
    },
  },
  db: {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'SistemaNegocio',
    authMode: readAuthMode(),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    pool: {
      max: Number(process.env.DB_POOL_MAX) || 10,
      min: Number(process.env.DB_POOL_MIN) || 0,
    },
    requestTimeout: Number(process.env.DB_REQUEST_TIMEOUT_MS) || 30000,
  },
};
