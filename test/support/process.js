import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';

export async function serveProcess(t, url, overrides = {}) {
  const child = spawn(process.execPath, ['dist/main.js'], {
    env: { ...process.env, DATABASE_URL: url, PORT: '0', ...overrides },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  t.after(async () => {
    if (child.exitCode === null) child.kill('SIGTERM');
    await exited;
  });
  const logs = [];
  child.stderr.on('data', (chunk) => logs.push(chunk.toString()));
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Startup timed out: ' + logs.join(''))),
      10_000,
    );
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      const record = JSON.parse(line);
      if (record.event === 'server.listening') {
        clearTimeout(timer);
        resolve(record.port);
      }
    });
    exited.then(([code]) => {
      clearTimeout(timer);
      reject(new Error('Server exited ' + code + ': ' + logs.join('')));
    }, reject);
  });
  return async (path, options) => {
    const response = await fetch('http://127.0.0.1:' + port + path, options);
    return { status: response.status, body: await response.json() };
  };
}
