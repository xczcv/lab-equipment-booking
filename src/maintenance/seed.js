import { fileURLToPath } from 'node:url';
import { isCalendarDate } from '../domain/lab-date.js';
import { createPool } from '../stores/postgres/pool.js';

export async function seedDemo(pool, date) {
  if (date !== undefined && !isCalendarDate(date))
    throw new Error('Expected YYYY-MM-DD');
  await pool.query(
    `
    WITH add_students AS (
      INSERT INTO students (id) VALUES ('student-a'), ('student-b') ON CONFLICT DO NOTHING
    ), add_equipment AS (
      INSERT INTO equipment (id, name) VALUES (1, 'Осцилограф'), (2, 'Мультиметр')
      ON CONFLICT DO NOTHING
      RETURNING id
    ), day AS (
      SELECT COALESCE($1::date, (now() AT TIME ZONE 'Europe/Kyiv')::date + 1) AS date
    )
    INSERT INTO slots (id, equipment_id, starts_at, ends_at)
    SELECT slot.id, slot.equipment_id,
      (day.date + slot.start_time) AT TIME ZONE 'Europe/Kyiv',
      (day.date + slot.start_time + interval '1 hour') AT TIME ZONE 'Europe/Kyiv'
    FROM (VALUES (1, 1, time '14:00'), (2, 1, time '15:00'), (3, 2, time '14:00'))
      AS slot(id, equipment_id, start_time)
    CROSS JOIN day
    ON CONFLICT DO NOTHING
  `,
    [date ?? null],
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool();
  try {
    await seedDemo(pool, process.argv[2]);
    console.log('Demo data loaded.');
  } finally {
    await pool.end();
  }
}
