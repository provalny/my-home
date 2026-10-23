export const ROOM_TYPES = [
  ['living','Гостиная','sofa','#7b99bd'],['bedroom','Спальня','bed','#a18abe'],
  ['children','Детская','baby','#d4a879'],['kitchen','Кухня','dishes','#9cb789'],
  ['dining','Столовая','coffee','#c3a079'],['bathroom','Ванная','bath','#77aebc'],
  ['shower','Душевая','shower','#77aebc'],['toilet','Туалет','toilet','#8eabb6'],
  ['hall','Прихожая','door','#b7a38d'],['corridor','Коридор','opening','#9ca6b5'],
  ['balcony','Балкон','leaf','#92ad87'],['loggia','Лоджия','flower','#7fad9f'],
  ['office','Кабинет','laptop','#869fbb'],['wardrobe','Гардеробная','clothes','#b799b6'],
  ['pantry','Кладовая','warehouse','#b2a284'],['laundry','Постирочная','washer','#7da7a7'],
  ['workshop','Мастерская','tools','#b49d79'],['garage','Гараж','car','#8b9eae'],
  ['games','Игровая','games','#9397c0'],['other','Другое','home','#8c9bac'],
].map(([id,name,glyph,color])=>({id,name,glyph,color}));
export const roomType = value => ROOM_TYPES.find(t=>t.id===value);
export const roomColor = room => /^#[\da-f]{6}$/i.test(room?.cardColor||'')?room.cardColor:roomType(room?.roomType)?.color||'#8c9bac';
export const ROOM_META = ['roomType','roomLabel','customName','icon','cardColor','roomMetaVersion'];
export function inferRoomType(room) {
  if(!room.roomType){const type=ROOM_TYPES.find(t=>t.id!=='other'&&t.name===room.name);if(type)room.roomType=type.id;}
  return room;
}
export function applyRoomPresentation(room,{type,label='',customName='',icon:override,cardColor}={}) {
  const preset=roomType(type);if(!preset)throw Error('Выберите тип комнаты');
  const extra=String(label).trim(),custom=String(customName).trim();
  if(extra.length>100||custom.length>100)throw Error('Название комнаты слишком длинное');
  if(type==='other'&&!custom)throw Error('Укажите название комнаты');
  room.roomType=type;room.roomLabel=extra;room.customName=type==='other'?custom:'';room.roomMetaVersion=1;
  room.name=(type==='other'?custom:preset.name)+(extra?` (${extra})`:'');
  if(override)room.icon=override;else delete room.icon;
  if(cardColor){if(!/^#[\da-f]{6}$/i.test(cardColor))throw Error('Выберите цвет карточки');room.cardColor=cardColor;}else delete room.cardColor;
  return room;
}
