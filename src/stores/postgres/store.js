import { Fault } from '../../domain/fault.js';
import { availableSlotsSql } from './catalog-sql.js';
import { dbQuery, transaction } from './operations.js';

function bookingFromRow(row) {
  return {
    id: row.id,
    slotId: row.slot_id,
    status: row.cancelled_at ? 'cancelled' : 'active',
    createdAt: row.created_at.toISOString(),
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
  };
}

function bookingCreation(client, userId, slotId) {
  return {
    async readSlot() {
      const slot = await dbQuery(
        client,
        'lock_slot',
        'SELECT starts_at FROM slots WHERE id = $1 FOR UPDATE',
        [slotId],
      );
      if (slot.rowCount === 0) return null;
      const existing = await dbQuery(
        client,
        'active_on_slot',
        'SELECT 1 FROM bookings WHERE slot_id = $1 AND cancelled_at IS NULL',
        [slotId],
      );
      return {
        startsAt: +slot.rows[0].starts_at,
        occupied: existing.rowCount > 0,
      };
    },
    async reserve() {
      const { rows } = await dbQuery(
        client,
        'insert_booking',
        `INSERT INTO bookings (user_id, slot_id) VALUES ($1, $2)
         ON CONFLICT (slot_id) WHERE cancelled_at IS NULL DO NOTHING
         RETURNING id, slot_id, created_at, cancelled_at`,
        [userId, slotId],
      );
      return rows[0] ? bookingFromRow(rows[0]) : null;
    },
  };
}

export function createPostgresStore(pool) {
  return {
    async userExists(id) {
      const result = await dbQuery(
        pool,
        'find_student',
        'SELECT 1 FROM students WHERE id = $1',
        [id],
      );
      return result.rowCount === 1;
    },
    async listEquipment() {
      const { rows } = await dbQuery(
        pool,
        'list_equipment',
        'SELECT id, name FROM equipment ORDER BY id',
      );
      return rows;
    },
    async availableSlots(id, date, now) {
      const { rows } = await dbQuery(
        pool,
        'available_slots',
        availableSlotsSql,
        [id, date, new Date(now)],
      );
      if (rows.length === 0) return null;
      return rows
        .filter((row) => row.id !== null)
        .map((row) => ({
          id: row.id,
          equipmentId: row.equipment_id,
          startsAt: row.starts_at.toISOString(),
          endsAt: row.ends_at.toISOString(),
        }));
    },
    withCreation(userId, key, slotId, work) {
      return transaction(pool, async (client) => {
        const insert = await dbQuery(
          client,
          'claim_receipt',
          `INSERT INTO booking_receipts (user_id, request_key, slot_id)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [userId, key, slotId],
        );
        if (insert.rowCount === 0) {
          const receipt = await dbQuery(
            client,
            'read_receipt',
            'SELECT slot_id, response FROM booking_receipts WHERE user_id = $1 AND request_key = $2',
            [userId, key],
          );
          if (receipt.rows[0].slot_id !== slotId)
            throw new Fault('key_conflict');
          return { booking: receipt.rows[0].response, replay: true };
        }

        const booking = await work(bookingCreation(client, userId, slotId));
        await dbQuery(
          client,
          'save_receipt',
          'UPDATE booking_receipts SET response = $3 WHERE user_id = $1 AND request_key = $2',
          [userId, key, booking],
        );
        return { booking, replay: false };
      });
    },
    async listBookings(userId) {
      const { rows } = await dbQuery(
        pool,
        'list_bookings',
        `SELECT id, slot_id, created_at, cancelled_at FROM bookings
         WHERE user_id = $1 ORDER BY created_at DESC, id DESC`,
        [userId],
      );
      return rows.map(bookingFromRow);
    },
    async cancelBooking(userId, id) {
      const { rows } = await dbQuery(
        pool,
        'cancel_booking',
        `UPDATE bookings SET cancelled_at = COALESCE(cancelled_at, clock_timestamp())
         WHERE user_id = $1 AND id = $2 RETURNING id, slot_id, created_at, cancelled_at`,
        [userId, id],
      );
      return rows[0] ? bookingFromRow(rows[0]) : null;
    },
  };
}
