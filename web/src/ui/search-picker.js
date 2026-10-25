import {h} from './dom.js';

// Search first: never render the entire inventory as a native select menu.
export function createSearchPicker({label='Поиск хранилища',options=[],value='',onChange}={}){
  let entries=options,selected=value,disabled=false;
  const search=h('input',{type:'search','aria-label':label,placeholder:'Начните вводить название…',autocomplete:'off','aria-expanded':'false'}),results=h('div.tr-search-options',{role:'listbox','aria-label':'Результаты поиска хранилища',hidden:true}),caption=h('small.iv-muted'),root=h('div.tr-search-picker',search,caption,results);
  function updateCaption(){const entry=entries.find(e=>e.id===selected);caption.textContent=entry?'Выбрано: '+entry.label:'Хранилище не выбрано';}
  function choose(entry){selected=entry.id;search.value=entry.label;results.hidden=true;search.setAttribute('aria-expanded','false');updateCaption();onChange?.(selected);root.dispatchEvent(new Event('change',{bubbles:true}));}
  function paint(){const q=search.value.trim().toLocaleLowerCase('ru'),words=q.split(/\s+/);results.replaceChildren();results.hidden=!q||disabled;search.setAttribute('aria-expanded',String(!results.hidden));if(results.hidden)return;
    const found=entries.filter(e=>words.every(w=>(e.label+' '+(e.description||'')).toLocaleLowerCase('ru').includes(w))).slice(0,25);
    results.append(...found.map(e=>h('button',{type:'button',role:'option','aria-selected':String(e.id===selected),onclick:()=>choose(e)},h('strong',e.label),e.description?h('small',e.description):null)));
    if(!found.length)results.append(h('p.iv-muted','Хранилища не найдены. Измените запрос или создайте новое.'));
  }
  search.oninput=()=>{selected='';updateCaption();onChange?.('');paint();};
  search.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();results.querySelector('button')?.focus();}if(e.key==='Escape'){results.hidden=true;search.setAttribute('aria-expanded','false');}};
  results.onkeydown=e=>{const buttons=[...results.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();buttons[Math.max(0,Math.min(buttons.length-1,i+(e.key==='ArrowDown'?1:-1)))]?.focus();}if(e.key==='Escape'){results.hidden=true;search.focus();}};
  Object.defineProperties(root,{value:{get:()=>selected,set:v=>{selected=v||'';search.value=entries.find(e=>e.id===selected)?.label||'';results.hidden=true;updateCaption();}},disabled:{get:()=>disabled,set:v=>{disabled=Boolean(v);search.disabled=disabled;results.hidden=true;}}});
  root.setOptions=next=>{entries=next;if(!entries.some(e=>e.id===selected))selected='';root.value=selected;};root.focus=()=>search.focus();root.value=value;return root;
}
