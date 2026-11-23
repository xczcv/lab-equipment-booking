import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { migrate } from '../dist/maintenance/migrate.js';
import { seedDemo } from '../dist/maintenance/seed.js';
import { createPool } from '../dist/stores/postgres/pool.js';
import { createBooking, serve } from './support/http.js';

test('PostgreSQL HTTP contract, transaction rollback, availability query, and correlated logs', async (t) => {
  const pool = createPool();
  t.after(() => pool.end());
  await migrate(pool);
  await seedDemo(pool, '2030-07-02');

  const lines = [];
  const original = console.log;
  t.mock.method(console, 'log', (line) => lines.push(JSON.parse(line)));
  const request = await serve(t, pool, () =>
    Date.parse('2030-07-01T08:00:00Z'),
  );
  assert.equal((await request('/equipment')).body.length, 2);
  for (const path of [
    '/equipment/1/slots',
    '/equipment/1/slots?date=2030-02-30',
    '/equipment/01/slots?date=2030-07-02',
    '/equipment/1/slots?date=2030-07-02&date=2030-07-03',
  ]) {
    assert.equal((await request(path)).status, 400);
  }
  assert.equal(
    (await request('/equipment/99/slots?date=2030-07-02')).status,
    404,
  );
  assert.equal((await request('/bookings')).status, 401);
  assert.equal(
    (await createBooking(request, 1, 'unknown-actor', 'unknown')).status,
    401,
  );
  assert.equal((await createBooking(request, 1.5, 'invalid-slot')).status, 400);
  assert.equal((await createBooking(request, 1, 'invalid key')).status, 400);
  assert.equal(
    (await request('/bookings', { method: 'POST', body: '{}' })).status,
    415,
  );
  assert.equal(
    (
      await request('/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: ' '.repeat(4097),
      })
    ).status,
    413,
  );
  assert.deepEqual((await createBooking(request, 999, 'missing-slot')).body, {
    error: 'slot_not_found',
  });

  await pool.query(`
    INSERT INTO slots VALUES
      (4, 1, '2030-07-01T21:00Z', '2030-07-01T21:15Z'),
      (5, 1, '2030-07-02T21:00Z', '2030-07-02T21:15Z'),
      (6, 1, '2030-07-01T07:00Z', '2030-07-01T07:15Z')
  `);
  assert.deepEqual((await createBooking(request, 6, 'past-slot')).body, {
    error: 'slot_started',
  });
  const result = await request('/equipment/1/slots?date=2030-07-02', {
    headers: { 'x-user-id': 'student-a' },
  });
  assert.deepEqual(
    result.body.map(({ id }) => id),
    [4, 1, 2],
  );
  const trace = lines.filter(({ processId }) => processId === result.processId);
  assert.deepEqual(
    trace.map(({ event }) => event),
    ['http.request', 'db.start', 'db.result', 'http.result'],
  );
  assert.equal(trace[1].operation, 'available_slots');
  assert.ok(trace.every(({ initiator }) => initiator === 'student-a'));

  await pool.query(`
    CREATE FUNCTION fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'intentional receipt write failure'; END;
    $$;
    CREATE TRIGGER fail_receipt_update BEFORE UPDATE ON booking_receipts
      FOR EACH ROW EXECUTE FUNCTION fail_receipt();
  `);
  const failure = await createBooking(request, 1, 'retry-after-rollback');
  assert.deepEqual(
    [failure.status, failure.body],
    [500, { error: 'internal_error' }],
  );
  const failedTrace = lines.filter(
    ({ processId }) => processId === failure.processId,
  );
  assert.ok(failedTrace.every(({ initiator }) => initiator === 'student-a'));
  assert.ok(
    failedTrace.some(
      ({ event, operation }) =>
        event === 'db.result' && operation === 'insert_booking',
    ),
  );
  assert.ok(
    failedTrace.some(
      ({ event, operation }) =>
        event === 'db.error' && operation === 'save_receipt',
    ),
  );
  assert.ok(
    failedTrace.some(
      ({ event, operation }) =>
        event === 'db.result' && operation === 'rollback',
    ),
  );
  assert.equal((await pool.query('SELECT * FROM bookings')).rowCount, 0);
  assert.equal(
    (await pool.query('SELECT * FROM booking_receipts')).rowCount,
    0,
  );
  await pool.query('DROP TRIGGER fail_receipt_update ON booking_receipts');

  const [first, repeat] = await Promise.all([
    createBooking(request, 1, 'retry-after-rollback'),
    createBooking(request, 1, 'retry-after-rollback'),
  ]);
  assert.equal(first.status, 201);
  assert.equal(repeat.status, 201);
  assert.deepEqual(first.body, repeat.body);
  assert.deepEqual(
    (await createBooking(request, 2, 'retry-after-rollback')).body,
    { error: 'key_conflict' },
  );
  assert.equal((await pool.query('SELECT * FROM bookings')).rowCount, 1);
  assert.equal(
    (await pool.query('SELECT * FROM booking_receipts')).rowCount,
    1,
  );
  for (const line of [...trace, ...failedTrace]) original(JSON.stringify(line));
});

test('connection failure returns a correlated 503', async (t) => {
  const listener = createServer((socket) => socket.destroy()).listen(
    0,
    '127.0.0.1',
  );
  t.after(() => new Promise((resolve) => listener.close(resolve)));
  await once(listener, 'listening');
  const pool = createPool(
    'postgresql://test:test@127.0.0.1:' + listener.address().port + '/test',
  );
  t.after(() => pool.end());
  const request = await serve(t, pool);
  const response = await request('/equipment');
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { error: 'storage_unavailable' });
  assert.ok(response.processId);
});
