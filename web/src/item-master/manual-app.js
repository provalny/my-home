import {h} from '../ui/dom.js';
import {colorPicker} from '../inventory/colors.js';
import {icon} from '../ui/icons.js';
import {eligible} from './model.js';
import {DEFAULT_COLUMNS,manualField,availableManualFields,manualValue,missingFields,manualItems,planManualChanges,applyManualChanges,rebaseManualDraft} from './manual-model.js';

const button=(label,action,glyph,primary=false)=>h('button.iv-btn'+(primary?'.primary':''),{type:'button',onclick:action},glyph?icon(glyph,14):null,label);
const PREF='iv:item-master:manual-columns-v2';
function savedColumns(){try{const value=JSON.parse(localStorage.getItem(PREF));if(Array.isArray(value))return [...new Set(value)].filter(k=>k!=='name'&&manualField(k));}catch{}return [...DEFAULT_COLUMNS];}
export function createManualMaster({getDocument,change,onChange}) {
  let columns=savedColumns(),columnsOpen=false,filter=columns.length?'missing':'all',query='',pageSize=60,saving=false,message='',host=null,customName='';
  const selected=new Set(),drafts=new Map();
  const redraw=()=>{if(host)render(host);};
  const visibleKey=key=>key==='name'||columns.includes(key);
  function visibleValues(draft){return Object.fromEntries(Object.entries(draft.values).filter(([key])=>visibleKey(key)));}
  function dirtyPlans(){return [...drafts].filter(([id])=>selected.has(id)).map(([id,draft])=>({id,fields:planManualChanges(draft.base,visibleValues(draft))})).filter(p=>p.fields.length);}
  function clearSaved(id,keys){const draft=drafts.get(id);if(!draft)return;for(const key of keys)delete draft.values[key];rebaseManualDraft(draft.base,getDocument().nodes.find(n=>n.id===id),keys);if(!Object.keys(draft.values).length){drafts.delete(id);selected.delete(id);}}
  async function save(){
    if(saving)return;saving=true;message='';redraw();
    try{
      const plans=dirtyPlans();
      if(!plans.length){for(const id of selected)clearSaved(id,['name',...columns]);message='Изменений для сохранения нет';}
      else{
        await change(d=>applyManualChanges(d,plans),{action:'Мастер предметов: ручные параметры',retryable:false});
        for(const p of plans)clearSaved(p.id,p.fields.map(f=>f.key));
        message=`Сохранено предметов: ${plans.length}. Изменения можно отменить.`;
      }
    }catch(e){message=e.message;}
    finally{saving=false;redraw();onChange();}
  }
  function setColumns(next){
    columns=[...new Set(next)];if(!columns.length)filter='all';else if(filter==='all')filter='missing';else if(!['missing','empty'].includes(filter)&&!columns.includes(filter))filter='missing';
    pageSize=60;try{localStorage.setItem(PREF,JSON.stringify(columns));}catch{}redraw();
  }
  function render(container){
    host=container;const doc=getDocument(),all=doc.nodes.filter(eligible),matches=manualItems(doc,{filter,query,columns}),shown=matches.slice(0,pageSize);
    for(const id of selected)if(!all.some(n=>n.id===id)){selected.delete(id);drafts.delete(id);}
    const options=[['missing','Есть пропуски в выбранных графах'],['empty','Все выбранные параметры пусты'],['all','Все вещи'],...columns.map(key=>[key,'Не заполнено: '+manualField(key).label])];
    const select=h('select',{'aria-label':'Показывать предметы'},...options.map(([value,label])=>h('option',{value},label)));select.value=filter;select.disabled=saving;
    const search=h('input',{type:'search',value:query,placeholder:'Найти предмет…','aria-label':'Поиск в ручном мастере'});search.disabled=saving;
    const fields=availableManualFields(doc);for(const key of columns)if(!fields.some(f=>f.key===key))fields.push(manualField(key));
    const columnChoices=h('div.im-column-choices');
    for(const f of fields.filter(f=>f.key!=='name')){
      const check=h('input',{type:'checkbox','aria-label':'Показать графу: '+f.label});check.checked=columns.includes(f.key);check.disabled=saving;
      check.onchange=()=>setColumns(check.checked?[...columns,f.key]:columns.filter(k=>k!==f.key));columnChoices.append(h('label',check,f.label));
    }
    const custom=h('input',{type:'text',value:customName,placeholder:'Свой параметр','aria-label':'Название своей графы',maxlength:80});custom.oninput=()=>{customName=custom.value;};
    const add=button('Добавить',()=>{
      const name=customName.trim(),field=fields.find(f=>f.label.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru'))||manualField('attr:'+name);
      if(!field||field.key==='name'){message='Укажите название параметра, например «Материал»';redraw();return;}
      customName='';setColumns([...columns,field.key]);
    },'plus');add.disabled=saving;
    const summary=h('summary',{onclick:e=>{e.preventDefault();columnsOpen=!columnsOpen;picker.open=columnsOpen;}},'Графы · '+columns.length);
    const picker=h('details.im-columns-picker',{onkeydown:e=>{if(e.key==='Escape'){e.stopPropagation();columnsOpen=false;picker.open=false;summary.focus();}}},summary,h('div.im-column-popover',h('p','Название вещи редактируется всегда. Выберите остальные графы:'),columnChoices,h('div.im-add-column',custom,add)));picker.open=columnsOpen;
    const selectionText=h('span.im-manual-count'),saveButton=button('Сохранить изменения',save,'check',true);
    const reset=button('Сбросить черновики',()=>{drafts.clear();selected.clear();message='';redraw();},'close');
    const toolbar=h('div.im-manual-actions',selectionText,saveButton,reset);
    function updateControls(){
      const count=[...drafts].filter(([id,d])=>selected.has(id)&&Object.keys(d.values).some(visibleKey)).length;
      const hidden=[...drafts.values()].filter(d=>Object.keys(d.values).some(k=>!visibleKey(k))).length;
      selectionText.textContent=`Найдено: ${matches.length} · Выбрано: ${selected.size} · Изменено: ${count}`+(hidden?' · Есть изменения в скрытых графах':'');
      saveButton.disabled=saving||!count;reset.disabled=saving||!drafts.size;
    }
    const chooseAll=button('Выбрать все без параметров',()=>{manualItems(getDocument(),{filter,query,columns}).filter(n=>missingFields(n,columns).length).forEach(n=>selected.add(n.id));redraw();},'check');chooseAll.disabled=saving||!matches.some(n=>missingFields(n,columns).length);
    const clear=button('Снять выбор',()=>{selected.clear();redraw();});clear.disabled=saving||!selected.size;
    const table=h('table.im-manual-table',h('thead',h('tr',h('th',{scope:'col'},'Выбор'),h('th',{scope:'col'},'Название'),...columns.map(k=>h('th',{scope:'col'},manualField(k).label))))),tbody=h('tbody');
    if(columns.length>5)table.style.minWidth=(280+columns.length*145)+'px';
    for(const n of shown){
      const missing=missingFields(n,columns),check=h('input',{type:'checkbox','aria-label':'Выбрать для ручного ввода: '+n.name});check.checked=selected.has(n.id);check.disabled=saving;
      check.onchange=()=>{check.checked?selected.add(n.id):selected.delete(n.id);updateControls();clear.disabled=!selected.size;};
      function makeInput(key){
        const f=manualField(key),draft=drafts.get(n.id),input=key==='color'?colorPicker(draft?.values[key]??manualValue(n,key)):h('input',{type:'text',value:draft?.values[key]??manualValue(n,key),'aria-label':`${n.name} · ${f.label}`,placeholder:key==='name'?'Название':'—',...(f.numeric||f.money?{inputmode:'decimal'}:{maxlength:200})});input.disabled=saving;if(key==='color')input.setAttribute('aria-label',`${n.name} · ${f.label}`);
        input.oninput=()=>{
          let d=drafts.get(n.id);if(!d){d={base:structuredClone(n),values:{}};drafts.set(n.id,d);}
          if(input.value===manualValue(d.base,key))delete d.values[key];else d.values[key]=input.value;
          if(!Object.keys(d.values).length)drafts.delete(n.id);
          selected.add(n.id);check.checked=true;clear.disabled=false;input.classList.toggle('is-edited',Object.hasOwn(d.values,key));updateControls();
        };
        if(draft&&Object.hasOwn(draft.values,key))input.classList.add('is-edited');return input;
      }
      const row=h('tr',{'data-manual-id':n.id},h('td',check),h('th',{scope:'row'},makeInput('name'),h('small',missing.length?`Не заполнено: ${missing.length} из ${columns.length}`:'Выбранные параметры заполнены')));
      for(const key of columns)row.append(h('td',{'data-label':manualField(key).label,class:missing.includes(key)?'is-missing':''},makeInput(key)));
      tbody.append(row);
    }
    table.append(tbody);select.onchange=()=>{filter=select.value;pageSize=60;redraw();};
    search.oninput=()=>{query=search.value;pageSize=60;const position=search.selectionStart;redraw();const next=host.querySelector('input[type=search]');next.focus();next.setSelectionRange(position,position);};
    container.replaceChildren(h('div.im-manual-filters',picker,select,search,chooseAll,clear),h('p.im-help','Выберите графы и нужные пропуски. Меняйте название и параметры прямо в строках. Сохраняются выбранные изменения в видимых графах; вес — в граммах, объём для перевозки — в литрах.'),toolbar);
    if(message)container.append(h('p.im-notice',{role:'status'},message));
    if(shown.length)container.append(h('div.im-manual-scroll',table));else container.append(h('div.iv-empty',icon('check',24),h('h3','Предметов не найдено'),h('p','В выбранных графах нет подходящих пропусков. Измените графы или условие показа.')));
    if(matches.length>shown.length)container.append(button(`Показать ещё · ${shown.length} из ${matches.length}`,()=>{pageSize+=60;redraw();},'next'));
    updateControls();
  }
  return {render,get draftCount(){return drafts.size;}};
}
