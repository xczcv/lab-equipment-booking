import { slotIssue, type SlotIssue, type SlotSnapshot } from './slot-policy.js';

export type { SlotSnapshot } from './slot-policy.js';

export interface Booking {
  readonly id: string;
  readonly slotId: number;
  readonly status: 'active' | 'cancelled';
  readonly createdAt: string;
  readonly cancelledAt: string | null;
}

export interface Reservation {
  readSlot(): Promise<SlotSnapshot | null>;
  reserve(): Promise<Booking | null>;
}

export type CreationResult =
  | {
      readonly booking: Booking;
      readonly replay: boolean;
    }
  | { readonly keyConflict: true };

export interface BookingStore {
  userExists(userId: string): Promise<boolean>;
  withCreation(
    userId: string,
    key: string,
    slotId: number,
    work: (reservation: Reservation) => Promise<Booking>,
  ): Promise<CreationResult>;
  listBookings(userId: string): Promise<Booking[]>;
  cancelBooking(userId: string, bookingId: string): Promise<Booking | null>;
}

export type BookingEvent =
  | {
      readonly type: 'booking.created';
      readonly bookingId: string;
      readonly replay: boolean;
    }
  | { readonly type: 'booking.cancelled'; readonly bookingId: string };

export interface BookingDependencies {
  readonly store: BookingStore;
  readonly clock: () => number;
  readonly initiator: () => string | null;
  readonly onEvent: (event: BookingEvent) => void;
}

export type BookingErrorCode =
  SlotIssue | 'unknown_user' | 'booking_not_found' | 'key_conflict';

export class BookingError extends Error {
  readonly code: BookingErrorCode;

  constructor(code: BookingErrorCode) {
    super(code);
    this.code = code;
  }
}

export interface BookingService {
  create(slotId: number, key: string): Promise<Booking>;
  list(): Promise<Booking[]>;
  cancel(bookingId: string): Promise<Booking>;
}

export function createBookingService({
  store,
  clock,
  initiator,
  onEvent,
}: BookingDependencies): BookingService {
  async function activeStudent() {
    const userId = initiator();
    if (userId === null || !(await store.userExists(userId))) {
      throw new BookingError('unknown_user');
    }
    return userId;
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
          if (issue !== null) throw new BookingError(issue);
          const booking = await creation.reserve();
          if (booking === null) throw new BookingError('slot_occupied');
          return booking;
        },
      );
      if ('keyConflict' in result) throw new BookingError('key_conflict');
      onEvent({
        type: 'booking.created',
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
      if (booking === null) throw new BookingError('booking_not_found');
      onEvent({ type: 'booking.cancelled', bookingId: booking.id });
      return booking;
    },
  };
}
