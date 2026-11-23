import { Fault } from '../domain/fault.js';

const statuses = {
  invalid_id: 400,
  invalid_date: 400,
  invalid_key: 400,
  invalid_body: 400,
  unknown_user: 401,
  not_found: 404,
  equipment_not_found: 404,
  booking_not_found: 404,
  slot_not_found: 404,
  slot_started: 409,
  slot_occupied: 409,
  key_conflict: 409,
  body_too_large: 413,
  unsupported_media_type: 415,
  storage_unavailable: 503,
};

export function httpError(error) {
  const code = error instanceof Fault ? error.code : 'internal_error';
  return { code, status: statuses[code] ?? 500 };
}
