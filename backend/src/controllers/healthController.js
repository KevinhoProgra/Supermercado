import { env } from '../config/env.js';
import { query } from '../database/pool.js';

export async function getDbHealth(_req, res, next) {
  try {
    const result = await query('SELECT DB_NAME() AS databaseName');
    const row = result.recordset?.[0];
    const databaseName = row?.databaseName;

    if (!databaseName) {
      return res.status(503).json({
        success: false,
        error: { message: 'Conexión establecida pero no se pudo leer el nombre de la base de datos' },
      });
    }

    const expected = env.db.database;
    const matchesExpected =
      databaseName.localeCompare(expected, undefined, { sensitivity: 'accent' }) === 0;

    res.json({
      success: true,
      data: {
        databaseName,
        expectedDatabase: expected,
        matchesExpected,
        server: env.db.server,
        authMode: env.db.authMode,
      },
    });
  } catch (err) {
    err.statusCode = 503;
    err.expose = true;
    next(err);
  }
}

export function getApiHealth(_req, res) {
  res.json({
    success: true,
    data: {
      service: 'supermercado-erp-api',
      status: 'ok',
    },
  });
}
