import { h } from '../ui/dom.js';
import './room-form.css';
import { ROOM_TYPES, roomType, roomColor, applyRoomPresentation } from './room-types.js';
import { ROOM_ICONS } from './room-icons.js';
export function roomPresentationForm(room){
  const dropdown=(options,value,label)=>{const el=h('select',{'aria-label':label},options.map(([v,l])=>h('option',{value:v},l)));el.value=value;return el;};
  const type=dropdown([['','Выберите тип комнаты'],...ROOM_TYPES.map(t=>[t.id,t.name])],room.roomType||'','Тип комнаты');
  const label=h('input',{value:room.roomLabel||'',maxlength:100,placeholder:'Например: гостевая','aria-label':'Дополнительное название'});
  const custom=h('input',{value:room.customName||(!roomType(room.roomType)?room.name:''),maxlength:100,'aria-label':'Своё название комнаты'});
  const glyph=dropdown([['','По типу комнаты'],...ROOM_ICONS],room.icon||'','Значок комнаты');
  const color=h('input',{type:'color',value:roomColor(room),'aria-label':'Цвет карточки комнаты'}),auto=h('input',{type:'checkbox'});auto.checked=!room.cardColor;
  const customField=h('label.iv-field',h('span','Своё название'),custom);
  const render=()=>{customField.hidden=type.value!=='other';color.disabled=auto.checked;if(auto.checked)color.value=roomType(type.value)?.color||roomColor(room);};type.onchange=render;auto.onchange=render;render();
  const element=h('div.iv-room-form',h('label.iv-field',h('span','Тип комнаты'),type),customField,h('label.iv-field',h('span','Дополнительное название в скобках'),label),h('label.iv-field',h('span','Значок'),glyph),h('label.iv-field',h('span','Цвет карточки'),color),h('label.iv-room-color-auto',auto,'Цвет по типу комнаты'),h('p.iv-muted','Тип меняет только название и оформление. Планировка, мебель и вещи сохраняются.'));
  return {element,apply(target){applyRoomPresentation(target,{type:type.value,label:label.value,customName:custom.value,icon:glyph.value,cardColor:auto.checked?null:color.value});}};
}
