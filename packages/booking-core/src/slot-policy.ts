export interface SlotSnapshot {
  readonly startsAt: number;
  readonly occupied: boolean;
}

export type SlotIssue = 'slot_not_found' | 'slot_started' | 'slot_occupied';

export function slotIssue(
  slot: SlotSnapshot | null,
  now: number,
): SlotIssue | null {
  if (slot === null) return 'slot_not_found';
  if (slot.startsAt <= now) return 'slot_started';
  if (slot.occupied) return 'slot_occupied';
  return null;
}
