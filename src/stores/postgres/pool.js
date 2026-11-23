import pg from 'pg';
import { log } from '../../context.js';

export function createPool(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: 2_000,
    statement_timeout: 5_000,
    max: 10,
  });
  pool.on('error', (error) =>
    log('db.idle_error', { code: error.code ?? 'unknown' }),
  );
  return pool;
}
