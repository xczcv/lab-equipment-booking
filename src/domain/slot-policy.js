export function slotIssue(slot, now) {
  if (slot === null) return 'slot_not_found';
  if (slot.startsAt <= now) return 'slot_started';
  if (slot.occupied) return 'slot_occupied';
  return null;
}
