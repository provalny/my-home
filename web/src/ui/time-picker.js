import {h} from './dom.js';
import {icon} from './icons.js';

export function createTimePicker(value=''){
  const options=(count,step=1)=>[h('option',{value:''},'—'),...Array.from({length:count},(_,i)=>{const n=String(i*step).padStart(2,'0');return h('option',{value:n},n);})];
  const hour=h('select',{'aria-label':'Часы'},...options(24)),minute=h('select',{'aria-label':'Минуты'},...options(6,10));
  const clear=h('button.iv-btn',{type:'button','aria-label':'Сбросить время',onclick:()=>{hour.value='';minute.value='';root.dispatchEvent(new Event('change',{bubbles:true}));}},icon('close',14));
  const root=h('div.tr-time-picker',{'role':'group','aria-label':'Время события'},icon('clock',17),hour,h('span',':'),minute,clear);
  function assign(v){const parts=(v||'').split(':');hour.value=parts[0]||'';minute.querySelectorAll('[data-legacy-minute]').forEach(el=>el.remove());const m=parts[1]||'';if(/^\d{2}$/.test(m)&&Number(m)<60&&Number(m)%10)minute.append(h('option',{value:m,disabled:true,'data-legacy-minute':'1'},m+' · сохранено'));minute.value=m;}assign(value);
  hour.onchange=()=>{if(hour.value&&!minute.value)minute.value='00';};minute.onchange=()=>{if(minute.value&&!hour.value)hour.value='00';};
  Object.defineProperty(root,'value',{get:()=>hour.value&&minute.value?hour.value+':'+minute.value:'',set:assign});return root;
}
