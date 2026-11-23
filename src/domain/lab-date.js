export const LAB_ZONE = 'Europe/Kyiv';
const labDay = new Intl.DateTimeFormat('sv-SE', {
  timeZone: LAB_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function labDate(timestamp) {
  return labDay.format(timestamp);
}

export function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    return false;
  }
  const date = new Date(value);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}
