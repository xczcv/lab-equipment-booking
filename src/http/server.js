import { createServer } from 'node:http';
import { log, requestContext, runRequest } from '../context.js';
import { createBookingService } from '../services/bookings.js';
import { createCatalogService } from '../services/catalog.js';
import { httpError } from './errors.js';
import { initiatorHeader } from './input.js';
import { matchRoute, routes } from './routes.js';

function send(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

export function createApp({
  store,
  clock = Date.now,
  ready = () => false,
  sha = 'dev',
} = {}) {
  const entries = routes({
    catalog: createCatalogService(store, clock),
    bookings: createBookingService(store, clock),
    ready,
    sha,
  });
  return createServer({ requestTimeout: 15_000 }, (request, response) => {
    runRequest(initiatorHeader(request.headers['x-user-id']), async () => {
      response.setHeader('x-business-process-id', requestContext().processId);
      const start = performance.now();
      let status;
      try {
        const url = new URL(request.url, 'http://localhost');
        log('http.request', { method: request.method, path: url.pathname });
        const route = matchRoute(entries, request.method, url.pathname);
        const body = await route.handle({ request, url, id: route.id });
        status = route.status;
        send(response, status, body);
      } catch (error) {
        const failure = httpError(error);
        status = failure.status;
        log('http.error', { code: failure.code });
        send(response, status, { error: failure.code });
      } finally {
        log('http.result', { status, durationMs: performance.now() - start });
      }
    });
  });
}
