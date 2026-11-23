import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../dist/http/server.js';
import { createMemoryStore } from '../dist/stores/memory.js';
import { memoryFixtures } from '../dist/stores/memory-fixtures.js';

test('all five operations work through the memory prototype', async (t) => {
  const clock = () => Date.parse('2030-07-01T07:00:00Z');
  const store = createMemoryStore(memoryFixtures(clock()), clock);
  const server = createApp({ store, clock }).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');

  const request = async (path, options) => {
    const response = await fetch(
      'http://127.0.0.1:' + server.address().port + path,
      options,
    );
    assert.ok(response.headers.get('x-business-process-id'));
    return [response.status, await response.json()];
  };
  const headers = {
    'x-user-id': 'student-a',
    'idempotency-key': 'request-a',
    'content-type': 'application/json',
  };
  const create = (overrides) =>
    request('/bookings', {
      method: 'POST',
      body: '{"slotId":1}',
      headers: { ...headers, ...overrides },
    });
  const slots = '/equipment/1/slots?date=2030-07-02';
  assert.equal((await request('/equipment'))[1].length, 2);
  assert.deepEqual(
    (await request(slots))[1].map(({ id }) => id),
    [1, 2],
  );
  const [first, second] = await Promise.all([
    create(),
    create({ 'x-user-id': 'student-b' }),
  ]);
  assert.deepEqual([first[0], second[0]].sort(), [201, 409]);
  const winner = first[0] === 201 ? 'student-a' : 'student-b';
  const booking = (first[0] === 201 ? first : second)[1];
  const authenticated = { headers: { 'x-user-id': winner } };
  assert.deepEqual(await create(authenticated.headers), [201, booking]);
  assert.deepEqual(await request('/bookings', authenticated), [200, [booking]]);
  assert.deepEqual(
    (await request(slots))[1].map(({ id }) => id),
    [2],
  );
  const cancelled = await request('/bookings/' + booking.id + '/cancel', {
    method: 'POST',
    ...authenticated,
  });
  assert.equal(cancelled[0], 200);
  assert.equal(cancelled[1].status, 'cancelled');
  assert.deepEqual(await create(authenticated.headers), [201, booking]);
  assert.equal(
    (
      await create({
        ...authenticated.headers,
        'idempotency-key': 'request-new',
      })
    )[0],
    201,
  );
});
