import { log } from './context.js';
import { createApp } from './http/server.js';
import { dbQuery } from './stores/postgres/operations.js';
import { createPool } from './stores/postgres/pool.js';
import { createPostgresStore } from './stores/postgres/store.js';

const port = Number(process.env.PORT ?? 3000);
const pool = createPool();
try {
  await dbQuery(pool, 'startup', 'SELECT now()');
} catch (error) {
  await pool.end();
  throw error;
}
const server = createApp({ store: createPostgresStore(pool) });
server.listen(port, '0.0.0.0', () =>
  log('server.listening', { port: server.address().port }),
);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => void pool.end()));
}
