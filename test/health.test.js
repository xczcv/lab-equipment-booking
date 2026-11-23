import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../dist/http/server.js';

test('built server answers health over HTTP', async (t) => {
  const server = createApp().listen(0, '127.0.0.1');
  t.after(
    () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  await once(server, 'listening');
  const response = await fetch(
    'http://127.0.0.1:' + server.address().port + '/health',
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});
