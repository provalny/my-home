import {h} from '../ui/dom.js';
import {icon} from '../ui/icons.js';
import {FIELDS,eligible} from './model.js';
import {MANUAL_KEYS,manualValue,missingFields,manualItems,planManualChanges,applyManualChanges} from './manual-model.js';

const button=(label,action,glyph,primary=false)=>h('button.iv-btn'+(primary?'.primary':''),{type:'button',onclick:action},glyph?icon(glyph,14):null,label);
const filters=[['missing','Есть пропуски'],['empty','Все параметры пусты'],['officialName','Нет официального названия'],['mpn','Нет артикула'],['weightGrams','Не указан вес'],['transportLiters','Не указан объём'],['all','Все вещи']];
export function createManualMaster({getDocument,change,onChange}) {
  let filter='missing',query='',pageSize=60,saving=false,message='',host=null;
  const selected=new Set(),drafts=new Map();
  const redraw=()=>{if(host)render(host);};
  function dirtyPlans(){
    return [...drafts].filter(([id])=>selected.has(id)).map(([id,draft])=>({id,fields:planManualChanges(draft.base,draft.values)})).filter(p=>p.fields.length);
  }
  async function save(){
    if(saving)return;saving=true;message='';redraw();
    try{
      const plans=dirtyPlans();
      if(!plans.length){for(const id of selected)drafts.delete(id);message='Изменений для сохранения нет';}
      else{
        await change(d=>applyManualChanges(d,plans),{action:'Мастер предметов: ручные параметры',retryable:false});
        for(const p of plans){drafts.delete(p.id);selected.delete(p.id);}
        message=`Сохранено предметов: ${plans.length}. Изменения можно отменить.`;
      }
    }catch(e){message=e.message;}
    finally{saving=false;redraw();onChange();}
  }
  function render(container){
    host=container;const doc=getDocument(),all=doc.nodes.filter(eligible),matches=manualItems(doc,{filter,query}),shown=matches.slice(0,pageSize);
    for(const id of selected)if(!all.some(n=>n.id===id)){selected.delete(id);drafts.delete(id);}
    const select=h('select',{'aria-label':'Какие параметры не заполнены'},...filters.map(([value,label])=>h('option',{value},label)));select.value=filter;select.disabled=saving;
    const search=h('input',{type:'search',value:query,placeholder:'Найти предмет…','aria-label':'Поиск в ручном мастере'});search.disabled=saving;
    const selectionText=h('span.im-manual-count'),saveButton=button('Сохранить изменения',save,'check',true);
    const reset=button('Сбросить черновики',()=>{drafts.clear();selected.clear();message='';redraw();},'close');
    const toolbar=h('div.im-manual-actions',selectionText,saveButton,reset);
    function updateControls(){
      const count=[...drafts.keys()].filter(id=>selected.has(id)).length;
      selectionText.textContent=`Найдено: ${matches.length} · Выбрано: ${selected.size} · Изменено: ${count}`;
      saveButton.disabled=saving||!count;reset.disabled=saving||!drafts.size;
    }
    const chooseAll=button('Выбрать все без параметров',()=>{
      manualItems(getDocument(),{filter,query}).filter(n=>missingFields(n).length).forEach(n=>selected.add(n.id));redraw();
    },'check');chooseAll.disabled=saving||!matches.some(n=>missingFields(n).length);
    const clear=button('Снять выбор',()=>{selected.clear();redraw();});clear.disabled=saving||!selected.size;
    const table=h('table.im-manual-table',h('thead',h('tr',h('th',{scope:'col'},'Выбор'),h('th',{scope:'col'},'Предмет'),...MANUAL_KEYS.map(k=>h('th',{scope:'col'},FIELDS[k]))))),tbody=h('tbody');
    for(const n of shown){
      const missing=missingFields(n),check=h('input',{type:'checkbox','aria-label':'Выбрать для ручного ввода: '+n.name});check.checked=selected.has(n.id);check.disabled=saving;
      check.onchange=()=>{check.checked?selected.add(n.id):selected.delete(n.id);updateControls();clear.disabled=!selected.size;};
      const row=h('tr',{'data-manual-id':n.id},h('td',check),h('th',{scope:'row',title:n.name},h('strong',n.name),h('small',missing.length?`Не заполнено: ${missing.length} из 4`:'Все параметры заполнены')));
      for(const key of MANUAL_KEYS){
        const draft=drafts.get(n.id),input=h('input',{type:'text',value:draft?.values[key]??manualValue(n,key),'aria-label':`${n.name} · ${FIELDS[key]}`,placeholder:'—',...(key==='weightGrams'||key==='transportLiters'?{inputmode:'decimal'}:{maxlength:200})});
        input.disabled=saving;
        input.oninput=()=>{
          let d=drafts.get(n.id);if(!d){d={base:structuredClone(n),values:{}};drafts.set(n.id,d);}
          if(input.value===manualValue(d.base,key))delete d.values[key];else d.values[key]=input.value;
          if(!Object.keys(d.values).length)drafts.delete(n.id);
          selected.add(n.id);check.checked=true;clear.disabled=false;input.classList.toggle('is-edited',Object.hasOwn(d.values,key));updateControls();
        };
        if(draft&&Object.hasOwn(draft.values,key))input.classList.add('is-edited');
        row.append(h('td',{'data-label':FIELDS[key],class:missing.includes(key)?'is-missing':''},input));
      }
      tbody.append(row);
    }
    table.append(tbody);
    select.onchange=()=>{filter=select.value;pageSize=60;redraw();};
    search.oninput=()=>{query=search.value;pageSize=60;const position=search.selectionStart;redraw();const next=host.querySelector('input[type=search]');next.focus();next.setSelectionRange(position,position);};
    container.replaceChildren(h('div.im-manual-filters',select,search,chooseAll,clear),h('p.im-help','Заполняйте параметры прямо в строках и сохраняйте выбранные изменения. Вес — в граммах, объём — транспортный, в литрах. Оценочный вес мебели считается незаполненным.'),toolbar);
    if(message)container.append(h('p.im-notice',{role:'status'},message));
    if(shown.length)container.append(h('div.im-manual-scroll',table));
    else container.append(h('div.iv-empty',icon('check',24),h('h3','Предметов не найдено'),h('p','Для этого фильтра нет вещей. Измените условие или поисковый запрос.')));
    if(matches.length>shown.length)container.append(button(`Показать ещё · ${shown.length} из ${matches.length}`,()=>{pageSize+=60;redraw();},'next'));
    updateControls();
  }
  return {render,get draftCount(){return drafts.size;}};
}
