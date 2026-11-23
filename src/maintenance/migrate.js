import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPool } from '../stores/postgres/pool.js';

const lockId = 18_429_780;
const migrations = new URL('../../db/', import.meta.url);
const indexExistsSql = `
  SELECT indisvalid FROM pg_index WHERE indexrelid = to_regclass($1)
`;

async function ensureSchema(client, version, sql) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query(sql);
    await client.query('INSERT INTO app_migrations (version) VALUES ($1)', [
      version,
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function ensureIndex(client, version, name, sql) {
  const verify = async () =>
    (await client.query(indexExistsSql, [name])).rows[0]?.indisvalid;
  if ((await verify()) === false)
    throw new Error('Invalid index requires repair: ' + name);
  await client.query(sql);
  if (!(await verify())) throw new Error('Index is not valid: ' + name);
  await client.query('INSERT INTO app_migrations (version) VALUES ($1)', [
    version,
  ]);
}

export async function migrate(pool, phase = 'all') {
  if (!['all', 'schema', 'indexes'].includes(phase))
    throw new Error('Unknown migration phase');
  const client = await pool.connect();
  // Destroy this dedicated session on release so failures cannot leave the advisory lock held.
  try {
    await client.query("SET lock_timeout = '5s'");
    await client.query('SELECT pg_advisory_lock($1)', [lockId]);
    await client.query(
      'CREATE TABLE IF NOT EXISTS app_migrations (version text PRIMARY KEY)',
    );
    if (phase !== 'schema') await client.query('SET statement_timeout = 0');
    const { rows } = await client.query('SELECT version FROM app_migrations');
    const applied = new Set(rows.map(({ version }) => version));
    for (const group of phase === 'all' ? ['schema', 'indexes'] : [phase]) {
      const directory = new URL(group + '/', migrations);
      const files = (await readdir(directory))
        .filter((file) => file.endsWith('.sql'))
        .sort();
      for (const file of files) {
        const version = group + '/' + file;
        if (applied.has(version)) continue;
        const sql = await readFile(new URL(file, directory), 'utf8');
        if (group === 'schema') await ensureSchema(client, version, sql);
        else await ensureIndex(client, version, file.slice(0, -4), sql);
        console.log('Applied ' + version);
      }
    }
  } finally {
    client.release(true);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool();
  try {
    await migrate(pool, process.argv[2]);
  } finally {
    await pool.end();
  }
}
