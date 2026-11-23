import { Fault } from '../domain/fault.js';
import { isCalendarDate } from '../domain/lab-date.js';

export function positiveId(value) {
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 2_147_483_647) {
    throw new Fault('invalid_id');
  }
  return Number(value);
}

export function bookingId(value) {
  if (
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
  ) {
    throw new Fault('invalid_id');
  }
  return value.toLowerCase();
}

export function slotDate(params) {
  const values = params.getAll('date');
  if (values.length !== 1 || !isCalendarDate(values[0]))
    throw new Fault('invalid_date');
  return values[0];
}

export function initiatorHeader(value) {
  return typeof value === 'string' && /^[a-z0-9-]{1,40}$/.test(value)
    ? value
    : null;
}

export function idempotencyKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(value)) {
    throw new Fault('invalid_key');
  }
  return value;
}

export async function requestedSlot(request) {
  if (
    !/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')
  ) {
    throw new Fault('unsupported_media_type');
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    length += chunk.length;
    if (length > 4096) {
      request.resume();
      throw new Fault('body_too_large');
    }
    chunks.push(chunk);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Fault('invalid_body');
  }
  if (
    !body ||
    !Number.isInteger(body.slotId) ||
    Object.keys(body).length !== 1
  ) {
    throw new Fault('invalid_body');
  }
  return positiveId(String(body.slotId));
}
