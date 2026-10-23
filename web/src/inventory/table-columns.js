import { h } from '../ui/dom.js';
export function resizableColumns(table,key) {
  const head=table.querySelector('.iv-table-head');if(!head)return;
  const min=[20,140,160,90,140];let widths;
  try{widths=JSON.parse(localStorage.getItem('iv:columns:'+key));}catch{}
  if(!Array.isArray(widths)||widths.length!==5||widths.some((v,i)=>!Number.isFinite(v)||v<min[i]||v>1800)){
    const available=Math.max(660,table.clientWidth)-52;widths=[20,Math.max(180,available*.34),Math.max(180,available*.32),100,140];
  }
  const paint=()=>{table.style.setProperty('--iv-columns',widths.map(v=>Math.round(v)+'px').join(' '));table.style.setProperty('--iv-table-width',widths.reduce((a,b)=>a+b,0)+52+'px');[...head.children].forEach((cell,i)=>{const handle=cell.querySelector('.iv-column-handle');if(handle){handle.setAttribute('aria-valuemin',min[i]);handle.setAttribute('aria-valuemax',1800);handle.setAttribute('aria-valuenow',Math.round(widths[i]));handle.setAttribute('aria-valuetext',Math.round(widths[i])+' пикселей');}});};
  const save=()=>localStorage.setItem('iv:columns:'+key,JSON.stringify(widths));
  [...head.children].forEach((cell,i)=>{if(!i)return;const handle=h('span.iv-column-handle',{role:'separator',tabindex:0,'aria-orientation':'vertical','aria-label':'Ширина: '+cell.textContent,title:'Перетащите границу; стрелки ← → меняют ширину'});cell.append(handle);
    handle.onpointerdown=e=>{e.preventDefault();const x=e.clientX,initial=widths[i];handle.setPointerCapture(e.pointerId);table.classList.add('is-resizing');handle.onpointermove=move=>{widths[i]=Math.max(min[i],Math.min(1800,initial+move.clientX-x));paint();};};
    const end=()=>{handle.onpointermove=null;table.classList.remove('is-resizing');save();};handle.onpointerup=end;handle.onpointercancel=end;
    handle.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();widths[i]=Math.max(min[i],Math.min(1800,widths[i]+(e.key==='ArrowRight'?10:-10)));paint();save();};
  });paint();
}
export function resetColumns(key){localStorage.removeItem('iv:columns:'+key);}
