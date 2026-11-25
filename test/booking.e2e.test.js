import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isolatedDatabase } from './support/database.js';
import { createBooking } from './support/http.js';
import { serveProcess } from './support/process.js';

test('built API finds, creates, replays, cancels and rebooks a slot', async (t) => {
  const date = '2099-07-02';
  const { url } = await isolatedDatabase(t, date);
  const sha = '0123456789abcdef0123456789abcdef01234567';
  const request = await serveProcess(t, url, {
    APP_SHA: sha,
    RENDER_GIT_COMMIT: sha,
  });
  assert.deepEqual(await request('/ready'), {
    status: 200,
    body: { status: 'ready' },
  });
  assert.deepEqual(await request('/version'), { status: 200, body: { sha } });
  const students = {
    first: { headers: { 'x-user-id': 'student-a' } },
    other: { headers: { 'x-user-id': 'student-b' } },
  };
  const equipment = (await request('/equipment')).body;
  assert.equal(equipment[0].name, 'Осцилограф');
  const slots = '/equipment/' + equipment[0].id + '/slots?date=' + date;
  const initial = await request(slots);
  const id = initial.body[0].id;
  assert.equal(initial.status, 200);
  const first = await createBooking(request, id, 'e2e-first');
  assert.equal(first.status, 201);
  assert.deepEqual(await createBooking(request, id, 'e2e-first'), first);
  assert.deepEqual((await request('/bookings', students.other)).body, []);
  assert.deepEqual((await request('/bookings', students.first)).body, [
    first.body,
  ]);
  assert.ok(!(await request(slots)).body.some((slot) => slot.id === id));

  const cancel = '/bookings/' + first.body.id + '/cancel';
  assert.equal(
    (await request(cancel, { method: 'POST', ...students.other })).status,
    404,
  );
  const cancelled = await request(cancel, {
    method: 'POST',
    ...students.first,
  });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.status, 'cancelled');
  assert.ok(cancelled.body.cancelledAt);
  assert.deepEqual(
    await request(cancel, { method: 'POST', ...students.first }),
    cancelled,
  );
  assert.deepEqual(await createBooking(request, id, 'e2e-first'), first);
  assert.ok((await request(slots)).body.some((slot) => slot.id === id));
  const second = await createBooking(request, id, 'e2e-second', 'student-b');
  assert.equal(second.status, 201);
  assert.notEqual(second.body.id, first.body.id);
  assert.deepEqual((await request('/bookings', students.first)).body, [
    cancelled.body,
  ]);
  assert.deepEqual((await request('/bookings', students.other)).body, [
    second.body,
  ]);
  assert.ok(!(await request(slots)).body.some((slot) => slot.id === id));
});
