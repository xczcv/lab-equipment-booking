import { EventEmitter, once } from 'node:events';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { setTimeout } from 'node:timers/promises';
import assert from 'node:assert/strict';

export async function inspectServer(db, sha, work) {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    DATABASE_URL: db,
    PORT: '0',
    APP_SHA: sha,
  };
  delete env.RENDER_GIT_COMMIT;
  const child = spawn(
    process.execPath,
    ['--import', './bench/metrics.js', 'dist/main.js'],
    {
      env,
      stdio: ['ignore', 'pipe', 'inherit', 'ipc'],
    },
  );
  const events = new EventEmitter();
  const traces = new Map();
  const exit = once(child, 'exit');
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    const record = JSON.parse(line);
    const { event, port, processId, durationMs, operation } = record;
    if (event === 'server.listening') events.emit('listening', port);
    if (event === 'http.request')
      traces.set(processId, { db: [], serverMs: null });
    const trace = traces.get(processId);
    if (trace && event === 'http.result') trace.serverMs = durationMs;
    if (
      trace &&
      ['db.result', 'db.error'].includes(event) &&
      Number.isFinite(durationMs)
    ) {
      trace.db.push([operation, durationMs]);
    }
  });

  async function command(message) {
    const reply = once(child, 'message', {
      signal: AbortSignal.timeout(15_000),
    });
    child.send(message);
    const [{ result, error }] = await reply;
    if (error) throw new Error(error);
    return result;
  }

  async function correlated(samples) {
    const deadline = performance.now() + 1_500;
    while (
      samples.some(({ processId }) => traces.get(processId)?.serverMs == null)
    ) {
      if (performance.now() > deadline)
        throw new Error('Missing request trace after workload');
      await setTimeout(10);
    }
    return samples.map((sample) => ({
      ...sample,
      ...traces.get(sample.processId),
    }));
  }

  try {
    const [port] = await Promise.race([
      once(events, 'listening', { signal: AbortSignal.timeout(10_000) }),
      exit.then(([code]) => {
        throw new Error('Server exited: ' + code);
      }),
    ]);
    const base = 'http://127.0.0.1:' + port;
    const version = await fetch(base + '/version');
    assert.deepEqual(await version.json(), { sha });
    const readiness = await fetch(base + '/ready');
    assert.deepEqual(await readiness.json(), { status: 'ready' });
    return await work({
      base,
      command,
      correlated,
      clearTraces: () => traces.clear(),
    });
  } finally {
    if (child.connected) child.disconnect();
    if (child.exitCode === null && child.signalCode === null)
      child.kill('SIGTERM');
    await exit;
  }
}
