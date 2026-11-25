import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { migrate } from '../dist/maintenance/migrate.js';
import { availableSlotsSql } from '../dist/stores/postgres/catalog-sql.js';
import { createPool } from '../dist/stores/postgres/pool.js';

export const fixture = {
  equipment: 48,
  days: 60,
  slotsPerDay: 32,
  firstDate: '2099-07-01',
};

export async function withFixture(work) {
  const schema = 'bench_' + randomUUID().replaceAll('-', '');
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('options', '-c search_path=' + schema);
  const admin = createPool();
  const pool = createPool(url.href);
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    await migrate(pool);
    await pool.query(
      `
      INSERT INTO equipment SELECT id, 'Instrument ' || id FROM generate_series(1, $1) AS id;
    `,
      [fixture.equipment],
    );
    await pool.query(
      "INSERT INTO students VALUES ('student-a'), ('student-b')",
    );
    const { rowCount: slots } = await pool.query(
      `
      INSERT INTO slots (id, equipment_id, starts_at, ends_at)
      SELECT ((e - 1) * $2 + d) * $3 + s + 1, e, start_time, start_time + interval '15 min'
      FROM generate_series(1, $1) AS e
      CROSS JOIN generate_series(0, $2 - 1) AS d
      CROSS JOIN generate_series(0, $3 - 1) AS s
      CROSS JOIN LATERAL (
        SELECT ($4::date + d + time '08:00' + (s * interval '15 min'))
          AT TIME ZONE 'Europe/Kyiv' AS start_time
      ) AS start
    `,
      [fixture.equipment, fixture.days, fixture.slotsPerDay, fixture.firstDate],
    );
    const { rowCount: activeBookings } = await pool.query(`
      INSERT INTO bookings (user_id, slot_id, created_at)
      SELECT 'student-a', id, '2099-06-01T00:00Z'
      FROM slots WHERE equipment_id > 2 AND id % 5 = 0
    `);
    await pool.query(
      'ANALYZE equipment; ANALYZE slots; ANALYZE bookings; ANALYZE students; ANALYZE booking_receipts',
    );
    const {
      rows: [db],
    } = await pool.query("SELECT current_setting('server_version') AS version");
    return await work({
      pool,
      url: url.href,
      slots,
      activeBookings,
      postgres: db.version,
    });
  } finally {
    await pool.end();
    try {
      await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
    } finally {
      await admin.end();
    }
  }
}

export async function writeQueryPlan(pool, directory, sha) {
  const sql = 'EXPLAIN (ANALYZE, BUFFERS) ' + availableSlotsSql;
  const params = [3, '2099-07-02', new Date('2099-06-30T00:00:00Z')];
  const { rows } = await pool.query(sql, params);
  await writeFile(
    join(directory, 'explain.txt'),
    [
      'SHA ' + sha,
      'Parameters ' + JSON.stringify(params),
      sql.trim(),
      '',
      ...rows.map((row) => row['QUERY PLAN']),
      '',
    ].join('\n'),
  );
}
