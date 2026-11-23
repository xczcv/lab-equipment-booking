import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import { isolatedDatabase } from './support/database.js';
import { createBooking, serve } from './support/http.js';

test('two independent sessions race for a slot and the database allows one active booking', async (t) => {
  const { pool, name } = await isolatedDatabase(t, '2030-07-02');
  const request = await serve(t, pool, () =>
    Date.parse('2030-07-01T08:00:00Z'),
  );
  const locker = await pool.connect();
  await locker.query('BEGIN');
  await locker.query('SELECT 1 FROM slots WHERE id = 1 FOR UPDATE');
  const competing = Promise.all([
    createBooking(request, 1, 'race-a', 'student-a'),
    createBooking(request, 1, 'race-b', 'student-b'),
  ]);

  let waiting = 0;
  try {
    for (let attempt = 0; attempt < 70 && waiting < 2; attempt += 1) {
      const { rows } = await pool.query(
        `
        SELECT count(DISTINCT pid)::integer AS count
        FROM pg_stat_activity
        WHERE application_name = $1 AND wait_event_type = 'Lock'
          AND query LIKE 'SELECT starts_at FROM slots WHERE id = $1 FOR UPDATE%'
      `,
        [name],
      );
      waiting = rows[0].count;
      if (waiting < 2) await setTimeout(25);
    }
  } finally {
    await locker.query('ROLLBACK');
    locker.release();
  }
  const responses = await competing;
  assert.equal(waiting, 2);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409]);
  assert.deepEqual(responses.find(({ status }) => status === 409).body, {
    error: 'slot_occupied',
  });
  assert.equal(new Set(responses.map(({ processId }) => processId)).size, 2);
  assert.equal(
    (await pool.query('SELECT id FROM bookings WHERE cancelled_at IS NULL'))
      .rowCount,
    1,
  );
  assert.equal(
    (await pool.query('SELECT 1 FROM booking_receipts')).rowCount,
    1,
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO bookings (slot_id, user_id) VALUES (1, 'student-a')",
    ),
    { code: '23505', constraint: 'bookings_one_active_idx' },
  );
});
