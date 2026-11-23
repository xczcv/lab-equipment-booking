import { Fault } from '../domain/fault.js';
import {
  bookingId,
  idempotencyKey,
  positiveId,
  requestedSlot,
  slotDate,
} from './input.js';

export function routes({ catalog, bookings }) {
  return [
    ['GET', /^\/health$/, () => ({ status: 'ok' })],
    ['GET', /^\/equipment$/, () => catalog.list()],
    [
      'GET',
      /^\/equipment\/([^/]+)\/slots$/,
      ({ url, id }) =>
        catalog.available(positiveId(id), slotDate(url.searchParams)),
    ],
    [
      'POST',
      /^\/bookings$/,
      async ({ request }) =>
        bookings.create(
          await requestedSlot(request),
          idempotencyKey(request.headers['idempotency-key']),
        ),
      201,
    ],
    ['GET', /^\/bookings$/, () => bookings.list()],
    [
      'POST',
      /^\/bookings\/([^/]+)\/cancel$/,
      ({ id }) => bookings.cancel(bookingId(id)),
    ],
  ];
}

export function matchRoute(entries, method, pathname) {
  for (const [verb, pattern, handle, status = 200] of entries) {
    const match = pattern.exec(pathname);
    if (method === verb && match) return { handle, status, id: match[1] };
  }
  throw new Fault('not_found');
}
