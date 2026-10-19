/**
 * Prueba de conexión desde línea de comandos (misma lógica que GET /api/health/db).
 * Uso: node scripts/check-db.js
 */
import { query, closePool } from '../src/database/pool.js';

async function main() {
  const result = await query('SELECT DB_NAME() AS databaseName');
  const databaseName = result.recordset?.[0]?.databaseName;
  console.log(JSON.stringify({ success: true, databaseName }, null, 2));
  await closePool();
}

main().catch(async (err) => {
  console.error(JSON.stringify({ success: false, message: err.message }, null, 2));
  await closePool().catch(() => {});
  process.exit(1);
});
