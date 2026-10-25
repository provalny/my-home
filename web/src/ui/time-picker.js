import {h} from './dom.js';
import {icon} from './icons.js';

export function createTimePicker(value=''){
  const options=count=>[h('option',{value:''},'—'),...Array.from({length:count},(_,i)=>{const n=String(i).padStart(2,'0');return h('option',{value:n},n);})];
  const hour=h('select',{'aria-label':'Часы'},...options(24)),minute=h('select',{'aria-label':'Минуты'},...options(60));
  const clear=h('button.iv-btn',{type:'button','aria-label':'Сбросить время',onclick:()=>{hour.value='';minute.value='';root.dispatchEvent(new Event('change',{bubbles:true}));}},icon('close',14));
  const root=h('div.tr-time-picker',{'role':'group','aria-label':'Время события'},icon('clock',17),hour,h('span',':'),minute,clear);
  const parts=value.split(':');hour.value=parts[0]||'';minute.value=parts[1]||'';
  hour.onchange=()=>{if(hour.value&&!minute.value)minute.value='00';};minute.onchange=()=>{if(minute.value&&!hour.value)hour.value='00';};
  Object.defineProperty(root,'value',{get:()=>hour.value&&minute.value?hour.value+':'+minute.value:'',set:v=>{const parts=(v||'').split(':');hour.value=parts[0]||'';minute.value=parts[1]||'';}});return root;
}
