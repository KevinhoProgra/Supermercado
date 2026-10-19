import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool } from './database/pool.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`API escuchando en http://localhost:${env.port}`);
  console.log(`Diagnóstico BD: GET http://localhost:${env.port}/api/health/db`);
});

async function shutdown(signal) {
  console.log(`\n${signal}: cerrando servidor...`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
