import { log } from '../../context.js';
import { Fault } from '../../domain/fault.js';

const unavailable = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  '57P01',
  '57P02',
  '57P03',
  '53300',
  '57014',
  '55P03',
  '40001',
  '40P01',
]);

function toStorageError(error) {
  if (
    unavailable.has(error.code) ||
    error.code?.startsWith('08') ||
    /timeout exceeded when trying to connect|connection terminated|client has already been closed/i.test(
      error.message,
    )
  ) {
    return new Fault('storage_unavailable');
  }
  return error;
}

async function operation(name, run, rowCount = () => undefined) {
  const start = performance.now();
  log('db.start', { operation: name });
  try {
    const result = await run();
    log('db.result', {
      operation: name,
      durationMs: performance.now() - start,
      rowCount: rowCount(result),
    });
    return result;
  } catch (error) {
    log('db.error', {
      operation: name,
      durationMs: performance.now() - start,
      code: error.code ?? 'unknown',
    });
    throw toStorageError(error);
  }
}

export function dbQuery(client, name, sql, values) {
  return operation(
    name,
    () => client.query(sql, values),
    (result) => result.rowCount,
  );
}

export async function transaction(pool, work) {
  const client = await operation('connect', () => pool.connect());
  let broken;
  try {
    await dbQuery(client, 'begin', 'BEGIN');
    const result = await work(client);
    await dbQuery(client, 'commit', 'COMMIT');
    return result;
  } catch (error) {
    try {
      await dbQuery(client, 'rollback', 'ROLLBACK');
    } catch (rollbackError) {
      broken = rollbackError;
    }
    throw error;
  } finally {
    client.release(broken);
    log('db.result', { operation: 'release', evicted: Boolean(broken) });
  }
}
