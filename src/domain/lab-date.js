export function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    return false;
  }
  const date = new Date(value);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}
