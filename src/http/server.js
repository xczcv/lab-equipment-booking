import { createServer } from 'node:http';

export function createApp() {
  return createServer((request, response) => {
    const health = request.method === 'GET' && request.url === '/health';
    response.writeHead(health ? 200 : 404, {
      'content-type': 'application/json',
    });
    response.end(
      JSON.stringify(health ? { status: 'ok' } : { error: 'not_found' }),
    );
  });
}
