import {h} from '../ui/dom.js';
import {RARITIES} from './rarity.js';

// Small faceted gems drawn as SVG, consistent with the application's line icons.
function gem(index){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 40 40');svg.setAttribute('aria-hidden','true');
 const drawings=[
 ['M20 4l4 12 12 4-12 4-4 12-4-12L4 20l12-4z'],
 ['M12 13h16l-2 20H14z','M10 9h20M17 9V6h6v3M18 17v11M23 17v11'],
 ['M20 6l14 14-14 14L6 20z','M6 20h28'],
 ['M20 5l15 26H5z','M20 5v26M5 31l15-10 15 10'],
 ['M12 8h16l7 12-15 15L5 20z','M5 20h30M12 8l8 27 8-27M12 8l8 12 8-12'],
 ['M13 5h14l9 15-9 15H13L4 20z','M13 5l7 15 7-15M4 20h32M13 35l7-15 7 15','M16 15h8v10h-8z'],
 ['M5 12l8 6 7-13 7 13 8-6-4 19H9z','M9 26h22M16 18l4 8 4-8M12 35h16']
 ];const paths=drawings[index]||drawings[4];
 for(const d of paths){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path);}return svg;
}
export function rarityPicker(initial=''){
 let value=initial,disabled=false;
 const group=h('div.if-rarity-choices',{role:'radiogroup','aria-label':'Редкость'}),buttons=[];
 for(const [i,r]of [{id:'',name:'Авто',color:'var(--accent)'},...RARITIES].entries()){
  const high=['epic','legendary'].includes(r.id),label=r.id==='poor'?'Хлам':r.name;
  const b=h('button.if-rarity-choice',{type:'button',role:'radio','aria-label':r.id?'Редкость: '+label:'Редкость автоматически',title:high?'Только автоматически по названию':label,vars:{'--rarity-choice':r.color},onclick:()=>{if(high||disabled)return;value=r.id;paint();group.dispatchEvent(new Event('input',{bubbles:true}));}},gem(i),h('span',label));
  buttons.push({b,r,high});group.append(b);
 }
 function paint(){for(const {b,r,high}of buttons){b.disabled=disabled||high;b.setAttribute('aria-checked',String(value===r.id));b.tabIndex=value===r.id||!buttons.some(x=>x.r.id===value&&!x.high)&&r.id===''?0:-1;}}
 group.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const available=buttons.filter(x=>!x.b.disabled),index=available.findIndex(x=>x.r.id===value),next=e.key==='Home'?0:e.key==='End'?available.length-1:(index+(e.key==='ArrowLeft'?-1:1)+available.length)%available.length;available[next].b.click();available[next].b.focus();});
 Object.defineProperties(group,{value:{get:()=>value,set:v=>{value=v||'';paint();}},disabled:{get:()=>disabled,set:v=>{disabled=Boolean(v);paint();}}});paint();return group;
}
