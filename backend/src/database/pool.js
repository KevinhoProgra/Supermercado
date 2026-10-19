import { env } from '../config/env.js';

/** @type {import('mssql').ConnectionPool | null} */
let pool = null;
/** @type {Promise<import('mssql').ConnectionPool> | null} */
let connectPromise = null;

/**
 * Carga el driver mssql adecuado según el modo de autenticación.
 * Windows Integrated Security requiere msnodesqlv8 (no funciona con tedious por defecto).
 */
async function loadSqlModule() {
  if (env.db.authMode === 'windows') {
    try {
      const mod = await import('mssql/msnodesqlv8.js');
      return mod.default ?? mod;
    } catch (err) {
      const nodeHint =
        process.version.startsWith('v23') ||
        process.version.startsWith('v24') ||
        process.version.startsWith('v25') ||
        process.version.startsWith('v26')
          ? ` Node ${process.version} no tiene binarios precompilados para msnodesqlv8; use Node 20/22 LTS o DB_AUTH_MODE=sql.`
          : '';
      const hint =
        'Autenticación Windows requiere el paquete "msnodesqlv8" (Integrated Security).' +
        nodeHint +
        ' Instale con: npm install msnodesqlv8. Si falla la compilación, use Visual Studio Build Tools (C++) o Node 20/22 LTS.' +
        ' Alternativa: habilite un login SQL (DB_AUTH_MODE=sql) en SQL Server.';
      const wrapped = new Error(`${hint} Detalle: ${err.message}`);
      wrapped.cause = err;
      throw wrapped;
    }
  }
  const mod = await import('mssql');
  return mod.default ?? mod;
}

function buildConfig(sql) {
  const base = {
    server: env.db.server,
    database: env.db.database,
    pool: env.db.pool,
    options: {
      encrypt: env.db.encrypt,
      trustServerCertificate: env.db.trustServerCertificate,
      enableArithAbort: true,
    },
    requestTimeout: env.db.requestTimeout,
  };

  if (env.db.authMode === 'windows') {
    return {
      ...base,
      driver: 'msnodesqlv8',
      connectionString: [
        'Driver={ODBC Driver 17 for SQL Server}',
        `Server={${env.db.server.replace(/}/g, '}}')}}`,
        `Database={${env.db.database.replace(/}/g, '}}')}}`,
        'Trusted_Connection=Yes',
        `Encrypt=${env.db.encrypt ? 'Yes' : 'No'}`,
        `TrustServerCertificate=${env.db.trustServerCertificate ? 'Yes' : 'No'}`,
      ].join(';'),
      options: {
        ...base.options,
        trustedConnection: true,
      },
    };
  }

  if (!env.db.user || !env.db.password) {
    throw new Error(
      'DB_AUTH_MODE=sql requiere DB_USER y DB_PASSWORD en .env. ' +
        'Para Windows Authentication use DB_AUTH_MODE=windows.'
    );
  }

  return {
    ...base,
    user: env.db.user,
    password: env.db.password,
  };
}

function sanitizeConnectionError(err) {
  const message = err?.message || String(err);
  const safe = message
    .replace(/password[=:\s][^\s;'"]+/gi, 'password=***')
    .replace(/Pwd=[^;]+/gi, 'Pwd=***');
  return safe;
}

/**
 * Obtiene el pool de conexiones (singleton). Reutilizable en servicios y controladores.
 */
export async function getPool() {
  if (pool?.connected) {
    return pool;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    const sql = await loadSqlModule();
    const config = buildConfig(sql);

    try {
      pool = await sql.connect(config);
      pool.on('error', (err) => {
        console.error('[database] Error en el pool:', sanitizeConnectionError(err));
        pool = null;
        connectPromise = null;
      });
      return pool;
    } catch (err) {
      connectPromise = null;
      pool = null;
      const safe = sanitizeConnectionError(err);
      const e = new Error(`No se pudo conectar a SQL Server (${env.db.server}, BD: ${env.db.database}): ${safe}`);
      e.cause = err;
      throw e;
    }
  })();

  return connectPromise;
}

/**
 * Ejecuta una consulta parametrizada usando el pool.
 * @param {string} queryText
 * @param {Record<string, unknown>} [inputs] mapa nombre -> valor
 */
export async function query(queryText, inputs = {}) {
  const p = await getPool();
  const request = p.request();
  for (const [name, value] of Object.entries(inputs)) {
    request.input(name, value);
  }
  return request.query(queryText);
}

export async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
    connectPromise = null;
  }
}
