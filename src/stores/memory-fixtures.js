import { labDate } from '../domain/lab-date.js';

export function memoryFixtures(now) {
  const today = labDate(now);
  const tomorrow = new Date(Date.parse(today) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  return {
    equipment: [
      { id: 1, name: 'Осцилограф' },
      { id: 2, name: 'Мультиметр' },
    ],
    users: ['student-a', 'student-b'],
    slots: [
      {
        id: 1,
        equipmentId: 1,
        startsAt: tomorrow + 'T10:00:00.000Z',
        endsAt: tomorrow + 'T11:00:00.000Z',
      },
      {
        id: 2,
        equipmentId: 1,
        startsAt: tomorrow + 'T11:00:00.000Z',
        endsAt: tomorrow + 'T12:00:00.000Z',
      },
      {
        id: 3,
        equipmentId: 2,
        startsAt: tomorrow + 'T10:00:00.000Z',
        endsAt: tomorrow + 'T11:00:00.000Z',
      },
    ],
  };
}
