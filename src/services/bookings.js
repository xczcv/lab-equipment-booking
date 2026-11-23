import { requestContext, log } from '../context.js';
import { Fault } from '../domain/fault.js';
import { slotIssue } from '../domain/slot-policy.js';

export function createBookingService(store, clock) {
  async function activeStudent() {
    const { initiator } = requestContext();
    if (initiator === null || !(await store.userExists(initiator))) {
      throw new Fault('unknown_user');
    }
    return initiator;
  }

  return {
    async create(slotId, key) {
      const userId = await activeStudent();
      const result = await store.withCreation(
        userId,
        key,
        slotId,
        async (creation) => {
          const slot = await creation.readSlot();
          const issue = slotIssue(slot, clock());
          if (issue !== null) throw new Fault(issue);
          const booking = await creation.reserve();
          if (booking === null) throw new Fault('slot_occupied');
          return booking;
        },
      );
      log('booking.created', {
        bookingId: result.booking.id,
        replay: result.replay,
      });
      return result.booking;
    },
    async list() {
      return store.listBookings(await activeStudent());
    },
    async cancel(id) {
      const booking = await store.cancelBooking(await activeStudent(), id);
      if (booking === null) throw new Fault('booking_not_found');
      log('booking.cancelled', { bookingId: booking.id });
      return booking;
    },
  };
}
