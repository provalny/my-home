import './inventory.css';
import { h, openMenu } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { call, post, incoming, isNative } from '../bridge.js';
import { normalize } from '../config.js';
import { createWorld } from '../three/world.js';
import * as M from './model.js';

const LOCAL_KEY = 'my-home-inventory:v1';
const eventNames = { purchase:'Добавление / покупка', move:'Перемещение', archive:'Архивирование', value:'Изменение стоимости', restore:'Возвращение из архива', delete:'Удаление в корзину', recover:'Восстановление из корзины' };
const nodeIcon = n => n.kind === 'room' ? 'home' : n.kind === 'furniture' ? 'furniture' : n.kind === 'item' ? 'box' : 'folder';
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
  M.validate(doc); normalize(doc.plan);
  let view = 'overview', query = '', place = null, category = '', condition = '', sort = 'name', roomFilter = '', selected = new Set();
  let busy = false, world = null, resize = null, editor = null, lastCategory = '', nativeSettings = window.__HOUSE_BOOT__?.inventorySettings || {};
  const status = h('span.iv-save','Все изменения сохранены');
  const toast = h('div.iv-toast',{role:'status','aria-live':'polite'});
  const searchInput = input('',{type:'search',placeholder:'Поиск вещей и мест · ⌘K','aria-label':'Поиск вещей и мест',oninput:() => {query=searchInput.value; view='catalog'; place=null; draw();}});
  const nav = h('nav.iv-nav',{'aria-label':'Разделы приложения'});
  const content = h('main.iv-content');
  const menuHost=h('div.iv-menu-host');document.body.append(menuHost);
  let closeActionMenu=null;
  root.replaceChildren(h('div.iv-shell',h('aside.iv-sidebar',
    h('div.iv-brand',icon('home',27),h('div',h('strong','Мой дом'),h('small','Пространство для ваших вещей'))),nav,
    h('div.iv-sidebar-bottom',h('span.iv-dot'), 'Хранится на этом Mac',h('small','На основе House Control'))),
    h('section.iv-workspace',h('header.iv-topbar',h('div.iv-search',icon('list',17),searchInput),status,button('Добавить вещь',()=>editNode(null),'plus','primary')),content)),toast);

  function say(text,error=false) { toast.textContent=text; toast.className=`iv-toast show${error?' error':''}`; clearTimeout(say.timer); say.timer=setTimeout(()=>toast.className='iv-toast',4500); }
  async function persist(next, restore=false) {
    if (isNative) await call('saveInventory',{document:next,expectedRevision:doc.revision || 0,restore});
    else localStorage.setItem(LOCAL_KEY,JSON.stringify(next));
  }
  async function change(mutator,{restore=false}={}) {
    if (busy) throw Error('Дождитесь сохранения предыдущего изменения');
    busy=true; status.textContent='Сохранение…';
    try {
      const next=structuredClone(doc); mutator(next); next.revision=(doc.revision || 0)+1;
      M.validate(next); normalize(next.plan); await persist(next,restore);
      if(place&&!M.getNode(next,place)){let parent=M.getNode(doc,place);while(parent&&!M.getNode(next,parent.id))parent=M.getNode(doc,parent.parentId);place=parent?.id||null;}
      doc=next;
      status.textContent='Все изменения сохранены'; selected.clear(); draw();
    } catch(e) { status.textContent='Изменение не сохранено'; say(e.message,true); throw e; }
    finally { busy=false; }
  }
  const run = (fn,opts) => change(fn,opts).catch(()=>{});
  const currentPlace = () => M.getNode(doc,place) || doc.nodes.find(n=>n.kind==='room');
  const go = (page) => {view=page; query=''; searchInput.value=''; place=null; selected.clear(); draw();};
  const open = n => { if(n.kind==='item') details(n); else {place=n.id;view='space';query='';searchInput.value='';draw();} };
  function drawNav() {
    nav.replaceChildren(...[['overview','Обзор','home'],['space','Квартира','map'],['catalog','Все вещи','box'],['archive','Архив','folder'],['trash','Корзина','trash'],['history','История','clock'],['settings','Настройки','settings']].map(([key,label,glyph]) => button(label,()=>go(key),glyph,view===key?'active':'')),
      h('div.iv-nav-caption','В дальнейшем'),...['Мониторинг квартиры','Автомобиль','Личные метрики'].map(label=>button(label,()=>say('Этот раздел появится в следующих версиях'),'activity','future')));
  }
  function clearWorld() { resize?.disconnect();resize=null;world?.dispose();world=null; }
  function draw() {
    closeActionMenu?.();closeActionMenu=null;clearWorld(); drawNav();
    if (view==='overview' || view==='space') drawHome();
    else if(view==='catalog' || view==='archive') drawCatalog();
    else if(view==='trash') drawTrash();
    else if(view==='history') drawHistory();
    else drawSettings();
  }
  function title(name,sub,actions=[]) { return h('div.iv-heading',h('div',h('h1',name),h('p',sub)),h('div.iv-actions',...actions)); }
  function metric(label,value,glyph,sub) { return h('div.iv-metric',icon(glyph,22),h('div',h('small',label),h('strong',value),sub?h('span',sub):null)); }
  function drawHome() {
    const totals=M.totals(doc); const wear=doc.nodes.filter(n=>!n.archived && n.kind!=='room' && n.wear!=null);
    const metrics=h('div.iv-metrics',metric('Стоимость покупки',M.money(totals.purchase),'box'),metric('Текущая стоимость',M.money(totals.current),'activity'),metric('Учётных позиций',totals.count,'list'),metric('Средний ручной износ',wear.length?`${Math.round(wear.reduce((s,n)=>s+n.wear,0)/wear.length)}%`:'—','clock'));
    const canvas=h('canvas',{'aria-label':'Интерактивная 3D-планировка квартиры'});
    const rooms=h('div.iv-room-tabs',button('Вся квартира',()=>{place=null;draw();},'home',!place?'active':''),...doc.nodes.filter(n=>n.kind==='room').map(n=>button(n.name,()=>{place=n.id;draw();},null,place===n.id?'active':'')));
    const scene=h('section.iv-scene',h('div.iv-scene-title',h('span',doc.plan.name),button('Редактор',openEditor,'sliders')),canvas,h('div.iv-scene-hint','Перетащите для вращения · колесо для масштаба · нажмите на мебель'));
    const pane=h('section.iv-storage'); fillStorage(pane);
    content.replaceChildren(title(view==='overview'?'Всё на своих местах':'Моя квартира',view==='overview'?'Имущество, места хранения и важные даты':'Откройте мебель на плане или выберите комнату'),metrics,rooms,h('div.iv-home-grid',scene,pane));
    if(view==='overview') content.append(h('div.iv-bottom-grid',categorySummary(),reminders(),monthSummary()));
    const cfg=normalize(structuredClone(doc.plan)); cfg.inventoryPicking=true;
    cfg.furniture=cfg.furniture.filter(f=>!doc.nodes.find(n=>n.furnitureId===f.id)?.archived);
    const state={lights:{},acs:{}};
    for(const l of cfg.lights) state.lights[l.id]={on:true,brightness:0.72,temp:3200,color:l.color || null};
    for(const a of cfg.acs) state.acs[a.id]={on:false,mode:'cool',fan:'auto',swing:'off',sleep:false,target:23};
    try {
      world=createWorld(canvas,cfg,{state,on:()=>()=>{}},{onHover:()=>{},onPick:t=>{
        const n=t?.kind==='room'?doc.nodes.find(n=>n.roomId===t.id):t?.kind==='furniture'?doc.nodes.find(n=>n.furnitureId===t.id):null;
        if(n){place=n.id;fillStorage(pane);if(n.kind==='room')world.focus({kind:'room',id:n.roomId});}
      }});
      world.setInsets(36,20);world.setRunning(!document.hidden);world.intro();
      let ancestor=M.getNode(doc,place);while(ancestor && ancestor.kind!=='room')ancestor=M.getNode(doc,ancestor.parentId);
      if(ancestor)world.focus({kind:'room',id:ancestor.roomId});
      resize=new ResizeObserver(()=>world?.resize());resize.observe(canvas);
    }catch(e){scene.append(h('div.iv-3d-error','3D недоступно: '+e.message+'. Все вещи доступны в списке справа.'));}
  }
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
  function fillStorage(pane) {
    pane.ondrop=null;pane.ondragover=null;pane.ondragleave=null;
    const n=M.getNode(doc,place); const nodes=n?M.children(doc,n.id):doc.nodes.filter(n=>n.kind==='room');
    const head=n? h('div',button(n.parentId?'Назад':'Все комнаты',()=>{place=n.parentId;fillStorage(pane);},'back'),h('h2',n.name),h('p.iv-address',M.address(doc,n))):h('div',h('h2','Комнаты и хранение'),h('p.iv-muted','Каждая вещь имеет своё место'));
    const totals=n?M.totals(doc,n.id):M.totals(doc);
    const paneTop = [head,h('div.iv-storage-total',h('strong',M.money(totals.purchase)),h('small',n&&n.kind!=='room'?`Сам объект: ${M.money(n.purchaseCents)} · содержимое: ${M.money(totals.purchase-(n.purchaseCents||0))}`:`${totals.count} учётных позиций`)),
      n?.fill!=null?h('div.iv-fill',h('span',`Заполненность ${n.fill}%`),h('progress',{max:100,value:n.fill})):null,
      h('div.iv-actions',n?button('Вещь',()=>editNode(null,{parentId:n.id}),'plus'):null,n?button('Отсек',()=>editNode(null,{parentId:n.id,kind:'shelf'}),'folder'):null,n&&n.kind!=='room'?button('Карточка',()=>details(n),'next'):null,n&&n.kind!=='room'?actionsButton(n):null)];
    pane.replaceChildren(...paneTop.filter(Boolean));
    const list=h('div.iv-storage-list',...nodes.map(child=>{
      const row=draggable(h('div.iv-storage-row',{tabindex:0,role:'button',onclick:()=>open(child),onkeydown:e=>{if(e.key==='Enter'&&e.target===e.currentTarget)open(child);},oncontextmenu:e=>{if(child.kind!=='room'){e.preventDefault();showActions(child,row);}}},nodeThumb(child),h('div.iv-row-copy',h('strong',child.name),h('small',child.kind==='item'?M.categoryName(doc,child.categoryId)||'Вещь':`${M.totals(doc,child.id).count-(child.kind==='room'?0:1)} внутри`)),h('span.iv-row-price',M.money(M.totals(doc,child.id).purchase)),icon('next',15)),child);
      if(child.kind!=='item')dropTarget(row,child.id);
      if(child.kind!=='item' && child.kind!=='room'){const handle=button('↑',()=>{},null);handle.dataset.orderHandle='1';row.append(handle);}
      if(child.kind!=='room')row.append(actionsButton(child));
      return row;
    }));
    // A dedicated handle reorders siblings without confusing that gesture with moving inside a box.
    for(const row of list.children){const nId=nodes[[...list.children].indexOf(row)]?.id; const handle=row.querySelector('[data-order-handle]');if(handle){
      handle.textContent='Порядок';handle.setAttribute('aria-label','Изменить порядок: '+M.getNode(doc,nId).name);handle.draggable=true;
      handle.addEventListener('click',e=>e.stopPropagation());handle.addEventListener('dragstart',e=>{e.stopPropagation();e.dataTransfer.setData('application/x-inventory-order',nId);});
      row.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('application/x-inventory-order'))e.preventDefault();});
      row.addEventListener('drop',e=>{const moving=e.dataTransfer.getData('application/x-inventory-order');if(moving){e.preventDefault();e.stopPropagation();run(d=>M.reorder(d,moving,nId));}});
    }}
    if(!nodes.length)list.append(empty('Здесь пока пусто. Добавьте вещь или отсек.'));
    pane.append(list);if(n)dropTarget(pane,n.id);
  }
  function nodeThumb(n){return n.photo?h('img.iv-thumb',{src:n.photo,alt:'',loading:'lazy'}):h('span.iv-thumb',icon(nodeIcon(n),22));}
  function actionsButton(n){const el=button('',e=>{e.stopPropagation();showActions(n,el);},'more','iv-more');el.setAttribute('aria-label',`Действия: ${n.name}`);el.title='Действия';return el;}
  function showActions(n,anchor){
    closeActionMenu?.();
    const items=[{label:'Открыть карточку',icon:icon('next',15),action:()=>details(n)}];
    if(n.archived)items.push({label:'Вернуть из архива',icon:icon('undo',15),action:()=>restoreDialog(n)});
    else items.push({label:'Редактировать',icon:icon('sliders',15),action:()=>editNode(n)},{label:'Переместить',icon:icon('folder',15),action:()=>moveDialog([n.id])},{label:'В архив',icon:icon('folder',15),action:()=>archiveDialog(n)});
    items.push('-',{label:'Удалить',icon:icon('trash',15),action:()=>deleteDialog(n)});
    closeActionMenu=openMenu(menuHost,anchor,items);
  }
  function categorySummary(){const roots=doc.categories.filter(c=>!c.parentId).sort((a,b)=>a.name.localeCompare(b.name,'ru'));return h('section.iv-card',h('h2','По категориям'),...roots.map(c=>{const label=M.categoryName(doc,c.id);const count=doc.nodes.filter(n=>!n.archived&&n.kind!=='room'&&(M.categoryName(doc,n.categoryId)===label||M.categoryName(doc,n.categoryId).startsWith(label+' / '))).length;return count?button(`${c.name} · ${count}`,()=>{go('catalog');category=c.id;draw();},'box'):null;}));}
  function reminders(){const due=M.dueItems(doc);return h('section.iv-card',h('h2','Важные даты'),...(due.length?due.slice(0,8).map(x=>button(`${x.node.name} · ${x.key==='expiry'?'Срок годности':'Гарантия'} · ${x.days<0?'истёк':x.days===0?'сегодня':`через ${x.days} дн.`}`,()=>details(x.node),'clock')):[h('p.iv-muted','Ближайших сроков нет')]),h('small.iv-muted',`Предупреждение за ${doc.settings.reminderDays} дн.`));}
  function monthSummary(){const months=new Map();for(const e of doc.events){if(!['purchase','archive'].includes(e.type))continue;const m=(e.effectiveDate||e.date).slice(0,7);if(!months.has(m))months.set(m,{purchase:0,sale:0,writeoff:0});const v=months.get(m);if(e.type==='purchase')v.purchase+=e.purchaseCents||0;else if(e.reason==='Продано')v.sale+=e.saleCents||0;else v.writeoff+=e.purchaseCents||0;}return h('section.iv-card',h('h2','Покупки, продажи, списания'),...([...months.keys()].sort().reverse().slice(0,6).map(m=>{const v=months.get(m);return h('div.iv-month',h('strong',m),h('span',`Покупки ${M.money(v.purchase)}`),h('span',`Продажи ${M.money(v.sale)}`),h('span',`Списания ${M.money(v.writeoff)}`));})),h('small.iv-muted','История накапливается с начала использования.'))}
  function categoryOptions(){return [['','Без категории'],...doc.categories.map(c=>[c.id,M.categoryName(doc,c.id)]).sort((a,b)=>a[1].localeCompare(b[1],'ru'))];}
  function drawCatalog(){
    const archived=view==='archive';let nodes=M.search(doc,query,archived);
    if(category){const target=M.categoryName(doc,category);nodes=nodes.filter(n=>M.categoryName(doc,n.categoryId)===target||M.categoryName(doc,n.categoryId).startsWith(target+' / '));}
    if(condition)nodes=nodes.filter(n=>n.condition===condition);
    if(roomFilter)nodes=nodes.filter(n=>n.id===roomFilter||M.descendants(doc,roomFilter).some(x=>x.id===n.id));
    nodes.sort((a,b)=>sort==='price'?(b.purchaseCents||0)-(a.purchaseCents||0):sort==='date'?(b.createdAt||'').localeCompare(a.createdAt||''):a.name.localeCompare(b.name,'ru'));
    const filters=h('div.iv-filters',select([['','Все категории'],...categoryOptions().slice(1)],category,{'aria-label':'Фильтр по категории',onchange:e=>{category=e.target.value;draw();}}),select([['','Все комнаты'],...doc.nodes.filter(n=>n.kind==='room').map(n=>[n.id,n.name])],roomFilter,{'aria-label':'Фильтр по комнате',onchange:e=>{roomFilter=e.target.value;draw();}}),select([['','Любое состояние'],...M.CONDITIONS.map(c=>[c,c])],condition,{'aria-label':'Фильтр по состоянию',onchange:e=>{condition=e.target.value;draw();}}),select([['name','По названию'],['price','По стоимости'],['date','По дате добавления']],sort,{'aria-label':'Сортировка',onchange:e=>{sort=e.target.value;draw();}}),button('Сбросить',()=>{category='';condition='';roomFilter='';query='';searchInput.value='';draw();},'rotate'));
    const bulk=selected.size&&!archived?h('div.iv-bulk',h('span',`Выбрано: ${selected.size}`),button('Переместить',()=>moveDialog([...selected]),'folder'),button('Снять выделение',()=>{selected.clear();draw();},'close')):null;
    const catalogHead=[title(archived?'Архив':'Все вещи',`${nodes.length} учётных позиций${query?` · «${query}»`:''}`,[button('Категории',categoriesDialog,'list')]),filters,bulk];
    content.replaceChildren(...catalogHead.filter(Boolean),h('div.iv-table',h('div.iv-table-head',h('span'),h('span','Вещь'),h('span','Место хранения'),h('span','Покупка / оценка'),h('span','Действия')),
      ...nodes.map(n=>{
        const checkbox=h('input',{type:'checkbox','aria-label':`Выбрать ${n.name}`,onchange:e=>{e.target.checked?selected.add(n.id):selected.delete(n.id);draw();}});checkbox.checked=selected.has(n.id);
        return draggable(h('div.iv-table-row',{oncontextmenu:e=>{e.preventDefault();showActions(n,e.currentTarget);}},archived?h('span'):checkbox,h('button.iv-item-name',{onclick:()=>details(n)},nodeThumb(n),h('span',h('strong',n.name),h('small',M.categoryName(doc,n.categoryId)||M.KINDS[n.kind]))),h('button.iv-address',{onclick:()=>details(n)},M.address(doc,n)),h('div.iv-prices',h('strong',M.money(n.purchaseCents)),h('small',M.money(n.currentCents))),h('div.iv-actions',archived?button('Вернуть',()=>restoreDialog(n),'undo'):button('Открыть',()=>details(n),'next'),actionsButton(n))),n);
      }),!nodes.length?empty('Ничего не найдено. Измените поиск или фильтры.'):null));
  }
  function drawHistory(){content.replaceChildren(title('История имущества','Покупки, перемещения, изменения стоимости и архив'),h('div.iv-history',...doc.events.slice().reverse().map(e=>h('article.iv-event',icon(e.type==='move'?'folder':'clock',18),h('div',h('strong',`${eventNames[e.type]||e.type} · ${e.name}`),h('small',e.type==='move'?`${e.from} → ${e.to}`:e.type==='value'?`${M.money(e.beforePurchase)} → ${M.money(e.purchaseCents)} · оценка ${M.money(e.currentCents)}`:e.reason||M.money(e.purchaseCents))),h('time',displayDate(e.effectiveDate||e.date))))));}
  function drawTrash(){
    const entries=(doc.trash||[]).slice().sort((a,b)=>b.removedAt.localeCompare(a.removedAt));
    content.replaceChildren(title('Корзина','Удалённые вещи и мебель можно восстановить вместе с содержимым'),h('div.iv-trash-list',...(entries.length?entries.map(entry=>{const n=entry.nodes.find(n=>n.id===entry.rootId);return h('article.iv-trash-row',nodeThumb(n),h('div.iv-row-copy',h('strong',n.name),h('small',`${displayDate(entry.removedAt)} · ${entry.nodes.length} позиций${n.archived?' · из архива':''}`)),button('Восстановить',()=>recoverDialog(entry),'undo'));}):[empty('Корзина пуста')])));
  }
  function modal(name,build,{wide=false}={}){
    const dialog=h(`dialog.iv-dialog${wide?'.wide':''}`,{'aria-label':name});
    const body=h('div.iv-dialog-body');const close=()=>{dialog.close();dialog.remove();};
    dialog.append(h('div.iv-dialog-title',h('h2',name),button('Закрыть',close,'close')),body);document.body.append(dialog);
    dialog.addEventListener('close',()=>dialog.remove());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
    build(body,close);dialog.showModal();return dialog;
  }
  function details(n){modal(n.name,(body,close)=>{
    const totals=n.archived?{purchase:[n,...M.descendants(doc,n.id)].filter(x=>x.archived?.group===n.archived.group).reduce((s,x)=>s+(x.purchaseCents||0),0)}:M.totals(doc,n.id);
    const detailContent=[h('div.iv-detail-hero',nodeThumb(n),h('div',h('p.iv-address',M.address(doc,n)),h('strong.iv-detail-price',M.money(totals.purchase)),h('p.iv-muted',n.kind!=='item'?`Объект ${M.money(n.purchaseCents)} · содержимое ${M.money(totals.purchase-(n.purchaseCents||0))}`:'Стоимость покупки'))),
      h('dl.iv-details',...Object.entries({'Категория':M.categoryName(doc,n.categoryId)||'—','Текущая оценка':M.money(n.currentCents),'Состояние':n.condition,'Ручной износ':n.wear==null?'—':`${n.wear}%`,'Дата покупки':displayDate(n.purchasedAt),'Срок годности':displayDate(n.expiry),'Гарантия до':displayDate(n.warranty),'Количество':`${n.quantity} ${n.unit}`,...n.fields}).flatMap(([key,value])=>[h('dt',key),h('dd',value||'—')])),n.notes?h('p.iv-notes',n.notes):null,
      n.archived?h('p.iv-archive-info',`${n.archived.reason} · ${displayDate(n.archived.date)}${n.archived.saleCents!=null?' · '+M.money(n.archived.saleCents):''}`):null,
      h('div.iv-dialog-actions',...(n.archived?[button('Вернуть из архива',()=>{close();restoreDialog(n);},'undo')]:[button('Редактировать',()=>{close();editNode(n);},'sliders','primary'),button('Создать копию',()=>{close();const copy=structuredClone(n);delete copy.id;delete copy.furnitureId;copy.name+=' — копия';editNode(null,copy);},'copy'),button('Переместить',()=>{close();moveDialog([n.id]);},'folder'),button('В архив',()=>{close();archiveDialog(n);},'trash')]))];
    body.append(...detailContent.filter(Boolean));
    body.querySelector('.iv-dialog-actions').append(button('Удалить',()=>{close();deleteDialog(n);},'trash','danger'));
    if(n.kind!=='item'&&!n.archived)body.append(button('Открыть содержимое',()=>{close();open(n);},'next'));
  });}
  function destinationSelect(value,movingId){return select(M.destinations(doc,movingId).map(n=>[n.id,M.address(doc,n)]),value,{required:true,'aria-label':'Место хранения'});}
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
    const n=structuredClone(existing||{kind:'item',name:'',parentId:currentPlace().id,categoryId:lastCategory,condition:'Хорошее',fields:{},...defaults});
    const sourceId=existing?.id;
    modal(existing?'Редактировать вещь':'Добавить вещь',(body,close)=>{
      const form=h('form.iv-form');const name=input(n.name,{required:true,maxlength:200,placeholder:'Например, футболка Nike','aria-label':'Название'});
      const kind=select(Object.entries(M.KINDS).filter(([k])=>k!=='room'),n.kind,{'aria-label':'Тип объекта'});
      if(existing?.furnitureId || existing && M.descendants(doc,existing.id).length)kind.disabled=true;
      const parent=destinationSelect(n.parentId,sourceId);const cat=select(categoryOptions(),n.categoryId,{'aria-label':'Категория'});
      const attrs=h('div.iv-form-grid');let attrInputs={};
      function fields(){attrInputs={};const keys=M.CATEGORY_FIELDS[M.categoryKind(doc,cat.value)]||M.CATEGORY_FIELDS.default;attrs.replaceChildren(...keys.map(key=>{const el=input(n.fields?.[key]||'');attrInputs[key]=el;return field(key,el);}));}
      cat.addEventListener('change',fields);fields();
      const photo=h('div.iv-photo-input');let photoValue=n.photo||null;
      const photoFile=h('input',{type:'file',accept:'image/png,image/jpeg,image/webp','aria-label':'Фотография вещи'});
      const preview=()=>photo.replaceChildren(photoValue?h('img',{src:photoValue,alt:'Фото вещи'}):icon('camera',28),h('span','Одно фото · JPG, PNG, WebP'),photoFile,button('Убрать фото',()=>{photoValue=null;preview();},'close'));
      const loadPhoto=async file=>{try{if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Выберите JPG, PNG или WebP');if(file.size>20*1024*1024)throw Error('Фото должно быть меньше 20 МБ');const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const ratio=Math.min(1,1000/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();photoValue=canvas.toDataURL('image/jpeg',0.82);preview();}catch(e){say(e.message,true);}};
      photoFile.addEventListener('change',()=>loadPhoto(photoFile.files[0]));photo.addEventListener('dragover',e=>e.preventDefault());photo.addEventListener('drop',e=>{e.preventDefault();loadPhoto(e.dataTransfer.files[0]);});preview();
      const purchase=input(n.purchaseCents==null?'':(n.purchaseCents/100).toFixed(2),{inputmode:'decimal',placeholder:'Не указано'});
      const current=input(n.currentCents==null?'':(n.currentCents/100).toFixed(2),{inputmode:'decimal',placeholder:'Не указано'});
      const wear=input(n.wear,{type:'number',min:0,max:100});const fill=input(n.fill,{type:'number',min:0,max:100});
      const cond=select(M.CONDITIONS.map(v=>[v,v]),n.condition);const purchased=input(n.purchasedAt,{type:'date'});const expiry=input(n.expiry,{type:'date'});const warranty=input(n.warranty,{type:'date'});
      const quantity=input(n.quantity||1,{type:'number',min:0.001,step:'any',required:true});const unit=select(['шт.','кг','г','л','мл','уп.'].map(v=>[v,v]),n.unit||'шт.');
      const notes=h('textarea',{rows:3,maxlength:10000});notes.value=n.notes||'';const error=h('p.iv-form-error',{role:'alert'});
      const submit=h('button.iv-btn.primary',{type:'submit'},existing?'Сохранить':'Создать');const more=h('button.iv-btn',{type:'submit','data-more':'1'},'Создать ещё');
      const details=h('details',h('summary','Цена, состояние и характеристики'),h('div.iv-form-grid',field('Цена покупки, ₽ (вся партия)',purchase),field('Текущая оценка, ₽ (вся партия)',current),field('Дата покупки',purchased),field('Состояние',cond),field('Ручной износ, %',wear),field('Заполненность места, %',fill),field('Количество',quantity),field('Единица',unit),field('Срок годности',expiry),field('Гарантия до',warranty)),attrs,photo,field('Заметки',notes));if(existing)details.open=true;
      form.append(h('div.iv-form-grid',field('Название *',name),field('Тип',kind),field('Место хранения *',parent),field('Категория',cat)),details,error,h('div.iv-dialog-actions',submit,existing?null:more));body.append(form);
      form.addEventListener('submit',async e=>{e.preventDefault();error.textContent='';submit.disabled=true;more.disabled=true;
        try{const props={name:name.value.trim(),kind:kind.value,parentId:parent.value,categoryId:cat.value,fields:Object.fromEntries(Object.entries(attrInputs).map(([k,v])=>[k,v.value.trim()]).filter(([,v])=>v)),photo:photoValue,purchaseCents:M.parseMoney(purchase.value),currentCents:M.parseMoney(current.value),wear:wear.value===''?null:Number(wear.value),fill:fill.value===''?null:Number(fill.value),condition:cond.value,purchasedAt:purchased.value,expiry:expiry.value,warranty:warranty.value,quantity:Number(quantity.value),unit:unit.value,notes:notes.value.trim()};
          await change(d=>{if(existing){const old=M.getNode(d,sourceId);if(old.parentId!==props.parentId)M.move(d,old.id,props.parentId);if(old.purchaseCents!==props.purchaseCents||old.currentCents!==props.currentCents)M.record(d,'value',old,{beforePurchase:old.purchaseCents,beforeCurrent:old.currentCents,purchaseCents:props.purchaseCents,currentCents:props.currentCents});Object.assign(old,props);}else M.newNode(d,props);});
          lastCategory=cat.value;const again=e.submitter?.dataset.more;close();if(again)editNode(null,{parentId:parent.value,categoryId:cat.value,kind:kind.value});
        }catch(err){error.textContent=err.message;}finally{submit.disabled=false;more.disabled=false;}
      });
    },{wide:true});
  }
  function moveDialog(ids){modal('Переместить вещи',(body,close)=>{const excluded=new Set(ids.flatMap(i=>[i,...M.descendants(doc,i).map(n=>n.id)]));const destination=select(M.destinations(doc).filter(n=>!excluded.has(n.id)).map(n=>[n.id,M.address(doc,n)]),'');body.append(h('p',`Выбрано: ${ids.length}. Контейнеры переместятся с содержимым.`),field('Новое место',destination),button('Переместить',async()=>{try{await change(d=>{for(const i of ids.filter(i=>!ids.some(other=>other!==i&&M.descendants(d,other).some(n=>n.id===i))))M.move(d,i,destination.value);});close();}catch{}},'folder','primary'));});}
  function archiveDialog(n){modal('В архив',(body,close)=>{const reason=select(['Продано','Подарено','Выброшено','Израсходовано','Другое'].map(v=>[v,v]),'Продано');const date=input(M.today(),{type:'date',required:true});const amount=input('',{inputmode:'decimal',placeholder:'Не указана'});const has=M.children(doc,n.id).length>0;const mode=select([['all','Архивировать вместе с содержимым'],['move','Переместить содержимое в другое место']],'all');const destination=destinationSelect(null,n.id);const extras=h('div');const refresh=()=>{amount.disabled=reason.value!=='Продано';destination.disabled=mode.value!=='move';};reason.addEventListener('change',refresh);mode.addEventListener('change',refresh);refresh();
      if(has)extras.append(field('Содержимое',mode),field('Куда переместить содержимое',destination));
      body.append(h('p',n.name),field('Причина',reason),field('Дата',date),field('Сумма продажи, ₽',amount),extras,button('Архивировать',async()=>{try{const saleCents=reason.value==='Продано'?M.parseMoney(amount.value):null;await change(d=>M.archive(d,n.id,{reason:reason.value,date:date.value,saleCents,together:!has||mode.value==='all',destination:destination.value}));close();}catch(e){say(e.message,true);}},'trash','primary'));
    });}
  function restoreDialog(n){modal('Вернуть из архива',(body,close)=>{const destination=destinationSelect(null,n.id);body.append(h('p',n.name),field('Место хранения',destination),button('Вернуть',async()=>{try{await change(d=>M.restore(d,n.id,destination.value));close();}catch{}},'undo','primary'));});}
  function categoriesDialog(){modal('Категории и подкатегории',(body)=>{
    const list=h('div.iv-category-list');function refresh(){list.replaceChildren(...doc.categories.slice().sort((a,b)=>M.categoryName(doc,a.id).localeCompare(M.categoryName(doc,b.id),'ru')).map(c=>{const name=input(c.name,{'aria-label':'Название категории'});return h('div.iv-category-row',h('span',c.parentId?M.categoryName(doc,c.parentId):'Категория'),name,button('Сохранить',()=>{if(!name.value.trim())return say('Введите название',true);run(d=>{d.categories.find(x=>x.id===c.id).name=name.value.trim();});},'check'));}));}refresh();
    const name=input('',{placeholder:'Новая категория','aria-label':'Новая категория'});const parent=select([['','Основная категория'],...doc.categories.filter(c=>!c.parentId).map(c=>[c.id,c.name])],'');body.append(list,h('div.iv-form-grid',field('Название',name),field('Родительская категория',parent)),button('Добавить',async()=>{if(!name.value.trim())return say('Введите название',true);try{await change(d=>d.categories.push({id:M.id(),name:name.value.trim(),parentId:parent.value||null,kind:'default'}));name.value='';refresh();}catch{}},'plus','primary'));
  },{wide:true});}
  async function openEditor(){
    if(editor)return;
    clearWorld();window.__inventoryPlan=structuredClone(doc.plan);
    window.__inventorySavePlan=async plan=>{normalize(plan);await change(d=>M.syncPlan(d,plan));window.__inventoryPlan=structuredClone(doc.plan);say('План сохранён');};
    window.__inventoryCloseEditor=()=>{editor?.remove();editor=null;draw();};
    editor=h('iframe.iv-editor',{src:'./index.html?inventoryEditor=1',title:'Редактор квартиры'});document.body.append(editor);
  }
  function drawSettings(){
    const days=input(doc.settings.reminderDays,{type:'number',min:0,max:365,'aria-label':'За сколько дней напоминать'});
    const login=h('input',{type:'checkbox','aria-label':'Открывать при входе в macOS'});login.checked=nativeSettings.login==='on';login.disabled=!isNative;
    login.addEventListener('change',async()=>{try{const r=await call('inventoryLogin',{on:login.checked});nativeSettings={...nativeSettings,...r};draw();}catch(e){login.checked=!login.checked;say(e.message,true);}});
    const nativeNote=!isNative?h('p.iv-muted','В браузерном просмотре данные хранятся в браузере. Автокопии и уведомления доступны в приложении macOS.'):null;
    content.replaceChildren(title('Настройки','Локальные данные и поведение приложения'),h('div.iv-settings-grid',h('section.iv-card',h('h2','Напоминания'),field('За сколько дней до срока предупреждать',days),button('Сохранить интервал',()=>run(d=>d.settings.reminderDays=Number(days.value)),'check'),h('p',doc.settings.notifications?'Уведомления включены в приложении':'Уведомления macOS пока выключены'),button('Включить уведомления macOS',async()=>{try{if(!isNative)throw Error('Откройте приложение macOS');const r=await call('inventoryNotifications');if(r.allowed){await change(d=>d.settings.notifications=true);say('Уведомления включены');}else say('Разрешите уведомления в системных настройках macOS',true);}catch(e){say(e.message,true);}},'clock'),button('Выключить уведомления',()=>run(d=>d.settings.notifications=false),'close')),
      h('section.iv-card',h('h2','Резервные копии'),h('p','Ежедневная автоматическая копия. Хранятся последние 5. Фотографии входят в копию.'),h('p.iv-address',nativeSettings.backupFolder||'Папка для автокопий ещё не выбрана'),button('Выбрать папку',async()=>{try{nativeSettings={...nativeSettings,...await call('inventoryBackupFolder')};draw();}catch(e){say(e.message,true);}},'folder'),button('Создать копию сейчас',async()=>{try{await call('inventoryBackupNow');say('Резервная копия сохранена');}catch(e){say(e.message,true);}},'copy'),button('Экспортировать…',exportBackup,'download'),button('Восстановить из копии…',importBackup,'undo'),h('small.iv-muted','Перед восстановлением сохраняется защитная копия текущих данных.')),
      h('section.iv-card',h('h2','Приложение'),field('Открывать при входе в macOS',login),h('p.iv-muted','После закрытия окна приложение остаётся в фоне. Открыть его можно из Dock или строки меню.'),h('p.iv-muted','Островок у выреза экрана добавим в следующих версиях.'),nativeNote)));
  }
  async function exportBackup(){try{if(isNative){await call('inventoryExport');return;}const a=h('a',{href:URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'})),download:`Мой-дом-${M.today()}.json`});a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(e){say(e.message,true);}}
  async function importBackup(){
    const apply=async raw=>{try{M.validate(raw);normalize(raw.plan);if(!confirm('Восстановить квартиру из этой копии? Текущие данные будут сохранены в защитную копию.'))return;
      if(!isNative)localStorage.setItem(LOCAL_KEY+':before-restore',JSON.stringify(doc));
      await change(d=>{Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,structuredClone(raw));},{restore:true});place=null;say('Копия восстановлена');draw();}catch(e){say('Восстановление: '+e.message,true);}};
    try{if(isNative){const r=await call('inventoryImport');if(r.document)await apply(r.document);}else{const file=h('input',{type:'file',accept:'application/json,.json'});file.addEventListener('change',async()=>{try{if(!file.files[0])return;if(file.files[0].size>100*1024*1024)throw Error('Размер копии больше 100 МБ');await apply(JSON.parse(await file.files[0].text()));}catch(e){say(e.message,true);}});file.click();}}catch(e){say(e.message,true);}
  }
  incoming.shown=()=>world?.setRunning(true);incoming.hidden=()=>world?.setRunning(false);
  incoming.inventorySettings=next=>{nativeSettings={...nativeSettings,...next};if(view==='settings')draw();};
  incoming.backupError=text=>say('Автокопия: '+text,true);
  window.addEventListener('keydown',e=>{if(editor)return;if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchInput.focus();searchInput.select();}if(e.metaKey&&e.key===','){e.preventDefault();go('settings');}});
  document.addEventListener('visibilitychange',()=>world?.setRunning(!document.hidden));
  window.addEventListener('focus',()=>world?.setRunning(!document.hidden));
  // Explicit inspection surface for local UI checks; no network or external API.
  window.__inventory={get document(){return structuredClone(doc);},go,open:nId=>open(M.getNode(doc,nId)),get world(){return world;}};
  if(!window.__HOUSE_BOOT__?.inventory && isNative)await persist(doc);
  draw();post('ready');
}
