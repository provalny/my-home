import './inventory.css';
import './workspace.css';
import { openItemForm, createLocationPicker } from './forms.js';
import { h, openMenu } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { call, post, incoming, isNative } from '../bridge.js';
import { normalize } from '../config.js';
import { createWorld } from '../three/world.js';
import * as M from './model.js';
import releases from './releases.json';
import { categoryAppearance, nodeAppearance, rememberCategoryIcons } from './appearance.js';
import { nodeThumbnail } from './visuals.js';
import { calculateAwards, syncAwards } from './awards.js';

const LOCAL_KEY = 'my-home-inventory:v1';
const APP_VERSION = releases[0].version;
const plural=(value,forms)=>`${value} ${forms[value%100>=11&&value%100<=14?2:value%10===1?0:value%10>=2&&value%10<=4?1:2]}`;
const eventNames = { addition:'Добавлено в учёт', undo:'Отмена действия', purchase:'Покупка', move:'Перемещение', archive:'Архивирование', value:'Изменение стоимости', restore:'Возвращение из архива', delete:'Удаление в корзину', recover:'Восстановление из корзины' };

const button = (label, action, glyph, cls = '') => h(`button.iv-btn${cls ? '.'+cls : ''}`, { type:'button', onclick:action }, glyph ? icon(glyph,16) : null, label);
const empty = text => h('div.iv-empty',icon('box',30),h('p',text));
function select(options, value, props={}) {
  const el = h('select',props,...options.map(([v,label]) => h('option',{value:v},label)));
  el.value = value ?? ''; return el;
}
const field = (label,input) => h('label.iv-field',h('span',label),input);
const input = (value='',props={}) => h('input',{value:value ?? '',...props});
const displayDate = value => value ? new Date(value.length === 10 ? value+'T12:00:00' : value).toLocaleDateString('ru-RU') : '—';

export async function bootInventory(root) {
  let doc = window.__HOUSE_BOOT__?.inventory;
  if (!doc && !isNative) { const raw = localStorage.getItem(LOCAL_KEY); if (raw) doc = JSON.parse(raw); }
  if (!doc) { const response = await fetch('./plans/home.json'); if (!response.ok) throw Error('Не найден демонстрационный план'); doc = M.demo(await response.json()); }
  const originalDocument=structuredClone(doc);M.migrate(doc);M.validate(doc);normalize(doc.plan);let migrationPending=JSON.stringify(originalDocument)!==JSON.stringify(doc);
  let view = 'overview', query = '', place = null, category = '', condition = '', sort = 'name', roomFilter = '', selected = new Set();
  let busy = false, world = null, resize = null, editor = null, lastCategory = '', nativeSettings = window.__HOUSE_BOOT__?.inventorySettings || {};
  let detailId=null, spaceMode=localStorage.getItem('iv:space-mode')||'3d', catalogMode=localStorage.getItem('iv:catalog-mode')||'table';
  lastCategory=localStorage.getItem('iv:last-category')||'';
  const sectionState=new Map(), undoStack=[], redoStack=[]; let failedAction=null, sceneMemory=null, renderedPlace=null;
  const awardsAtBoot=syncAwards(doc,nativeSettings);let awardsRefreshPending=false;
  const nodeIcon=n=>nodeAppearance(doc,n).glyph;
  const detailsPane=h('aside.iv-detail-panel',{'aria-label':'Карточка вещи',hidden:true});
  const alertBar=h('div.iv-alert',{role:'alert',hidden:true});
  const undoButton=button('Отменить',()=>undo(), 'undo');undoButton.disabled=true;undoButton.title='Отменить последнее действие · ⌘Z';
  const status = h('span.iv-save','Все изменения сохранены');
  const toast = h('div.iv-toast',{role:'status','aria-live':'polite'});
  const searchInput = input('',{type:'search',placeholder:'Поиск вещей и мест · ⌘K','aria-label':'Поиск вещей и мест',oninput:() => {if(view!=='catalog')rememberSection();query=searchInput.value;view='catalog';place=null;category='';condition='';roomFilter='';selected.clear();detailId=null;draw();}});
  const nav = h('nav.iv-nav',{'aria-label':'Разделы приложения'});
  const content = h('main.iv-content');
  const menuHost=h('div.iv-menu-host');document.body.append(menuHost);
  let closeActionMenu=null;
  root.replaceChildren(h('div.iv-shell',h('aside.iv-sidebar',
    h('div.iv-brand',icon('home',27),h('div',h('strong','Мой дом'),h('small','Пространство для ваших вещей'))),nav,
    h('div.iv-sidebar-bottom',h('span.iv-dot'), 'Хранится на этом Mac',button(`Версия ${APP_VERSION}`,()=>go('changelog'),null,'iv-version'))),
    h('section.iv-workspace',h('header.iv-topbar',h('div.iv-search',icon('list',17),searchInput),status,undoButton,button('Добавить вещь',()=>editNode(null),'plus','primary')),alertBar,h('div.iv-body',content,detailsPane))),toast);

  function say(text,error=false) {
    toast.replaceChildren(h('span',text));toast.className=`iv-toast show${error?' error':''}`;
    if(!error&&undoStack.length)toast.append(button('Отменить',()=>undo(),'undo'));
    if(error){const body=document.querySelector('dialog[open] .iv-dialog-body');if(body){let local=body.querySelector('.iv-local-error');if(!local){local=h('p.iv-form-error.iv-local-error',{role:'alert'});body.prepend(local);}local.textContent=text;}}
    clearTimeout(say.timer);say.timer=setTimeout(()=>toast.className='iv-toast',error?10000:5500);
  }
  async function persist(next, restore=false) {
    if (isNative) await call('saveInventory',{document:next,expectedRevision:doc.revision || 0,restore:restore||migrationPending});
    else {if(migrationPending)localStorage.setItem(LOCAL_KEY+':before-migration',JSON.stringify(originalDocument));localStorage.setItem(LOCAL_KEY,JSON.stringify(next));}migrationPending=false;
  }
  async function change(mutator,{restore=false,undoable=true,retryable=true}={}) {
    if (busy) throw Error('Дождитесь сохранения предыдущего изменения');
    busy=true; status.textContent='Сохранение…';
    try {
      const next=structuredClone(doc); mutator(next); next.revision=(doc.revision || 0)+1;
      rememberCategoryIcons(next);syncAwards(next,nativeSettings,{now:new Date().toISOString(),previous:restore?null:doc});
      M.validate(next); normalize(next.plan); await persist(next,restore);
      if(place&&!M.getNode(next,place)){let parent=M.getNode(doc,place);while(parent&&!M.getNode(next,parent.id))parent=M.getNode(doc,parent.parentId);place=parent?.id||null;}
      if(undoable){undoStack.push(structuredClone(doc));if(undoStack.length>20)undoStack.shift();redoStack.length=0;}
      doc=next;failedAction=null;alertBar.hidden=true;undoButton.disabled=!undoStack.length;
      status.textContent='Все изменения сохранены'; selected.clear(); draw(true);
    } catch(e) { status.textContent='Изменение не сохранено'; failedAction=retryable&&!document.querySelector('dialog[open]')?()=>change(mutator,{restore,undoable,retryable}).catch(()=>{}):null;alertBar.hidden=false;alertBar.replaceChildren(...[h('span',e.message),failedAction?button('Повторить',()=>failedAction?.(),'rotate'):h('span','Повторите сохранение в открытой форме')].filter(Boolean));say(e.message,true); throw e; }
    finally { busy=false;if(awardsRefreshPending){awardsRefreshPending=false;queueMicrotask(refreshAwards);} }
  }
  const run = (fn,opts) => change(fn,opts).catch(()=>{});
  async function undo(redo=false){
    const source=redo?redoStack:undoStack,target=redo?undoStack:redoStack;
    if(!source.length||busy)return;
    const snapshot=source[source.length-1],current=structuredClone(doc);
    try{await change(d=>{const revision=d.revision;Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,structuredClone(snapshot),{revision});M.record(d,'undo',{id:'application',name:redo?'Повтор действия':'Последнее действие'});},{undoable:false,retryable:false});source.pop();target.push(current);undoButton.disabled=!undoStack.length;say(redo?'Действие повторено':'Действие отменено');}catch{}
  }
  const currentPlace = () => M.getNode(doc,place) || M.getNode(doc,M.UNPLACED_ID) || doc.nodes.find(n=>n.kind==='room');
  function rememberSection(){sectionState.set(view,{place,query,category,condition,roomFilter,sort,detailId,scroll:content.scrollTop});}
  function go(page){rememberSection();view=page;const saved=sectionState.get(page);({place=null,query='',category='',condition='',roomFilter='',sort='name',detailId=null}=saved||{});if(page==='unplaced')place=M.UNPLACED_ID;searchInput.value=query;selected.clear();draw();content.scrollTop=saved?.scroll||0;}
  const open = n => {if(!n)return;if(n.kind==='item'){details(n);return;}rememberSection();place=n.id;view=n.id===M.UNPLACED_ID?'unplaced':'space';query='';searchInput.value='';detailId=null;draw();};
  function drawNav() {
    nav.replaceChildren(...[['overview','Обзор','home'],['space','Квартира','map'],['catalog','Все вещи','box'],['categories','Категории','list'],['unplaced','Без места','folder'],['archive','Архив','folder'],['trash','Корзина','trash'],['history','История','clock'],['awards','Награды','trophy'],['changelog','История изменений','list'],['settings','Настройки','settings']].map(([key,label,glyph])=>button(label,()=>go(key),glyph,view===key?'active':'')),h('div.iv-nav-caption','В дальнейшем'),...[['Мониторинг квартиры','homeassistant'],['Автомобиль','car'],['Личные метрики','activity']].map(([label,glyph])=>button(label,()=>say('«'+label+'» появится в следующих версиях'),glyph,'future')));
  }
  function clearWorld() { if(world)sceneMemory={...world.cameraSnapshot?.(),place:renderedPlace};resize?.disconnect();resize=null;world?.dispose();world=null; }
  function draw(preserveScroll=false) {
    const scroll=content.scrollTop;
    closeActionMenu?.();closeActionMenu=null;clearWorld(); drawNav();
    if(view==='overview')drawOverview();
    else if(view==='space'||view==='unplaced')drawHome();
    else if(view==='catalog' || view==='archive') drawCatalog();
    else if(view==='categories')drawCategories();
    else if(view==='trash') drawTrash();
    else if(view==='history') drawHistory();
    else if(view==='awards') drawAwards();
    else if(view==='changelog') drawChangelog();
    else drawSettings();
    drawDetails();if(preserveScroll)content.scrollTop=scroll;
  }
  function drawAwards(){
    let awards;
    try{awards=calculateAwards(doc,nativeSettings);}catch{content.replaceChildren(title('Награды','Достижения за порядок в доме'),empty('Пока не удалось пересчитать награды. Каталог и сохранение доступны.'));return;}
    const earned=awards.filter(a=>a.earned).length;
    const filter=select([['all','Все награды'],['earned','Полученные'],['locked','В процессе']],'',{'aria-label':'Показать награды'}),grid=h('div.iv-awards-grid');
    filter.value='all';
    function paint(){const list=awards.filter(a=>filter.value==='all'||(filter.value==='earned'?a.earned:!a.earned));grid.replaceChildren(...list.map(a=>h(`article.iv-award${a.earned?'.earned':''}`,
      h('div.iv-award-symbol',icon(a.glyph,24)),h('div.iv-award-copy',h('h2',a.name),h('p',a.description)),
      h('div.iv-award-state',a.earned?icon('check',14):null,a.earned?'Получена'+(a.earnedAt?' · '+displayDate(a.earnedAt):''):`${a.value} / ${a.target}`),
      h('progress',{max:a.target,value:a.earned?a.target:a.value,'aria-label':`${a.name}: ${a.earned?'получена':a.value+' из '+a.target}`}))));if(!list.length)grid.append(empty('Здесь пока нет наград'));}
    filter.onchange=paint;
    content.replaceChildren(title('Награды',`Получено ${earned} из ${awards.length} · ваши достижения за порядок в доме`),
      h('p.iv-muted','Прогресс пересчитывается по данным квартиры. Полученные награды сохраняются после обновлений и входят в резервные копии. Демо-вещи не учитываются.'),filter,grid);paint();
  }
  function refreshAwards(){if(busy){awardsRefreshPending=true;return;}const changed=syncAwards(structuredClone(doc),nativeSettings);if(changed)change(()=>{},{undoable:false,retryable:false}).catch(()=>{});else if(view==='awards')draw(true);}
  function drawChangelog() {
    content.replaceChildren(title('История изменений',`Что нового в приложении · текущая версия ${APP_VERSION}`),
      h('div.iv-releases',...releases.map((release,index)=>h('article.iv-card.iv-release',
        h('div.iv-release-heading',h('h2',`Версия ${release.version}`),index===0?h('span.iv-release-current','Текущая'):null,
          h('time',{datetime:release.date},displayDate(release.date))),
        h('h3',release.title),h('ul',...release.changes.map(text=>h('li',text)))))));
  }
  function title(name,sub,actions=[]) { return h('div.iv-heading',h('div',h('h1',name),h('p',sub)),h('div.iv-actions',...actions)); }
  function metric(label,value,glyph,sub) { return h('div.iv-metric',icon(glyph,22),h('div',h('small',label),h('strong',value),sub?h('span',sub):null)); }
  function fillPercent(n){return n?n.fill:M.apartmentFill(doc).value;}
  function fillMeter(n,mini=false){const value=fillPercent(n);return h(`div.iv-fill${mini?'.iv-fill-mini':''}`,h('span',`Заполненность: ${value==null?'не указана':value+'%'}`),h('progress',{max:100,value:value??0,'aria-label':`Заполненность ${n?.name||'квартиры'}: ${value==null?'не указана':value+'%'}`,class:value==null?'is-unknown':''}));}
  function fillControl(n){const value=fillPercent(n),summary=!n?M.apartmentFill(doc):null;return h('div.iv-fill',h('div.iv-fill-label',h('span',`Заполненность ${value==null?'не указана':value+'%'}`),n?button(value==null?'Задать':'Изменить',()=>editFill(n),'sliders'):null),h('progress',{max:100,value:value??0,'aria-label':`Заполненность ${n?.name||'квартиры'}`,class:value==null?'is-unknown':''}),summary?h('small.iv-muted',`Среднее по комнатам · учтено ${summary.known} из ${summary.total}`):null);}
  function editFill(n){modal('Заполненность — '+(n?.name||'вся квартира'),(body,close)=>{const amount=input(fillPercent(n),{type:'number',min:0,max:100,step:1,'aria-label':'Заполненность, %'});body.append(h('p.iv-muted','Оцените физическую заполненность вручную, от 0 до 100%. Это не доля вещей, внесённых в каталог.'),field('Заполненность, %',amount),button('Сохранить',async()=>{const value=amount.value===''?null:Number(amount.value);if(value!=null&&(!Number.isFinite(value)||value<0||value>100))return say('Укажите процент от 0 до 100',true);try{await change(d=>{if(n)M.getNode(d,n.id).fill=value;else d.settings.apartmentFill=value;});close();}catch{}},'check','primary'));});}
  function stats(){const t=M.totals(doc);return h('div.iv-metrics',metric('Стоимость покупки',M.money(t.purchase),'box'),metric('Текущая оценка',M.money(t.current),'activity'),metric('Вещи',t.items,'box'),metric('Места хранения',t.storage,'folder'));}
  function countText(nodeId){const t=M.totals(doc,nodeId);return `${plural(t.items,['вещь','вещи','вещей'])} · ${plural(t.storage,['место хранения','места хранения','мест хранения'])}`;}
  function drawOverview(){
    const recent=doc.nodes.filter(n=>n.kind!=='room'&&!n.archived).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,4);
    const rooms=doc.nodes.filter(n=>n.kind==='room'&&!n.virtual);
    const recentCard=h('section.iv-card',h('h2','Недавние вещи'),...(recent.length?recent.map(n=>h('div.iv-recent',nodeThumb(n),button(n.name,()=>details(n)),h('small.iv-muted',M.address(doc,n)))):[empty('Добавьте первую вещь')]),button('Все вещи',()=>{go('catalog');sort='date';draw();},'next'));
    content.replaceChildren(title('Обзор','Имущество, важные даты и последние вещи',[button('Настроить свою квартиру',setupHome,'home')]),stats(),
      h('div.iv-overview-grid',attention(),recentCard),
      h('section.iv-card.iv-overview-fill',h('h2','Вся квартира'),fillControl(null),h('div.iv-room-summary',...rooms.map(n=>h('div',button(n.name,()=>open(n),'home'),h('small.iv-muted',countText(n.id)),fillControl(n))))),
      h('div.iv-overview-grid',categorySummary(),monthSummary()));
  }
  function attention(){const due=M.dueItems(doc),loose=M.children(doc,M.UNPLACED_ID);return h('section.iv-card',h('h2','Требует внимания'),...(due.length?due.slice(0,8).map(x=>button(`${x.node.name} · ${x.key==='expiry'?'Срок годности':'Гарантия'} · ${x.days<0?'истёк':x.days===0?'сегодня':`через ${x.days} дн.`}`,()=>details(x.node),'clock')):[]),loose.length?button(`Без места · ${plural(M.totals(doc,M.UNPLACED_ID).items,['вещь','вещи','вещей'])}`,()=>go('unplaced'),'folder'):null,!due.length&&!loose.length?h('p.iv-muted','Ближайших сроков и вещей без места нет'):null,h('small.iv-muted',`Предупреждение за ${doc.settings.reminderDays} дн.`));}
  function breadcrumbs(n){const chain=[];for(let a=n;a;a=M.getNode(doc,a.parentId))chain.unshift(a);return h('nav.iv-breadcrumbs',{'aria-label':'Адрес хранения'},button('Квартира',()=>{place=null;view='space';draw();},'home'),...chain.flatMap(a=>[h('span','›'),button(a.name,()=>a.kind==='item'?details(a):open(a))]));}
  function storageTree(){const tree=h('section.iv-tree',{'aria-label':'Дерево мест хранения'}),needle=input('',{type:'search',placeholder:'Найти место…','aria-label':'Поиск в дереве'}),branches=h('div.iv-tree-branches');
    const expanded=new Set(JSON.parse(localStorage.getItem('iv:tree-expanded')||'[]'));for(let a=M.getNode(doc,place);a;a=M.getNode(doc,a.parentId))expanded.add(a.id);
    function paint(){const q=needle.value.trim().toLocaleLowerCase('ru');function branch(n,depth=0){const nested=M.children(doc,n.id).filter(x=>x.kind!=='item');const match=!q||M.address(doc,n).toLocaleLowerCase('ru').includes(q)||M.descendants(doc,n.id).some(x=>x.kind!=='item'&&x.name.toLocaleLowerCase('ru').includes(q));if(!match)return null;const group=h('div.iv-tree-branch');const toggle=button(nested.length?(expanded.has(n.id)||q?'−':'+'):'·',()=>{expanded.has(n.id)?expanded.delete(n.id):expanded.add(n.id);localStorage.setItem('iv:tree-expanded',JSON.stringify([...expanded]));paint();});toggle.setAttribute('aria-label','Развернуть: '+n.name);if(!nested.length)toggle.disabled=true;const row=h('div.iv-tree-row',{style:{paddingLeft:depth*12+'px'}},toggle,button(n.name,()=>open(n),nodeIcon(n),place===n.id?'active':''));dropTarget(row,n.id);group.append(row);if(expanded.has(n.id)||q)group.append(...nested.map(x=>branch(x,depth+1)).filter(Boolean));return group;}branches.replaceChildren(...doc.nodes.filter(n=>n.kind==='room').map(n=>branch(n)).filter(Boolean));}
    needle.oninput=paint;tree.append(h('h2','Места хранения'),needle,branches);paint();return tree;
  }
  function drawHome(){
    const unplaced=view==='unplaced';if(unplaced)place=M.UNPLACED_ID;
    const rooms=h('div.iv-room-tabs',button('Вся квартира',()=>{place=null;view='space';sceneMemory=null;draw();},'home',!place?'active':''),...doc.nodes.filter(n=>n.kind==='room'&&!n.virtual).map(n=>button(n.name,()=>{place=n.id;sceneMemory=null;draw();},null,place===n.id?'active':'')));
    const modes=h('div.iv-actions',...(!unplaced?[button('3D + содержимое',()=>{spaceMode='3d';localStorage.setItem('iv:space-mode',spaceMode);draw();},'map',spaceMode==='3d'?'active':''),button('Дерево + содержимое',()=>{spaceMode='tree';localStorage.setItem('iv:space-mode',spaceMode);draw();},'list',spaceMode==='tree'?'active':'')]:[]),button('Редактор',()=>openEditor(),'sliders'));
    const pane=h('section.iv-storage');fillStorage(pane);
    content.replaceChildren(title(unplaced?'Без места':'Моя квартира',unplaced?'Распределите вещи по комнатам и местам хранения':'План квартиры и содержимое мест хранения',[]),modes,rooms);
    if(spaceMode==='tree'||unplaced){content.append(h('div.iv-home-grid.iv-tree-mode',storageTree(),pane));return;}
    const canvas=h('canvas',{'aria-label':'Интерактивная 3D-планировка квартиры'}),hover=h('span.iv-scene-hover');
    const scene=h('section.iv-scene',h('div.iv-scene-title',h('span',doc.plan.name),hover),canvas,h('div.iv-scene-hint','Перетащите для вращения · колесо для масштаба · нажмите на мебель'));
    content.append(h('div.iv-home-grid',scene,pane));const cfg=normalize(structuredClone(doc.plan));cfg.inventoryPicking=true;cfg.furniture=cfg.furniture.filter(f=>!doc.nodes.find(n=>n.furnitureId===f.id)?.archived);
    const state={lights:{},acs:{}};for(const l of cfg.lights)state.lights[l.id]={on:true,brightness:.72,temp:3200,color:l.color||null};for(const a of cfg.acs)state.acs[a.id]={on:false,mode:'cool',fan:'auto',swing:'off',sleep:false,target:23};
    try{world=createWorld(canvas,cfg,{state,on:()=>()=>{}},{onHover:t=>{const n=t?.kind==='furniture'?doc.nodes.find(n=>n.furnitureId===t.id):null;hover.textContent=n?.name||'';},onPick:t=>{const n=t?.kind==='room'?doc.nodes.find(n=>n.roomId===t.id):t?.kind==='furniture'?doc.nodes.find(n=>n.furnitureId===t.id):null;if(n){place=n.id;fillStorage(pane);rooms.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.textContent===n.name));world.focus({kind:'room',id:(n.kind==='room'?n:roomOf(n))?.roomId});}}});
      world.setInsets(36,20);world.setRunning(!document.hidden);if(sceneMemory?.place===place)world.restoreCamera?.(sceneMemory);else{const room=roomOf(M.getNode(doc,place));if(room?.roomId)world.focus({kind:'room',id:room.roomId});}renderedPlace=place;resize=new ResizeObserver(()=>world?.resize());resize.observe(canvas);
    }catch(e){scene.append(h('div.iv-3d-error','3D недоступно. Все вещи доступны в списке справа.'));}
  }
  function roomOf(n){let a=n;while(a&&a.kind!=='room')a=M.getNode(doc,a.parentId);return a;}
  function dropTarget(el,destination) {
    el.ondragover=e=>{if(e.dataTransfer.types.includes('application/x-inventory-node')){e.preventDefault();el.classList.add('iv-drop');}};
    el.ondragleave=()=>el.classList.remove('iv-drop');
    el.ondrop=e=>{e.preventDefault();e.stopPropagation();el.classList.remove('iv-drop');const nodeId=e.dataTransfer.getData('application/x-inventory-node');if(!nodeId)return;
      const n=M.getNode(doc,nodeId); if(!n || nodeId===destination)return;
      if(n.kind!=='item' && M.children(doc,nodeId).length && !confirm(`Переместить «${n.name}» вместе со всем содержимым?`))return;
      run(d=>M.move(d,nodeId,destination));
    };return el;
  }
  function draggable(el,n){if(n.kind==='room'||n.archived)return el;el.draggable=true;el.addEventListener('dragstart',e=>{e.stopPropagation();e.dataTransfer.setData('application/x-inventory-node',n.id);e.dataTransfer.effectAllowed='move';});return el;}
  function fillStorage(pane){
    const n=M.getNode(doc,place),nodes=n?M.children(doc,n.id):doc.nodes.filter(x=>x.kind==='room'),totals=M.totals(doc,n?.id);
    const head=n?h('div',breadcrumbs(n),h('h2',n.name)):h('div',h('h2','Комнаты и хранение'));
    pane.replaceChildren(...[head,h('div.iv-storage-total',h('strong',M.money(totals.purchase)),h('small',n&&n.kind!=='room'?`Объект ${M.money(n.purchaseCents)} · содержимое ${M.money(totals.purchase-(n.purchaseCents||0))}`:countText(n?.id))),!n||!n.virtual?fillControl(n):null,
      h('div.iv-actions',n?button('Добавить вещь',()=>editNode(null,{parentId:n.id}),'plus'):null,n&&!n.virtual?button('Отсек',()=>editNode(null,{parentId:n.id,kind:'shelf'}),'folder'):null,n&&n.kind!=='room'?button('Карточка',()=>details(n),'next'):null,n&&n.kind!=='room'?actionsButton(n):null)].filter(Boolean));
    const list=h('div.iv-storage-list');for(const child of nodes){const main=button('',()=>open(child));main.className='iv-storage-open';main.replaceChildren(nodeThumb(child),h('span.iv-row-copy',h('strong',child.name),h('small',child.kind==='item'?M.categoryName(doc,child.categoryId)||'Вещь':countText(child.id))),h('span.iv-row-price',M.money(M.totals(doc,child.id).purchase)));const row=draggable(h('div.iv-storage-row',main),child);row.oncontextmenu=e=>{if(child.kind!=='room'){e.preventDefault();showActions(child,row);}};
      if(child.kind!=='item')dropTarget(row,child.id);
      if(!['item','room'].includes(child.kind)){const reorder=button('↕',e=>{e.stopPropagation();const siblings=nodes.filter(x=>!['item','room'].includes(x.kind));const index=siblings.findIndex(x=>x.id===child.id);if(index>0)run(d=>M.reorder(d,child.id,siblings[index-1].id));},null);reorder.title='Перетащите для порядка; нажмите, чтобы поднять выше';reorder.setAttribute('aria-label','Поднять выше: '+child.name);reorder.draggable=true;reorder.ondragstart=e=>{e.stopPropagation();e.dataTransfer.setData('application/x-inventory-order',child.id);};row.append(reorder);row.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('application/x-inventory-order'))e.preventDefault();});row.addEventListener('drop',e=>{const id=e.dataTransfer.getData('application/x-inventory-order');if(id){e.preventDefault();e.stopPropagation();run(d=>M.reorder(d,id,child.id));}});}
      if(child.kind!=='room')row.append(actionsButton(child));if(child.kind!=='item'&&!child.virtual){row.classList.add('iv-storage-has-fill');row.append(fillMeter(child,true));}list.append(row);}
    if(!nodes.length)list.append(empty('Здесь пока пусто. Добавьте вещь или переместите её сюда.'));pane.append(list);if(n)dropTarget(pane,n.id);
  }
  function nodeThumb(n){return nodeThumbnail(doc,n);}
  function actionsButton(n){const el=button('',e=>{e.stopPropagation();showActions(n,el);},'more','iv-more');el.setAttribute('aria-label',`Действия: ${n.name}`);el.title='Действия';return el;}
  function showActions(n,anchor){
    closeActionMenu?.();
    const items=[{label:'Открыть карточку',icon:icon('next',15),action:()=>details(n)}];
    if(n.archived)items.push({label:'Вернуть из архива',icon:icon('undo',15),action:()=>restoreDialog(n)});
    else items.push({label:'Редактировать',icon:icon('sliders',15),action:()=>editNode(n)},{label:'Переместить',icon:icon('folder',15),action:()=>moveDialog([n.id])},{label:'В архив',icon:icon('folder',15),action:()=>archiveDialog(n)});
    if(n.kind==='furniture'&&!n.archived)items.push({label:n.furnitureId?'Убрать с плана':'Разместить на плане',icon:icon('map',15),action:()=>n.furnitureId?detachFromPlan(n):openEditor(n.id)});
    items.push('-',{label:'Удалить в корзину',icon:icon('trash',15),action:()=>deleteDialog(n)});
    closeActionMenu=openMenu(menuHost,anchor,items);
  }
  function categorySummary(){const roots=doc.categories.filter(c=>!c.parentId).sort((a,b)=>a.name.localeCompare(b.name,'ru'));return h('section.iv-card',h('h2','По категориям'),...roots.map(c=>{const label=M.categoryName(doc,c.id);const count=doc.nodes.filter(n=>!n.archived&&n.kind!=='room'&&(M.categoryName(doc,n.categoryId)===label||M.categoryName(doc,n.categoryId).startsWith(label+' / '))).length;return count?button(`${c.name} · ${count}`,()=>{go('catalog');category=c.id;draw();},categoryAppearance(doc,c.id).glyph):null;}));}
  function reminders(){const due=M.dueItems(doc);return h('section.iv-card',h('h2','Важные даты'),...(due.length?due.slice(0,8).map(x=>button(`${x.node.name} · ${x.key==='expiry'?'Срок годности':'Гарантия'} · ${x.days<0?'истёк':x.days===0?'сегодня':`через ${x.days} дн.`}`,()=>details(x.node),'clock')):[h('p.iv-muted','Ближайших сроков нет')]),h('small.iv-muted',`Предупреждение за ${doc.settings.reminderDays} дн.`));}
  function monthSummary(){const months=new Map();for(const e of doc.events){if(!['purchase','archive'].includes(e.type))continue;const m=(e.effectiveDate||e.date).slice(0,7);if(!months.has(m))months.set(m,{purchase:0,sale:0,writeoff:0});const v=months.get(m);if(e.type==='purchase')v.purchase+=e.purchaseCents||0;else if(e.reason==='Продано')v.sale+=e.saleCents||0;else v.writeoff+=e.purchaseCents||0;}return h('section.iv-card',h('h2','Покупки, продажи, списания'),...([...months.keys()].sort().reverse().slice(0,6).map(m=>{const v=months.get(m);return h('div.iv-month',h('strong',m),h('span',`Покупки ${M.money(v.purchase)}`),h('span',`Продажи ${M.money(v.sale)}`),h('span',`Списания ${M.money(v.writeoff)}`));})),h('small.iv-muted','История накапливается с начала использования.'))}
  function categoryOptions(){return [['','Без категории'],...doc.categories.map(c=>[c.id,M.categoryName(doc,c.id)]).sort((a,b)=>a[1].localeCompare(b[1],'ru'))];}
  function drawCatalog(){
    const archived=view==='archive';let nodes=M.search(doc,query,archived);
    if(category){const target=M.categoryName(doc,category);nodes=nodes.filter(n=>M.categoryName(doc,n.categoryId)===target||M.categoryName(doc,n.categoryId).startsWith(target+' / '));}if(condition)nodes=nodes.filter(n=>n.condition===condition);if(roomFilter){const ids=new Set([roomFilter,...M.descendants(doc,roomFilter).map(n=>n.id)]);nodes=nodes.filter(n=>ids.has(n.id));}
    nodes.sort((a,b)=>sort==='price'?(b.purchaseCents||0)-(a.purchaseCents||0):sort==='date'?(b.createdAt||'').localeCompare(a.createdAt||''):a.name.localeCompare(b.name,'ru'));
    const filters=h('div.iv-filters',select([['','Все категории'],...categoryOptions().slice(1)],category,{'aria-label':'Фильтр по категории',onchange:e=>{category=e.target.value;draw();}}),select([['','Все комнаты'],...doc.nodes.filter(n=>n.kind==='room').map(n=>[n.id,n.name])],roomFilter,{'aria-label':'Фильтр по комнате',onchange:e=>{roomFilter=e.target.value;draw();}}),select([['','Любое состояние'],...M.CONDITIONS.map(c=>[c,c])],condition,{'aria-label':'Фильтр по состоянию',onchange:e=>{condition=e.target.value;draw();}}),select([['name','По названию'],['price','По стоимости'],['date','По дате добавления']],sort,{'aria-label':'Сортировка',onchange:e=>{sort=e.target.value;draw();}}));
    const chips=h('div.iv-filter-chips');for(const [label,value,reset] of [['Категория',category,()=>category=''],['Комната',roomFilter,()=>roomFilter=''],['Состояние',condition,()=>condition='']])if(value)chips.append(button(label+': '+(label==='Категория'?M.categoryName(doc,value):M.getNode(doc,value)?.name||value)+' ×',()=>{reset();draw();}));if(category||roomFilter||condition)chips.append(button('Сбросить фильтры',()=>{category='';roomFilter='';condition='';draw();},'rotate'));
    const modes=h('div.iv-actions',...['table','grid'].map(mode=>button(mode==='table'?'Таблица':'Фото',()=>{catalogMode=mode;localStorage.setItem('iv:catalog-mode',mode);draw(true);},mode==='table'?'list':'box',catalogMode===mode?'active':'')),button('Категории',()=>go('categories'),'list'));
    content.replaceChildren(title(archived?'Архив':'Все вещи',`${plural(nodes.length,['запись','записи','записей'])}${query?' · «'+query+'»':''}`,[]),modes,filters,chips);
    if(selected.size&&!archived)content.append(h('div.iv-bulk',h('span',`Выбрано: ${selected.size}`),button('Переместить',()=>moveDialog([...selected]),'folder'),button('Снять выделение',()=>{selected.clear();draw(true);},'close')));
    const list=h(catalogMode==='grid'?'div.iv-photo-grid':'div.iv-table');if(catalogMode==='table')list.append(h('div.iv-table-head',h('span'),h('span','Вещь'),h('span',archived?'Выбытие':'Место хранения'),h('span','Цена объекта'),h('span','Действия')));
    for(const n of nodes){const checkbox=h('input',{type:'checkbox','aria-label':`Выбрать ${n.name}`,onchange:e=>{e.target.checked?selected.add(n.id):selected.delete(n.id);draw(true);}});checkbox.checked=selected.has(n.id);const item=h('button.iv-item-name',{onclick:()=>details(n)},nodeThumb(n),h('span',h('strong',n.name),h('small',M.categoryName(doc,n.categoryId)||M.KINDS[n.kind])));const row=draggable(h(catalogMode==='grid'?'article.iv-photo-card':'div.iv-table-row',archived&&catalogMode==='table'?h('span',{'aria-hidden':'true'}):archived?null:checkbox,item,h('button.iv-address',{onclick:()=>details(n)},archived?`${n.archived.reason} · ${displayDate(n.archived.date)}${n.archived.saleCents!=null?' · '+M.money(n.archived.saleCents):''}`:M.address(doc,n)),h('div.iv-prices',h('strong',M.money(n.purchaseCents)),n.currentCents!=null?h('small',M.money(n.currentCents)):null),h('div.iv-actions',archived?button('Вернуть',()=>restoreDialog(n),'undo'):button('Открыть',()=>details(n),'next'),actionsButton(n))),n);row.oncontextmenu=e=>{e.preventDefault();showActions(n,row);};list.append(row);}
    if(!nodes.length)list.append(empty(query||category||roomFilter||condition?'Ничего не найдено. Измените запрос или фильтры.':archived?'В архиве пока нет вещей. Здесь появятся проданные, подаренные и списанные вещи.':'Вещей пока нет. Нажмите «Добавить вещь».'));content.append(list);
  }
  function drawHistory(){
    const needle=input('',{type:'search',placeholder:'Вещь или адрес…','aria-label':'Поиск в истории'}),kind=select([['','Все события'],...Object.entries(eventNames)],'',{'aria-label':'Тип события'}),list=h('div.iv-history');let limit=100;
    function paint(){const q=needle.value.trim().toLocaleLowerCase('ru'),events=doc.events.slice().reverse().filter(e=>(!kind.value||e.type===kind.value)&&(!q||[e.name,e.from,e.to,e.reason].join(' ').toLocaleLowerCase('ru').includes(q)));list.replaceChildren(...events.slice(0,limit).map(e=>h('article.iv-event',icon(e.type==='move'?'folder':'clock',18),h('div',M.getNode(doc,e.nodeId)?button(`${eventNames[e.type]||e.type} · ${e.name}`,()=>details(M.getNode(doc,e.nodeId))):h('strong',`${eventNames[e.type]||e.type} · ${e.name}`),h('small',e.type==='move'?`${e.from} → ${e.to}`:e.type==='value'?`${M.money(e.beforePurchase)} → ${M.money(e.purchaseCents)} · оценка ${M.money(e.currentCents)}`:e.reason||(e.type==='purchase'?M.money(e.purchaseCents):''))),h('time',displayDate(e.effectiveDate||e.date)))));if(!events.length)list.append(empty('Подходящих событий пока нет'));if(events.length>limit)list.append(button('Показать ещё',()=>{limit+=100;paint();},'next'));}
    needle.oninput=paint;kind.onchange=paint;content.replaceChildren(title('История имущества','Добавления, покупки, перемещения и выбытие'),h('div.iv-filters.iv-history-filter',needle,kind),list);paint();
  }
  function drawTrash(){
    const entries=(doc.trash||[]).slice().sort((a,b)=>b.removedAt.localeCompare(a.removedAt)),needle=input('',{type:'search',placeholder:'Найти удалённую вещь…','aria-label':'Поиск в корзине'}),list=h('div.iv-trash-list');function paint(){const found=entries.filter(e=>e.nodes.some(n=>n.name.toLocaleLowerCase('ru').includes(needle.value.toLocaleLowerCase('ru'))));list.replaceChildren(...found.map(entry=>{const n=entry.nodes.find(n=>n.id===entry.rootId);return h('article.iv-trash-row',nodeThumb(n),h('div.iv-row-copy',h('strong',n.name),h('small',`${displayDate(entry.removedAt)} · ${plural(entry.nodes.length,['позиция','позиции','позиций'])}${n.archived?' · из архива':''}`)),button('Восстановить',()=>recoverDialog(entry),'undo'));}));if(!found.length)list.append(empty(entries.length?'Ничего не найдено':'Корзина пуста'));}needle.oninput=paint;const clear=button('Очистить корзину',clearTrash,'trash','danger');clear.disabled=!entries.length;content.replaceChildren(title('Корзина','Вещи и мебель можно восстановить вместе с содержимым',[clear]),needle,list);paint();
  }
  function clearTrash(){const count=(doc.trash||[]).reduce((sum,e)=>sum+e.nodes.length,0);if(!count)return;modal('Очистить корзину?',(body,close)=>{const error=h('p.iv-form-error',{role:'alert'}),submit=button('Очистить навсегда',async()=>{submit.disabled=true;try{await change(d=>{d.trash=[];},{undoable:false,retryable:false});undoStack.length=0;redoStack.length=0;undoButton.disabled=true;close();say('Корзина очищена');}catch(e){error.textContent=e.message;submit.disabled=false;}},'trash','danger');body.append(h('p',`Будут удалены все объекты из корзины: ${count}, включая вложенные вещи и мебель.`),h('p.iv-muted','После очистки восстановить их из корзины или отменой действия не получится. Ранее созданные резервные копии сохранятся.'),error,h('div.iv-actions',button('Отмена',close,'close'),submit));});}
  function modal(name,build,{wide=false}={}){
    const dialog=h(`dialog.iv-dialog${wide?'.wide':''}`,{'aria-label':name});
    const body=h('div.iv-dialog-body');const close=()=>{dialog.close();dialog.remove();};
    dialog.append(h('div.iv-dialog-title',h('h2',name),button('Закрыть',close,'close')),body);document.body.append(dialog);
    dialog.addEventListener('close',()=>dialog.remove());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
    build(body,close);dialog.showModal();return dialog;
  }
  function details(n){detailId=n?.id||null;drawDetails();detailsPane.querySelector('h2')?.focus();}
  function drawDetails(){
    const n=M.getNode(doc,detailId);detailsPane.hidden=!n;if(!n){detailsPane.replaceChildren();return;}const totals=n.archived?{purchase:[n,...M.descendants(doc,n.id)].filter(x=>x.archived?.group===n.archived.group).reduce((sum,x)=>sum+(x.purchaseCents||0),0)}:M.totals(doc,n.id);
    const values={'Категория':M.categoryName(doc,n.categoryId),'Текущая оценка':n.currentCents!=null?M.money(n.currentCents):null,'Состояние':n.condition,'Износ':n.wear!=null?n.wear+'%':null,'Дата покупки':n.purchasedAt?displayDate(n.purchasedAt):null,'Срок годности':n.expiry?displayDate(n.expiry):null,'Гарантия до':n.warranty?displayDate(n.warranty):null,...n.fields};
    if(n.quantity!==1||n.unit!=='шт.')values['Количество']=n.quantity+' '+n.unit;
    const actions=h('div.iv-actions',n.archived?button('Вернуть',()=>restoreDialog(n),'undo'):button('Редактировать',()=>editNode(n),'sliders','primary'),n.kind!=='item'&&!n.archived?button('Содержимое',()=>open(n),'folder'):null,actionsButton(n));
    detailsPane.replaceChildren(...[h('div.iv-detail-heading',h('h2',{tabindex:-1},n.name),button('Закрыть',()=>{detailId=null;drawDetails();},'close')),breadcrumbs(n),h('div.iv-detail-hero',nodeThumb(n),h('div',h('strong.iv-detail-price',M.money(n.kind==='item'?n.purchaseCents:totals.purchase)),h('small.iv-muted',n.kind==='item'?'Стоимость покупки':`Объект ${M.money(n.purchaseCents)} · содержимое ${M.money(totals.purchase-(n.purchaseCents||0))}`))),actions,n.archived?h('p.iv-archive-info',`${n.archived.reason} · ${displayDate(n.archived.date)}`):null,
      h('dl.iv-details',...Object.entries(values).filter(([,v])=>v!=null&&v!=='').flatMap(([k,v])=>[h('dt',k),h('dd',v)])),n.notes?h('p.iv-notes',n.notes):null,!n.archived&&n.kind!=='room'?h('div.iv-actions',button('Переместить',()=>moveDialog([n.id]),'folder'),button('Создать копию',()=>{const copy=structuredClone(n);delete copy.id;delete copy.furnitureId;copy.name+=' — копия';copy.acquisition='existing';editNode(null,copy);},'copy'),n.kind==='furniture'?button(n.furnitureId?'Убрать с плана':'Разместить на плане',()=>n.furnitureId?detachFromPlan(n):openEditor(n.id),'map'):null):null,
      n.kind!=='item'&&!n.virtual?fillControl(n):null,h('h3','История вещи'),...doc.events.filter(e=>e.nodeId===n.id).slice(-5).reverse().map(e=>h('p.iv-muted',`${displayDate(e.effectiveDate||e.date)} · ${eventNames[e.type]||e.type}${e.from?' · '+e.from+' → '+e.to:''}`))].filter(Boolean));
  }
  function detachFromPlan(n){modal('Убрать с плана',(body,close)=>body.append(h('p',`«${n.name}» исчезнет с плана. Карточка и всё содержимое останутся на своём месте.`),button('Убрать с плана',async()=>{try{await change(d=>M.detachFurniture(d,n.id));close();say('Убрано с плана, карточка сохранена');}catch{}},'map')));}
  function destinationSelect(value,movingId){return createLocationPicker({getDoc:()=>doc,value:value||M.UNPLACED_ID,movingId,required:true,label:'Место хранения'});}
  function deleteDialog(n){modal(`Удалить «${n.name}»?`,(body,close)=>{
    const nested=M.descendants(doc,n.id);const mode=select([['all','Удалить вместе с содержимым'],['move','Перенести содержимое, удалить только этот объект']],'all',{'aria-label':'Что делать с содержимым'});
    const target=destinationSelect(n.parentId,n.id);target.disabled=true;
    mode.addEventListener('change',()=>target.disabled=mode.value!=='move');
    const error=h('p.iv-form-error',{role:'alert'});
    const submit=button('Удалить',async()=>{submit.disabled=true;error.textContent='';try{await change(d=>M.remove(d,n.id,{together:!nested.length||mode.value==='all',destination:target.value}));close();say('Перемещено в корзину');}catch(e){error.textContent=e.message;submit.disabled=false;}},'trash','danger');
    body.append(h('p','Объект исчезнет из каталога и с плана. Его можно будет восстановить из корзины.'),h('p.iv-muted',nested.length?`Внутри: ${nested.length} позиций, включая вложенные отсеки и вещи.`:'Внутри нет других вещей.'),...(nested.length?[field('Содержимое',mode),field('Куда перенести содержимое',target)]:[]),error,h('div.iv-dialog-actions',button('Отмена',close,'close'),submit));
  });}
  function recoverDialog(entry){modal('Восстановить из корзины',(body,close)=>{
    const n=entry.nodes.find(n=>n.id===entry.rootId);const original=M.getNode(doc,n.parentId);const target=destinationSelect(original&&!original.archived?original.id:null);
    const error=h('p.iv-form-error',{role:'alert'});
    const submit=button('Восстановить',async()=>{submit.disabled=true;try{await change(d=>M.recover(d,entry.id,target.value));close();say(n.archived?'Восстановлено в архив':'Объект восстановлен');}catch(e){error.textContent=e.message;submit.disabled=false;}},'undo','primary');
    body.append(h('p',`${n.name} · ${entry.nodes.length} позиций`),field('Место хранения',target),error,h('div.iv-dialog-actions',button('Отмена',close,'close'),submit));
  });}
  function editNode(existing,defaults={}){
    openItemForm({getDoc:()=>doc,existing,defaults,currentPlaceId:currentPlace().id,lastCategory,change:fn=>change(fn,{retryable:false}),onSaved:({categoryId,parentId,kind,again,nodeId})=>{if(kind==='item'){lastCategory=categoryId;localStorage.setItem('iv:last-category',categoryId);}if(again)editNode(null,{parentId,categoryId,kind});else if(nodeId){detailId=nodeId;drawDetails();}say(existing?'Изменения сохранены':kind==='item'?'Вещь добавлена':'Место хранения добавлено');}});
  }
  function moveDialog(ids){modal('Переместить вещи',(body,close)=>{const excluded=new Set(ids.flatMap(i=>[i,...M.descendants(doc,i).map(n=>n.id)]));const destination=createLocationPicker({getDoc:()=>doc,value:M.UNPLACED_ID,excludeIds:[...excluded],required:true,label:'Новое место'});body.append(h('p',`Выбрано: ${ids.length}. Контейнеры переместятся с содержимым.`),field('Новое место',destination),button('Переместить',async()=>{try{await change(d=>{for(const i of ids.filter(i=>!ids.some(other=>other!==i&&M.descendants(d,other).some(n=>n.id===i))))M.move(d,i,destination.value);});close();}catch{}},'folder','primary'));});}
  function archiveDialog(n){modal('В архив',(body,close)=>{const reason=select(['Продано','Подарено','Выброшено','Израсходовано','Другое'].map(v=>[v,v]),'Продано');const date=input(M.today(),{type:'date',required:true});const amount=input('',{inputmode:'decimal',placeholder:'Не указана'});const has=M.descendants(doc,n.id).length>0;const mode=select([['all','Архивировать вместе с содержимым'],['move','Переместить содержимое в другое место']],'all');const destination=destinationSelect(null,n.id);const extras=h('div');const refresh=()=>{amount.disabled=reason.value!=='Продано';destination.disabled=mode.value!=='move';};reason.addEventListener('change',refresh);mode.addEventListener('change',refresh);refresh();
      if(has)extras.append(field('Содержимое',mode),field('Куда переместить содержимое',destination));
      body.append(h('p',n.name),field('Причина',reason),field('Дата',date),field('Сумма продажи, ₽',amount),extras,button('Архивировать',async()=>{try{const saleCents=reason.value==='Продано'?M.parseMoney(amount.value):null;await change(d=>M.archive(d,n.id,{reason:reason.value,date:date.value,saleCents,together:!has||mode.value==='all',destination:destination.value}));close();}catch(e){say(e.message,true);}},'trash','primary'));
    });}
  function restoreDialog(n){modal('Вернуть из архива',(body,close)=>{const destination=destinationSelect(null,n.id);body.append(h('p',n.name),field('Место хранения',destination),button('Вернуть',async()=>{try{await change(d=>M.restore(d,n.id,destination.value));close();}catch{}},'undo','primary'));});}
  function categoryBadge(c){const a=categoryAppearance(doc,c.id);return h('span.iv-category-badge',{'data-kind':a.kind,'data-glyph':a.glyph,'aria-hidden':'true'},icon(a.glyph,16));}
  function drawCategories(){
    const form=h('form.iv-category-editor'),list=h('div.iv-category-groups'),inputs=new Map(),branches=new Map(),error=h('p.iv-form-error',{role:'alert'}),needle=input('',{type:'search',placeholder:'Найти категорию или подкатегорию…','aria-label':'Поиск категорий и подкатегорий'}),counter=h('span.iv-muted',{'aria-live':'polite'});
    const sorted=doc.categories.slice().sort((a,b)=>a.name.localeCompare(b.name,'ru'));
    function rows(parentId,depth=0){return sorted.filter(c=>(c.parentId||null)===parentId).map(c=>{const name=input(c.name,{required:true,maxlength:200,'aria-label':`Название категории: ${M.categoryName(doc,c.id)}`});inputs.set(c.id,name);name.addEventListener('input',filter);const branch=h('div.iv-category-branch',h('div.iv-category-edit-row',{style:{paddingLeft:depth*16+'px'}},categoryBadge(c),name,h('small.iv-muted',depth?'Подкатегория':'Категория')), ...rows(c.id,depth+1));branches.set(c.id,branch);return branch;});}
    list.append(...rows(null));const noResults=h('p.iv-muted',{hidden:true},'Ничего не найдено. Попробуйте другое название.');
    function filter(){const words=needle.value.trim().toLocaleLowerCase('ru').split(/\s+/).filter(Boolean);let matched=0;const matches=new Map();for(const c of sorted){const path=[];for(let n=c;n;n=sorted.find(x=>x.id===n.parentId))path.push(inputs.get(n.id).value);const ok=words.every(w=>path.join(' ').toLocaleLowerCase('ru').includes(w));matches.set(c.id,ok);if(ok)matched++;}function show(c){const own=matches.get(c.id),nested=sorted.filter(x=>x.parentId===c.id).map(show).some(Boolean);branches.get(c.id).hidden=!own&&!nested;return own||nested;}sorted.filter(c=>!c.parentId).forEach(show);counter.textContent=words.length?`Найдено ${matched} из ${sorted.length}`:`Всего ${sorted.length}`;noResults.hidden=matched>0;}
    needle.oninput=filter;
    const name=input('',{maxlength:200,placeholder:'Название новой категории','aria-label':'Новая категория'}),parent=select([['','Основная категория'],...sorted.filter(c=>!c.parentId).map(c=>[c.id,c.name])],'',{'aria-label':'Родительская категория'}),save=h('button.iv-btn.primary',{type:'submit'},'Сохранить изменения');
    form.append(h('div.iv-category-search',needle,counter),h('details.iv-category-create',h('summary','Добавить категорию или подкатегорию'),h('div.iv-category-add',field('Название',name),field('Родитель',parent))),list,noResults,error,h('div.iv-category-save',save));
    form.onsubmit=async e=>{e.preventDefault();error.textContent='';save.disabled=true;try{const names=[...inputs].map(([id,el])=>[id,el.value.trim()]);if(names.some(([,value])=>!value))throw Error('Название категории не может быть пустым');await change(d=>{for(const [id,value]of names)d.categories.find(c=>c.id===id).name=value;if(name.value.trim())d.categories.push({id:M.id(),name:name.value.trim(),parentId:parent.value||null,kind:'default'});},{retryable:false});say('Категории сохранены');}catch(e){error.textContent=e.message;save.disabled=false;}};
    content.replaceChildren(title('Категории и подкатегории','Названия, поиск и добавление категорий',[button('К вещам',()=>go('catalog'),'back')]),form);filter();
  }
  async function openEditor(placeNodeId=null){
    if(editor)return;clearWorld();window.__inventoryPlan=structuredClone(doc.plan);
    const editorData=()=>({furniture:structuredClone(doc.nodes.filter(n=>n.kind==='furniture'&&!n.archived)),placeNodeId});window.__inventoryEditorData=editorData();
    window.__inventorySavePlan=async plan=>{normalize(plan);await change(d=>M.syncPlan(d,plan));window.__inventoryPlan=structuredClone(doc.plan);window.__inventoryEditorData=editorData();say('План сохранён');};
    window.__inventoryDeleteFromEditor=async(nodeId,{plan:pendingPlan,furnitureId}={})=>{
      const preview=structuredClone(doc);if(pendingPlan)M.syncPlan(preview,pendingPlan);
      const target=M.getNode(preview,nodeId)||preview.nodes.find(n=>n.furnitureId===furnitureId);if(!target)throw Error('Мебель не найдена');
      return new Promise(resolve=>{const dialog=modal('Удалить в корзину',(body,close)=>{const nested=M.descendants(preview,target.id),mode=select([['all','Удалить вместе с содержимым'],['move','Перенести содержимое, удалить только мебель']],'all',{'aria-label':'Что делать с содержимым'}),destination=createLocationPicker({getDoc:()=>preview,value:target.parentId,movingId:target.id,required:true,label:'Куда перенести содержимое'});destination.disabled=true;mode.onchange=()=>destination.disabled=mode.value!=='move';const error=h('p.iv-form-error',{role:'alert'}),submit=button('Удалить в корзину',async()=>{submit.disabled=true;try{await change(d=>{if(pendingPlan){Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,structuredClone(preview));}const n=M.getNode(d,nodeId)||d.nodes.find(x=>x.furnitureId===furnitureId);M.remove(d,n.id,{together:!nested.length||mode.value==='all',destination:destination.value});});window.__inventoryPlan=structuredClone(doc.plan);window.__inventoryEditorData=editorData();resolve(structuredClone(doc.plan));close();}catch(e){error.textContent=e.message;submit.disabled=false;}},'trash','danger');body.append(h('p',`«${target.name}» исчезнет с плана и из каталога. Восстановление доступно в корзине.`),h('p.iv-muted','Текущие изменения плана будут сохранены вместе с удалением.'),...(nested.length?[field('Содержимое',mode),field('Новое место содержимого',destination)]:[]),error,h('div.iv-actions',button('Отмена',close,'close'),submit));});dialog.addEventListener('close',()=>resolve(null),{once:true});});
    };
    window.__inventoryCloseEditor=()=>{editor?.remove();editor=null;sceneMemory=null;draw();};editor=h('iframe.iv-editor',{src:'./index.html?inventoryEditor=1',title:'Редактор квартиры'});document.body.append(editor);
  }
  function setupHome(){modal('Начать свою квартиру',(body,close)=>{const mode=select([['empty','Пустая квартира — одна комната'],['plan','Текущий план с мебелью, без демо-вещей']],'empty',{'aria-label':'Начало своей квартиры'});const error=h('p.iv-form-error',{role:'alert'}),start=button('Сохранить копию и начать',async()=>{start.disabled=true;try{const result=await exportBackup();if(result===false){start.disabled=false;return;}const next=M.createHome(doc,{mode:mode.value});await change(d=>{Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,next);},{restore:true});detailId=null;place=null;sectionState.clear();close();go('space');say('Своя квартира создана. Предыдущие данные сохранены в копии.');}catch(e){error.textContent=e.message;start.disabled=false;}},'home','primary');body.append(h('p','Сначала сохраним резервную копию текущих данных. В новой квартире не будет демо-вещей, цен и истории.'),field('С чего начать',mode),error,start);});}
  function drawSettings(){
    const days=input(doc.settings.reminderDays,{type:'number',min:0,max:365,'aria-label':'За сколько дней напоминать'});
    const login=h('input',{type:'checkbox','aria-label':'Открывать при входе в macOS'});login.checked=nativeSettings.login==='on';login.disabled=!isNative;
    login.addEventListener('change',async()=>{try{const r=await call('inventoryLogin',{on:login.checked});nativeSettings={...nativeSettings,...r};draw();}catch(e){login.checked=!login.checked;say(e.message,true);}});
    const automatic=h('input',{type:'checkbox','aria-label':'Автоматически проверять обновления'});automatic.checked=Boolean(nativeSettings.automaticUpdateChecks);automatic.disabled=!isNative||!nativeSettings.updatesConfigured;automatic.onchange=async()=>{try{nativeSettings={...nativeSettings,...await call('inventoryAutomaticUpdates',{on:automatic.checked})};}catch(e){automatic.checked=!automatic.checked;say(e.message,true);}};
    const checkUpdates=button('Проверить обновления…',async()=>{try{await call('inventoryCheckUpdates');}catch(e){say(e.message,true);}},'download');checkUpdates.disabled=!isNative||!nativeSettings.updatesConfigured;
    const nativeNote=!isNative?h('p.iv-muted','В браузерном просмотре данные хранятся в браузере. Автокопии и уведомления доступны в приложении macOS.'):null;
    content.replaceChildren(title('Настройки','Локальные данные и поведение приложения'),h('div.iv-settings-grid',h('section.iv-card',h('h2','Напоминания'),field('За сколько дней до срока предупреждать',days),button('Сохранить интервал',()=>run(d=>d.settings.reminderDays=Number(days.value)),'check'),h('p',doc.settings.notifications?'Уведомления включены в приложении':'Уведомления macOS пока выключены'),h('p.iv-muted',!isNative?'Уведомления доступны в приложении macOS':nativeSettings.notificationAuthorization==='denied'?'macOS запретила уведомления. Разрешите их в системных настройках.':nativeSettings.notificationAuthorization==='authorized'?'macOS разрешает уведомления':'Разрешение macOS ещё не получено'),button('Включить уведомления macOS',async()=>{try{if(!isNative)throw Error('Откройте приложение macOS');const r=await call('inventoryNotifications');if(r.allowed){await change(d=>d.settings.notifications=true);say('Уведомления включены');}else say('Разрешите уведомления в системных настройках macOS',true);}catch(e){say(e.message,true);}},'clock'),button('Выключить уведомления',()=>run(d=>d.settings.notifications=false),'close')),
      h('section.iv-card',h('h2','Резервные копии'),h('p.iv-muted',nativeSettings.lastBackupAt?'Последняя успешная копия: '+new Date(nativeSettings.lastBackupAt).toLocaleString('ru-RU'):'Успешных автоматических копий пока нет'),nativeSettings.lastBackupError?h('p.iv-form-error',nativeSettings.lastBackupError):null,h('p.iv-muted',`Доступно копий: ${nativeSettings.backupCount||0}`),h('p','Ежедневная автоматическая копия. Хранятся последние 5. Фотографии входят в копию.'),h('p.iv-address',nativeSettings.backupFolder||'Папка для автокопий ещё не выбрана'),button('Выбрать папку',async()=>{try{nativeSettings={...nativeSettings,...await call('inventoryBackupFolder')};draw();}catch(e){say(e.message,true);}},'folder'),button('Создать копию сейчас',async()=>{try{nativeSettings={...nativeSettings,...await call('inventoryBackupNow')};await change(()=>{},{undoable:false,retryable:false});draw();say('Резервная копия сохранена');}catch(e){say(e.message,true);}},'copy'),button('Экспортировать…',exportBackup,'download'),button('Восстановить из копии…',importBackup,'undo'),h('small.iv-muted','Перед восстановлением сохраняется защитная копия текущих данных.')),
      h('section.iv-card',h('h2','Приложение'),h('p',`Версия ${APP_VERSION}`),checkUpdates,field('Автоматически проверять обновления',automatic),h('p.iv-muted',nativeSettings.updatesConfigured?'Новая версия загрузится и установится после вашего подтверждения. Данные квартиры сохраняются.':'Обновления появятся в сборке с настроенным каналом релизов.'),button('История изменений',()=>go('changelog'),'list'),field('Открывать при входе в macOS',login),h('p.iv-muted','После закрытия окна приложение остаётся в фоне. Открыть его можно из Dock или строки меню.'),h('p.iv-muted','Островок у выреза экрана добавим в следующих версиях.'),nativeNote)));
  }
  async function exportBackup(){try{if(isNative){const result=await call('inventoryExport');return !result.cancelled;}const a=h('a',{href:URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'})),download:`Мой-дом-${M.today()}.json`});a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return true;}catch(e){say(e.message,true);return false;}}
  async function importBackup(){
    const apply=async raw=>{try{M.migrate(raw);M.validate(raw);normalize(raw.plan);if(!confirm(`Восстановить «${raw.plan.name||'Квартира'}»? В копии ${M.totals(raw).items} вещей, ${raw.plan.rooms.length} комнат. Текущие данные будут сохранены в защитную копию.`))return;
      if(!isNative)localStorage.setItem(LOCAL_KEY+':before-restore',JSON.stringify(doc));
      await change(d=>{Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,structuredClone(raw));},{restore:true});place=null;say('Копия восстановлена');draw();}catch(e){say('Восстановление: '+e.message,true);}};
    try{if(isNative){const r=await call('inventoryImport');if(r.document)await apply(r.document);}else{const file=h('input',{type:'file',accept:'application/json,.json'});file.addEventListener('change',async()=>{try{if(!file.files[0])return;if(file.files[0].size>100*1024*1024)throw Error('Размер копии больше 100 МБ');await apply(JSON.parse(await file.files[0].text()));}catch(e){say(e.message,true);}});file.click();}}catch(e){say(e.message,true);}
  }
  incoming.shown=()=>world?.setRunning(true);incoming.hidden=()=>world?.setRunning(false);
  incoming.inventorySettings=next=>{nativeSettings={...nativeSettings,...next};refreshAwards();if(view==='settings')draw(true);};
  incoming.backupError=text=>{nativeSettings.lastBackupError=text;alertBar.hidden=false;alertBar.replaceChildren(h('span','Резервная копия: '+text),button('Открыть настройки',()=>go('settings'),'settings'));};
  incoming.inventoryUndo=()=>{const activeDialog=document.querySelector('dialog[open]');if(activeDialog){if(document.activeElement?.matches('input,textarea,[contenteditable=true]'))document.execCommand('undo');return;}const frame=editor?.contentWindow;const active=(frame?.document||document).activeElement;if(active?.matches('input,textarea,[contenteditable=true]'))(frame?.document||document).execCommand('undo');else if(frame)frame.dispatchEvent(new KeyboardEvent('keydown',{key:'z',metaKey:true,bubbles:true}));else undo();};
  incoming.inventoryOpenNode=id=>{const n=M.getNode(doc,id);if(n)details(n);else say('Вещь из уведомления больше не найдена',true);};
  window.addEventListener('keydown',e=>{if(editor)return;const editing=e.target.matches?.('input,textarea,[contenteditable=true]');if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!editing&&!document.querySelector('dialog[open]')){e.preventDefault();undo(e.shiftKey);return;}if(e.key==='Escape'&&detailId&&!document.querySelector('dialog[open]')){detailId=null;drawDetails();}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchInput.focus();searchInput.select();}if(e.metaKey&&e.key===','){e.preventDefault();go('settings');}});
  document.addEventListener('visibilitychange',()=>world?.setRunning(!document.hidden));
  window.addEventListener('focus',()=>world?.setRunning(!document.hidden));
  // Explicit inspection surface for local UI checks; no network or external API.
  window.__inventory={get document(){return structuredClone(doc);},go,open:nId=>open(M.getNode(doc,nId)),get world(){return world;}};
  if(!window.__HOUSE_BOOT__?.inventory && isNative)await persist(doc);
  draw();post('ready');if(isNative)call('inventorySystemStatus').then(next=>{nativeSettings={...nativeSettings,...next};refreshAwards();if(view==='settings')draw(true);}).catch(()=>{});if(awardsAtBoot)change(()=>{},{undoable:false,retryable:false}).catch(()=>{});
}
