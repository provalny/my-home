import { planForNode } from './spaces.js';
import { roomType } from './room-types.js';
// Stable IDs are shared by room cards, the location tree and saved plans.
export const ROOM_ICONS = [
  ['home','Комната'],['sofa','Гостиная'],['bed','Спальня'],['bath','Ванная'],
  ['shower','Душевая'],['toilet','Туалет'],['dishes','Кухня'],['coffee','Столовая'],
  ['door','Прихожая'],['opening','Коридор'],['leaf','Балкон'],['warehouse','Кладовая'],
  ['laptop','Кабинет'],['baby','Детская'],['games','Игровая'],['tools','Мастерская'],
  ['car','Гараж'],['clothes','Гардеробная'],['washer','Постирочная'],['flower','Лоджия'],
];
export const validRoomIcon = value => ROOM_ICONS.some(([id])=>id===value);
export function roomGlyph(room) { return validRoomIcon(room?.icon) ? room.icon : roomType(room?.roomType)?.glyph || 'home'; }
export function setRoomIcon(doc,nodeId,glyph) {
  const n=doc.nodes.find(n=>n.id===nodeId&&n.kind==='room'&&!n.virtual);
  if(!n||!validRoomIcon(glyph))throw Error('Выберите значок комнаты из набора');
  n.icon=glyph;
  const room=planForNode(doc,n).rooms.find(r=>r.id===n.roomId);if(room)room.icon=glyph;
}
