import { randomUUID } from 'node:crypto';
import { migrate } from '../../dist/maintenance/migrate.js';
import { seedDemo } from '../../dist/maintenance/seed.js';
import { createPool } from '../../dist/stores/postgres/pool.js';

export async function isolatedDatabase(t, date) {
  const name = 'test_' + randomUUID().replaceAll('-', '');
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('options', '-c search_path=' + name);
  url.searchParams.set('application_name', name);
  const admin = createPool();
  const pool = createPool(url.href);
  t.after(async () => {
    await pool.end();
    try {
      await admin.query('DROP SCHEMA IF EXISTS ' + name + ' CASCADE');
    } finally {
      await admin.end();
    }
  });
  await admin.query('CREATE SCHEMA ' + name);
  await migrate(pool);
  await seedDemo(pool, date);
  return { pool, url: url.href, name };
}
