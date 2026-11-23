import { randomUUID } from 'node:crypto';
import { Fault } from '../domain/fault.js';
import { labDate } from '../domain/lab-date.js';

export function createMemoryStore({
  equipment,
  slots,
  users,
  clock = Date.now,
}) {
  const bookings = new Map();
  const receipts = new Map();
  let previous = Promise.resolve();

  const occupied = (slotId) =>
    [...bookings.values()].some(
      ({ booking }) => booking.slotId === slotId && booking.status === 'active',
    );

  return {
    userExists: (id) => users.includes(id),
    listEquipment: () => equipment,
    availableSlots(id, date, now) {
      if (!equipment.some((item) => item.id === id)) return null;
      return slots
        .filter(
          (slot) =>
            slot.equipmentId === id &&
            labDate(Date.parse(slot.startsAt)) === date,
        )
        .filter((slot) => Date.parse(slot.startsAt) > now && !occupied(slot.id))
        .sort(
          (first, second) =>
            Date.parse(first.startsAt) - Date.parse(second.startsAt),
        );
    },
    withCreation(userId, key, slotId, work) {
      const receiptId = JSON.stringify([userId, key]);
      const run = previous.then(async () => {
        const receipt = receipts.get(receiptId);
        if (receipt) {
          if (receipt.slotId !== slotId) throw new Fault('key_conflict');
          return { booking: receipt, replay: true };
        }
        const booking = await work({
          readSlot() {
            const slot = slots.find((item) => item.id === slotId);
            return slot
              ? {
                  startsAt: Date.parse(slot.startsAt),
                  occupied: occupied(slotId),
                }
              : null;
          },
          reserve() {
            if (occupied(slotId)) return null;
            return {
              id: randomUUID(),
              slotId,
              status: 'active',
              createdAt: new Date(clock()).toISOString(),
              cancelledAt: null,
            };
          },
        });
        bookings.set(booking.id, { booking, userId });
        receipts.set(receiptId, booking);
        return { booking, replay: false };
      });
      previous = run.catch(() => {});
      return run;
    },
    listBookings(userId) {
      return [...bookings.values()]
        .filter((item) => item.userId === userId)
        .map((item) => item.booking)
        .reverse();
    },
    cancelBooking(userId, id) {
      const item = bookings.get(id);
      if (!item || item.userId !== userId) return null;
      if (item.booking.status === 'cancelled') return item.booking;
      const booking = {
        ...item.booking,
        status: 'cancelled',
        cancelledAt: new Date(clock()).toISOString(),
      };
      bookings.set(id, { booking, userId });
      return booking;
    },
  };
}
