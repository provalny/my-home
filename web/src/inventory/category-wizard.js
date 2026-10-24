import './category-wizard.css';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { CATEGORY_PACKS, previewCategoryPacks, applyCategoryPacks } from './category-presets.js';

const steps=[['base','Быт','Что вы хотите учитывать дома?'],['work','Работа','Что нужно для работы или учёбы?'],['hobby','Увлечения','Чем вы любите заниматься?'],['preview','Предпросмотр','Проверьте, что будет добавлено']];
const button=(label,onclick,primary=false)=>h('button.iv-btn'+(primary?'.primary':''),{type:'button',onclick},label);
export function openCategoryWizard({getDoc,change,onSaved}) {
  if(document.querySelector('dialog[open]'))return;
  const first=!getDoc().settings.categorySetup;
  const setup=getDoc().settings.categorySetup;
  const chosen=new Set(setup?.packIds||[]),excluded=new Set(setup?.excludedCategories||[]),excludedCollections=new Set(setup?.excludedCollections||[]);
  let step=0,saving=false;
  const dialog=h('dialog.iv-dialog.cw-dialog',{'aria-label':'Настройка категорий'});
  const heading=h('h2',{tabindex:-1}),progress=h('ol.cw-progress',{'aria-label':'Шаги настройки'});
  const selectionCount=h('span.iv-muted',{'aria-live':'polite'});
  const body=h('div.cw-body'),footer=h('div.cw-footer'),error=h('p.iv-form-error',{role:'alert'});
  const close=()=>{dialog.close();dialog.remove();};
  async function dismiss(){
    if(saving)return;
    if(!first){close();return;}
    saving=true;lock();
    try{await change(d=>{d.settings.categorySetup={version:1,status:'skipped',packIds:[]};},{undoable:false,retryable:false});close();}
    catch(e){error.textContent=e.message;saving=false;lock();}
  }
  const cancel=button(first?'Настроить позже':'Отмена',dismiss);
  dialog.append(h('div.iv-dialog-title',h('h2','Категории под вашу жизнь'),cancel),progress,h('div.cw-scroll',heading,body,error),footer);
  function lock(){for(const control of dialog.querySelectorAll('button,input'))control.disabled=saving||control.dataset.existing==='true';}
  function choice(label,checked,onchange,{description,existing=false,depth=0,glyph}={}){
    const checkbox=h('input',{type:'checkbox','aria-label':label,onchange:e=>onchange(e.target.checked)});
    checkbox.checked=checked;checkbox.disabled=existing;checkbox.dataset.existing=String(existing);
    return h('label.cw-choice',{vars:{'--cw-depth':String(depth)}},checkbox,glyph?icon(glyph,21):null,h('span',h('strong',label),description?h('small',description):null),existing?h('small.cw-existing','Уже есть'):null);
  }
  function render(){
    const [group,,caption]=steps[step];heading.textContent=caption;error.textContent='';
    progress.replaceChildren(...steps.map(([,label],i)=>h('li',{'aria-current':i===step?'step':null,class:i===step?'active':i<step?'complete':''},h('span',String(i+1)),label)));
    body.replaceChildren();
    if(step<3){
      body.append(h('p.iv-muted','Выберите несколько наборов или переходите дальше. Категории из разных наборов объединятся без повторов.'),
        h('div.cw-pack-grid',...CATEGORY_PACKS.filter(p=>p.group===group).map(p=>choice(p.name,chosen.has(p.id),checked=>{if(checked)chosen.add(p.id);else chosen.delete(p.id);selectionCount.textContent=`Выбрано наборов: ${chosen.size}`;},{description:p.description,glyph:p.icon}))));
    }else renderPreview();
    selectionCount.textContent=`Выбрано наборов: ${chosen.size}`;
    footer.replaceChildren(selectionCount,h('div.iv-actions',step?button('Назад',()=>{step--;render();}):null,button(step===3?'Применить':'Далее',step===3?save:()=>{step++;render();},true)));
    dialog.querySelector('.cw-scroll').scrollTop=0;
    heading.focus();
  }
  function renderPreview(){
    const preview=previewCategoryPacks(getDoc(),[...chosen]);
    for(const c of preview.categories){if(c.existingId)excluded.delete(c.key);else if(excluded.has(c.parentKey))excluded.add(c.key);}
    const summary=h('p.cw-summary',{'aria-live':'polite'}),tree=h('div.cw-preview-tree');
    function count(){summary.textContent=`Будет добавлено: категорий — ${preview.categories.filter(c=>!c.existingId&&!excluded.has(c.key)).length}, подборок — ${preview.collections.filter(c=>!c.existingId&&!excludedCollections.has(c.key)).length}.`;}
    function drawTree(){
      const sorted=preview.categories.slice().sort((a,b)=>a.path.localeCompare(b.path,'ru'));
      tree.replaceChildren(...sorted.map(c=>choice(c.existingId&&!c.parentKey?c.path:c.name,!excluded.has(c.key)||Boolean(c.existingId),checked=>{
        if(checked){for(let key=c.key;key;key=preview.categories.find(x=>x.key===key)?.parentKey)excluded.delete(key);}
        else for(const child of preview.categories.filter(x=>x.key===c.key||x.key.startsWith(c.key+'.')))if(!child.existingId)excluded.add(child.key);
        drawTree();count();tree.querySelector(`[data-category-key="${c.key}"] input`)?.focus();
      },{existing:Boolean(c.existingId),depth:c.depth})).map((row,i)=>{row.dataset.categoryKey=sorted[i].key;return row;}));
    }
    body.append(h('p.iv-muted','Снимите галочки с лишнего. Существующие категории и вещи сохранятся. Подборки объединяют вещи из разных категорий; состав вы выбираете в карточке вещи.'),summary);
    if(!preview.categories.length)body.append(h('p.cw-empty','Наборы не выбраны. Можно вернуться и выбрать их или завершить настройку с текущими категориями.'));
    else body.append(h('h3','Категории и подкатегории'),tree);
    if(preview.collections.length)body.append(h('h3','Подборки по занятиям'),h('div.cw-collections',...preview.collections.map(c=>choice(c.name,!excludedCollections.has(c.key)||Boolean(c.existingId),checked=>{if(checked)excludedCollections.delete(c.key);else excludedCollections.add(c.key);count();},{existing:Boolean(c.existingId)}))));
    drawTree();count();
  }
  async function save(){
    if(saving)return;saving=true;lock();error.textContent='';let result;
    try{
      await change(d=>{result=applyCategoryPacks(d,[...chosen],{excludedCategories:[...excluded],excludedCollections:[...excludedCollections]});},{retryable:false,action:'Настройка категорий и подборок'});
      close();onSaved?.(result);
    }catch(e){error.textContent=e.message;saving=false;lock();error.scrollIntoView({block:'nearest'});}
  }
  dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});
  dialog.addEventListener('close',()=>dialog.remove());
  document.body.append(dialog);dialog.showModal();render();return dialog;
}

/** Reused in item forms; several independent collections can share an item. */
export function collectionPicker(doc,initial=[]) {
  const chosen=new Set(initial),root=h('fieldset.cw-item-collections',h('legend','Подборки'));
  root.append(h('p.iv-muted','Можно выбрать несколько занятий.'),h('div.cw-collection-options',...(doc.collections||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'ru')).map(c=>{
    const checkbox=h('input',{type:'checkbox','data-collection-id':c.id,'aria-label':'Подборка: '+c.name,onchange:()=>{if(checkbox.checked)chosen.add(c.id);else chosen.delete(c.id);}});checkbox.checked=chosen.has(c.id);
    return h('label',checkbox,c.name);
  })));
  root.hidden=!(doc.collections||[]).length;
  Object.defineProperty(root,'value',{get:()=>(doc.collections||[]).filter(c=>chosen.has(c.id)).map(c=>c.id),set:ids=>{chosen.clear();for(const id of ids||[])chosen.add(id);root.querySelectorAll('input').forEach(el=>{el.checked=chosen.has(el.dataset.collectionId);});}});
  return root;
}
