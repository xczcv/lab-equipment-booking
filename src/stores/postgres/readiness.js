import { dbQuery } from './operations.js';

export async function databaseReady(pool) {
  const { rows } = await dbQuery(
    pool,
    'readiness',
    `
    SELECT
      to_regclass('students') IS NOT NULL
      AND to_regclass('equipment') IS NOT NULL
      AND to_regclass('slots') IS NOT NULL
      AND to_regclass('bookings') IS NOT NULL
      AND to_regclass('booking_receipts') IS NOT NULL
      AND (
        SELECT count(*) = 2
        FROM pg_index
        WHERE indisvalid AND indexrelid IN (
          to_regclass('bookings_one_active_idx'),
          to_regclass('bookings_owner_history_idx')
        )
      ) AS ready
  `,
  );
  return rows[0].ready;
}
