import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

export const COLORS = [
  ['Чёрный','#24262c'],['Белый','#f4f4f0'],['Серый','#90949d'],['Бежевый','#d7c4a5'],['Коричневый','#865b3f'],
  ['Красный','#d94d52'],['Оранжевый','#ed9446'],['Жёлтый','#e8ca55'],['Зелёный','#5caa77'],['Голубой','#78bce8'],
  ['Синий','#477ad0'],['Фиолетовый','#9c79c9'],['Розовый','#df93b6'],['Серебристый','#c2c8d0'],['Золотой','#cba955'],
  ['Мультицвет','conic-gradient(#d94d52,#e8ca55,#5caa77,#477ad0,#9c79c9,#d94d52)'],
];
export function colorPicker(initial='') {
  let value=initial;
  const group=h('div.if-color-picker',{role:'radiogroup','aria-label':'Цвет'}),swatches=h('div.if-color-swatches'),caption=h('span.if-color-caption');
  const buttons=COLORS.map(([label,color],index)=>{
    const el=h('button.if-color',{type:'button',role:'radio','aria-label':label,title:label,style:{background:color},onclick:()=>choose(label)});
    el.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?COLORS.length-1:(index+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+COLORS.length)%COLORS.length;choose(COLORS[next][0]);buttons[next].focus();});
    return el;
  });
  const clear=h('button.if-color-clear',{type:'button',onclick:()=>choose('')},'Сбросить');
  function paint(){const selected=COLORS.findIndex(([label])=>label.toLocaleLowerCase('ru')===String(value).toLocaleLowerCase('ru'));buttons.forEach((el,i)=>{el.setAttribute('aria-checked',String(i===selected));el.tabIndex=i===(selected<0?0:selected)?0:-1;el.replaceChildren(...(i===selected?[icon('check',14)]:[]));});caption.textContent=value?(selected<0?'Сохранённый цвет: ':'')+value:'Не указан';clear.hidden=!value;}
  function choose(next){value=next;paint();group.dispatchEvent(new Event('input',{bubbles:true}));}
  Object.defineProperty(group,'value',{get:()=>value,set:next=>{value=next??'';paint();}});
  swatches.append(...buttons);group.append(swatches,h('div.if-color-description',caption,clear));paint();return group;
}
