import { Fault } from '../domain/fault.js';

export function createCatalogService(store, clock) {
  return {
    list: () => store.listEquipment(),
    async available(id, date) {
      const slots = await store.availableSlots(id, date, clock());
      if (slots === null) throw new Fault('equipment_not_found');
      return slots;
    },
  };
}
