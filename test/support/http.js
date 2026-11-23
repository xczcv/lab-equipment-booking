import { once } from 'node:events';
import { createApp } from '../../dist/http/server.js';
import { createPostgresStore } from '../../dist/stores/postgres/store.js';

export async function serve(t, pool, clock, options = {}) {
  const server = createApp({
    store: createPostgresStore(pool),
    clock,
    ...options,
  }).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  return async (path, options) => {
    const response = await fetch(
      'http://127.0.0.1:' + server.address().port + path,
      options,
    );
    return {
      status: response.status,
      body: await response.json(),
      processId: response.headers.get('x-business-process-id'),
    };
  };
}

export function createBooking(request, slotId, key, userId = 'student-a') {
  return request('/bookings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': userId,
      'idempotency-key': key,
    },
    body: JSON.stringify({ slotId }),
  });
}
