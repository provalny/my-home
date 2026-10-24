import { EXTRA_MODEL_INFO } from '../three/furniture-info.js';

export const OBJECT_SECTIONS = {
  furniture: 'Мебель',
  appliances: 'Бытовая техника',
  electronics: 'Домашняя электроника',
  cozy: 'Уют',
};
export const ELECTRONICS_TYPES = new Set(['tv', 'fridge', ...Object.keys(EXTRA_MODEL_INFO).filter(type => EXTRA_MODEL_INFO[type].category === 'electronics')]);
const APPLIANCE_TYPES = new Set(['fridge', 'washingMachine', 'dishwasher', 'stove', 'microwave']);
// Tables, beds and seating may contain drawers; baskets and vehicles provide storage too.
const COZY_TYPES = new Set(['parrotCage','rug', 'plant', 'bathtub', 'toilet', 'showerCabin', 'tireStack','neonPorsche','ikeaFloorLamp']);
export function objectSection(type) {
  if (APPLIANCE_TYPES.has(type)) return 'appliances';
  if (ELECTRONICS_TYPES.has(type)) return 'electronics';
  if (COZY_TYPES.has(type)) return 'cozy';
  return 'furniture';
}
