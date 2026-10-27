import {estimatedWeight} from './weights.js';
import { isKitchenType } from './ikea-storage.js';
import './inventory.css';
import { createInventoryWorkbook, EXCEL_MIME, bytesBase64 } from './excel-export.js';
import { importInventoryRows, previewInventoryImport, readInventoryExcel } from './excel-import.js';
import { createWeatherService, findWeatherCities, validWeatherCity, weatherDescription, WEATHER_TTL } from './weather.js';
import { createWeatherScene } from './weather-scene.js';
import { itemWear, validateWear, resolvedWearMode, wearSchedule } from './wear.js';
import './workspace.css';
import { openItemForm, createLocationPicker } from './forms.js';
import { h, openMenu } from '../ui/dom.js';
import { bindStorageDrag } from './storage-drag.js';
import { icon } from '../ui/icons.js';
import { call, post, incoming, isNative } from '../bridge.js';
import { normalize } from '../config.js';
import { createWorld } from '../three/world.js';
import * as M from './model.js';
import releases from './releases.json';
import { categoryAppearance, nodeAppearance, rememberCategoryIcons } from './appearance.js';
import { nodeThumbnail, paintRarity, rarityBadge } from './visuals.js';
import { awardToday, calculateAwards, syncAwards } from './awards.js';
import { renderAwards } from './awards-view.js';
import { ROOM_ICONS, setRoomIcon } from './room-icons.js';
import { renderRoomPreviews } from '../three/room-previews.js';
import {renderCarPreviews} from '../three/car-previews.js';
import { APP_ICONS, appIconPath } from './app-icons.js';
import { roomPresentationForm } from './room-form.js';
import { roomColor } from './room-types.js';
import { resizableColumns, resetColumns } from './table-columns.js';
import { translationCandidates, translatePlan } from './localization.js';
import { OPENABLE_TYPES, layoutZones, storageChildren, sectionRects } from './storage-layout.js';
import { fridgeConfig, fridgeChambers, FRIDGE_INSTALLATIONS, FREEZER_POSITIONS } from './fridge-layout.js';
import { isBasicSection, isSection, SECTION_KINDS, sectionName, KITCHEN_MODULE_TYPES, kitchenTypeOptions } from './ikea-storage.js';
import { createActionHistory, describeAction, historyShortcut, editingText, sameValue } from './action-history.js';
import { planLocation } from './plan-location.js';
import { openCategoryWizard } from './category-wizard.js';
import { itemCollections } from './category-presets.js';
import { planCategoryRemoval, removeCategories, planCategoryMove, moveCategory, placeCategory, CATEGORY_ICONS, setCategoryIcon } from './categories.js';
import { rarityChart } from './rarity-chart.js';
import { ELECTRONICS_TYPES } from '../editor/object-sections.js';
import { createInterfacePreferences } from './interface-preferences.js';
import './glass.css';
import { installLiquidGlass } from './liquid-glass.js';
import './liquid-glass.css';
import './compact-catalog.css';
import './weather.css';
import './rarity.css';
import './summary-categories.css';
import './palettes.css';
import { isLAN, createLANClient } from './lan-client.js';
import { phoneAccessCard } from './phone-access.js';
import './mobile.css';
import './category-interactions.css';
import './interface-polish.css';
import { createMonitoring } from '../monitoring/app.js';
import { createPersonalMetrics } from '../metrics/app.js';
import { createTravel, travelTags } from '../travel/app.js';
import { isPossession as travelPossession, itemWeightKg, itemVolumeLiters, setWeight, decimal as travelDecimal } from '../travel/model.js';
import { createAutomobile } from '../automobile/app.js';
import { carForNode, cars as automobileCars, moveMany as moveAutomobileItems } from '../automobile/model.js';
import { COLORS } from './colors.js';
import {createItemMaster} from '../item-master/app.js';
import {createDemoTour} from './demo-tour.js';
import {isShowcase} from './demo-runtime.js';
import {openShowcase} from './showcase.js';

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
  const automobileDemo=!isNative&&!isLAN&&new URLSearchParams(location.search).get('demo')==='automobile';
  const travelDemo=!isNative&&!isLAN&&new URLSearchParams(location.search).get('demo')==='travel';
  const itemMasterDemo=!isNative&&!isLAN&&new URLSearchParams(location.search).get('demo')==='item-master';
  const storageKey=LOCAL_KEY+(itemMasterDemo?':item-master-demo-v1':travelDemo?':travel-demo-v1':automobileDemo?':automobile-demo-v1':'');
  const lan = isLAN ? createLANClient() : null;
  let doc = (isShowcase||automobileDemo||travelDemo||itemMasterDemo)?null:lan ? await lan.connect() : window.__HOUSE_BOOT__?.inventory;
  let createdDemo=false;
  if (!doc && !isNative && !isShowcase) { const raw = localStorage.getItem(storageKey); if (raw) doc = JSON.parse(raw); }
  if(isShowcase){const response=await fetch('./plans/home.json');if(!response.ok)throw Error('Не найден демонстрационный план');const {createShowcaseDocument}=await import('./showcase-data.js');doc=createShowcaseDocument(await response.json());}
  if (!doc) { const response = await fetch('./plans/home.json'); if (!response.ok) throw Error('Не найден демонстрационный план'); doc = M.demo(await response.json());if(itemMasterDemo){const {itemMasterDemo:seedItemMaster}=await import('../item-master/demo.js');doc=seedItemMaster(doc);createdDemo=true;}if(travelDemo){const {seedTravelDemo}=await import('../travel/demo.js');seedTravelDemo(doc);createdDemo=true;}if(automobileDemo){const {seedAutomobileDemo}=await import('../automobile/demo.js');seedAutomobileDemo(doc);createdDemo=true;}if(!itemMasterDemo&&!travelDemo&&!automobileDemo)doc=M.createHome(doc,{mode:'empty'}); }
  if(travelDemo)doc.demoProfile??={type:'travel',version:1};
  let originalDocument=structuredClone(doc);M.migrate(doc);M.validate(doc);M.listSpaces(doc).forEach(s=>normalize(s.plan));let migrationPending=!sameValue(originalDocument,doc);if(!migrationPending)originalDocument=null;
  if(createdDemo){localStorage.setItem(storageKey,JSON.stringify(doc));migrationPending=false;originalDocument=null;}
  let view = ['monitoring','automobile','travel','personal-metrics','item-master'].includes(new URLSearchParams(location.search).get('section'))?new URLSearchParams(location.search).get('section'):'overview', query = '', place = null, category = '', collection = '', condition = '', sort = 'name', roomFilter = '', selected = new Set();
  let activeSpaceId=localStorage.getItem('iv:active-space')||M.PRIMARY_SPACE_ID;if(!M.getSpace(doc,activeSpaceId))activeSpaceId=M.PRIMARY_SPACE_ID;
  const activeSpace=(d=doc)=>M.getSpace(d,activeSpaceId)||M.listSpaces(d)[0];
  const activePlan=(d=doc)=>activeSpace(d).plan;
  const activeRooms=()=>doc.nodes.filter(n=>n.kind==='room'&&!n.virtual&&(n.spaceId||M.PRIMARY_SPACE_ID)===activeSpace(doc).id);
  function selectSpace(id){if(editor)return;clearWorld();activeSpaceId=M.getSpace(doc,id)?.id||M.PRIMARY_SPACE_ID;localStorage.setItem('iv:active-space',activeSpaceId);sceneMemory=null;place=null;focusId=null;focusTrail=[];selectedSection=null;detailId=null;sectionState.delete('space');}
  function followSpace(n){const space=M.spaceForNode(doc,n);if(space&&space.id!==activeSpace(doc).id)selectSpace(space.id);}
  let readIndex=null,searchTimer=0,catalogLimit=100,catalogPageKey=null,worldSignature=null,focusSignature=null;
  const index=()=>readIndex??=M.createReadIndex(doc);
  let busy = false, world = null, resize = null, editor = null, lastCategory = '', nativeSettings = isShowcase?{}:window.__HOUSE_BOOT__?.inventorySettings || {};
  let remotePending=false, sharedRefreshing=false, sharedTimer=0, sharedNotice=null;
  let detailId=null, locatedId=null, spaceMode=localStorage.getItem('iv:space-mode')||'3d', catalogMode=localStorage.getItem('iv:catalog-mode')||(isLAN&&matchMedia('(max-width: 700px)').matches?'grid':'table');
  let showFurniture=localStorage.getItem('iv:show-furniture')!=='false';
  let settingsSection='appearance', reminderDraft=null;
  let categoriesMode=localStorage.getItem('iv:categories-mode')==='grid'?'grid':'list';
  lastCategory=localStorage.getItem('iv:last-category')||'';
  const sectionState=new Map(), history=createActionHistory(); let failedAction=null, sceneMemory=null, renderedPlace=null;
  const awardsAtBoot=syncAwards(doc,nativeSettings,{now:new Date().toISOString(),visitDay:document.hidden?null:awardToday()});let awardsRefreshPending=false;const awardViewState={};
  const weatherService=createWeatherService({storage:localStorage});
  const nodeIcon=n=>nodeAppearance(doc,n).glyph;
  const detailsPane=h('aside.iv-detail-panel',{'aria-label':'Карточка вещи',hidden:true});
  const alertBar=h('div.iv-alert',{role:'alert',hidden:true});
  const undoButton=button('Отменить',()=>undo(), 'undo');
  const redoButton=button('Повторить',()=>undo(true), 'redo');
  const historyNext=h('small.iv-history-next');
  const historyControls=h('div.iv-history-controls',{'aria-label':'Общая история сохранённых действий'},h('div.iv-history-buttons',undoButton,redoButton),historyNext);
  const status = h('span.iv-save','Все изменения сохранены');
  const toast = h('div.iv-toast',{role:'status','aria-live':'polite'});
  const searchInput = input('',{type:'search',placeholder:'Поиск вещей и мест · ⌘K','aria-label':'Поиск вещей и мест',oninput:() => {if(view!=='catalog')rememberSection();query=searchInput.value;view='catalog';place=null;category='';collection='';condition='';roomFilter='';selected.clear();detailId=null;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{searchTimer=0;draw();},120);}});
  const nav = h('nav.iv-nav',{'aria-label':'Разделы приложения'});
  const secondaryNav = h('nav.iv-nav.iv-secondary-nav',{'aria-label':'История и служебные разделы'});
  const content = h('main.iv-content');
  const menuHost=h('div.iv-menu-host');document.body.append(menuHost);
  let closeActionMenu=null,focusId=null,focusTrail=[],sceneUI=null,storagePane=null,selectedSection=null;
  const reducedMotion=()=>doc.settings.motion==='off'||doc.settings.motion!=='on'&&(nativeSettings.reduceMotion||matchMedia('(prefers-reduced-motion: reduce)').matches);
  const appearance=createInterfacePreferences((next,previous)=>{
    updateAppearance();
    const menuPreference=content.querySelector('[aria-label="Компактное боковое меню"]');if(menuPreference)menuPreference.checked=next.collapsed;
    if(next.theme!==previous.theme&&(view==='space'||view==='unplaced'||view==='monitoring'||view==='automobile'||view==='travel'||view==='personal-metrics'))draw(true);
  });
  const collapseButton=button('',()=>appearance.set({collapsed:!appearance.prefs.collapsed}),'back','iv-sidebar-toggle');
  const themeButton=button('',()=>appearance.set({theme:appearance.prefs.theme==='dark'?'light':'dark'}),null,'iv-theme-toggle');
  themeButton.setAttribute('aria-label','Переключить тему');
  const mobileMenu=button('Меню',()=>setMobileMenu(!root.querySelector('.iv-shell')?.classList.contains('is-mobile-menu-open')),'list','iv-mobile-menu');
  const menuBackdrop=button('Закрыть меню',()=>setMobileMenu(false),null,'iv-mobile-backdrop');
  function setMobileMenu(open){root.querySelector('.iv-shell')?.classList.toggle('is-mobile-menu-open',open);mobileMenu.setAttribute('aria-expanded',String(open));}
  mobileMenu.setAttribute('aria-expanded','false');
  nav.addEventListener('click',e=>{if(e.target.closest('button'))setMobileMenu(false);});
  secondaryNav.addEventListener('click',e=>{if(e.target.closest('button'))setMobileMenu(false);});
  root.replaceChildren(h('div.iv-shell',h('aside.iv-sidebar',
    h('div.iv-sidebar-heading',h('div.iv-brand',icon('home',27),h('div',h('strong','Life Assistant'))),collapseButton),nav,
    h('div.iv-sidebar-bottom',secondaryNav,button('Что нового',()=>{setMobileMenu(false);showWhatsNew();},'sparkles','iv-whats-new'),h('div.iv-local-status',h('span.iv-dot'),isShowcase?'Демо · до закрытия':(automobileDemo||travelDemo||itemMasterDemo)?'Демонстрационные данные':isLAN?'Общая база на Mac':isNative?'Хранится на этом Mac':'Хранится в этом браузере'),h('small.iv-version-number',`Версия ${APP_VERSION}`))),menuBackdrop,
    h('section.iv-workspace',h('header.iv-topbar',mobileMenu,h('div.iv-search',icon('search',20),searchInput),h('div.iv-monitoring-context',icon('homeassistant',18),'Мониторинг квартиры'),h('div.au-context',icon('car',18),'Автомобиль'),h('div.iv-personal-context',icon('activity',14),'Личные метрики'),status,historyControls,themeButton,button('Добавить вещь',()=>view==='automobile'?automobile.addItem():editNode(null),'plus','primary')),alertBar,h('div.iv-body',content,detailsPane))),toast);
  function updateAppearance(){
    const {collapsed,theme}=appearance.prefs;
    root.querySelector('.iv-shell')?.classList.toggle('is-sidebar-collapsed',collapsed);
    collapseButton.setAttribute('aria-expanded',String(!collapsed));
    collapseButton.setAttribute('aria-label',collapsed?'Развернуть меню':'Свернуть меню');
    collapseButton.title=collapsed?'Развернуть меню':'Свернуть меню';
    themeButton.replaceChildren(icon(theme==='dark'?'sun':'moon',17));
    themeButton.title=theme==='dark'?'Включить светлую тему':'Включить тёмную тему';
    themeButton.setAttribute('aria-label',themeButton.title);
  }
  updateAppearance();
  installLiquidGlass(root,{reducedMotion});
  const monitoring=createMonitoring({getDocument:()=>doc,change,modal,say,reducedMotion,theme:()=>appearance.prefs.theme});
  const itemMaster=createItemMaster({getDocument:()=>doc,change,modal,say,isActive:()=>view==='item-master'});
  const personalMetrics=createPersonalMetrics({getDocument:()=>doc,change,modal,say});
  const travel=createTravel({getDocument:()=>doc,change,modal,say,reducedMotion,theme:()=>appearance.prefs.theme,details,demoHref:!isShowcase&&!isNative&&!isLAN?'?section=travel&demo=travel':null});
  const automobile=createAutomobile({getDocument:()=>doc,change,modal,say,reducedMotion,theme:()=>appearance.prefs.theme,editItem:editNode,details,demoHref:!isShowcase&&!isNative&&!isLAN?'?section=automobile&demo=automobile':null,closeDetails:()=>{detailId=null;drawDetails();}});
  const demoTour=createDemoTour({storageKey,onClose:({automatic,completed})=>{if(completed)startShowcase(automatic);else if(automatic)finishFirstLaunch();}});
  function startShowcase(automatic=false){
    demoTour.markShowcase();
    openShowcase({theme:appearance.prefs.theme,onClose:()=>{demoTour.completeShowcase();if(automatic)finishFirstLaunch();}});
  }
  function finishFirstLaunch(){
    if(!doc.settings.categorySetup&&!['monitoring','automobile','travel','personal-metrics','item-master'].includes(view))configureCategories();
    if(view==='personal-metrics')personalMetrics.maybePrompt();
  }

  function updateHistoryControls(){
    const previous=history.peek(),next=history.peek(true);
    undoButton.disabled=busy||Boolean(editor)||!previous;
    redoButton.disabled=busy||Boolean(editor)||!next;
    undoButton.title=previous?`Отменить: ${previous.label} · ⌘Z`:'Нет действий для отмены';
    redoButton.title=next?`Повторить: ${next.label} · ⇧⌘Z`:'Нет действий для повтора';
    undoButton.setAttribute('aria-label',undoButton.title);redoButton.setAttribute('aria-label',redoButton.title);
    historyNext.textContent=previous?`Отмена: ${previous.label}`:next?`Повтор: ${next.label}`:'Общая история · нет действий';
    historyNext.title=`Общая история всех разделов. ${undoButton.title}. ${redoButton.title}. В открытом редакторе отменяются его текущие правки.`;
    toast.querySelector('button')?.remove();
  }

  function say(text,error=false,redo=false) {
    toast.replaceChildren(h('span',text));toast.className=`iv-toast show${error?' error':''}`;
    const entry=history.peek(redo);
    if(!error&&!editor&&entry){const action=button(redo?'Повторить':'Отменить',()=>{if(history.peek(redo)===entry)undo(redo);},redo?'redo':'undo');action.title=(redo?'Повторить: ':'Отменить: ')+entry.label;toast.append(action);}
    if(error){const body=document.querySelector('dialog[open] .iv-dialog-body');if(body){let local=body.querySelector('.iv-local-error');if(!local){local=h('p.iv-form-error.iv-local-error',{role:'alert'});body.prepend(local);}local.textContent=text;}}
    clearTimeout(say.timer);say.timer=setTimeout(()=>toast.className='iv-toast',error?10000:5500);
  }
  async function persist(next, restore=false) {
    if(isShowcase){migrationPending=false;originalDocument=null;return;}
    if (lan) await lan.save(next,doc.revision||0,restore||migrationPending);
    else if (isNative) await call('saveInventory',{document:next,expectedRevision:doc.revision || 0,restore:restore||migrationPending});
    else {if(migrationPending)localStorage.setItem(storageKey+':before-migration',JSON.stringify(originalDocument));localStorage.setItem(storageKey,JSON.stringify(next));}migrationPending=false;originalDocument=null;
  }
  async function change(mutator,{restore=false,undoable=true,retryable=true,action=null,historyStep=null}={}) {
    if (busy) throw Error('Дождитесь сохранения предыдущего изменения');
    const actionSection=editor?'space':view;
    busy=true; updateHistoryControls();status.textContent='Сохранение…';
    try {
      const next=structuredClone(doc); mutator(next);
      for(const parentId of new Set(next.nodes.filter(isSection).map(n=>n.parentId)))M.renumberSections(next,parentId);
      if(undoable&&sameValue(next,doc)){status.textContent='Все изменения сохранены';return;}
      next.revision=(doc.revision || 0)+1;
      rememberCategoryIcons(next);syncAwards(next,nativeSettings,{now:new Date().toISOString(),previous:restore?null:doc,visitDay:document.hidden?null:awardToday()});
      M.validate(next); M.listSpaces(next).forEach(s=>normalize(s.plan)); await persist(next,restore);
      if(place&&!M.canStore(M.getNode(next,place))){let parent=M.getNode(doc,place);while(parent&&!M.canStore(M.getNode(next,parent.id)))parent=M.getNode(doc,parent.parentId);place=parent?.id||null;focusId=null;selectedSection=null;}
      if(historyStep)history.complete(historyStep==='redo');
      else if(undoable)history.record(doc,{...(action?{label:action,section:actionSection}:describeAction(doc,next,actionSection)),spaceId:activeSpaceId},next);
      doc=next;if(!M.getSpace(doc,activeSpaceId)){activeSpaceId=M.PRIMARY_SPACE_ID;localStorage.setItem('iv:active-space',activeSpaceId);sceneMemory=null;}readIndex=null;failedAction=null;alertBar.hidden=true;
      const categoryIds=new Set(doc.categories.map(c=>c.id));
      if(category&&!categoryIds.has(category))category='';
      for(const saved of sectionState.values())if(saved.category&&!categoryIds.has(saved.category))saved.category='';
      if(lastCategory&&!categoryIds.has(lastCategory)){lastCategory='';localStorage.removeItem('iv:last-category');}
      status.textContent='Все изменения сохранены'; selected.clear(); if(!editor)draw(true);
    } catch(e) { status.textContent='Изменение не сохранено';const conflict=e.status===409||e.detail?.code==='revision_conflict'; failedAction=!conflict&&retryable&&!document.querySelector('dialog[open]')?()=>change(mutator,{restore,undoable,retryable,action}).catch(()=>{}):null;alertBar.hidden=false;alertBar.replaceChildren(...[h('span',e.message),conflict?button('Обновить данные',()=>refreshSharedDocument(true),'rotate'):failedAction?button('Повторить сохранение',()=>failedAction?.(),'rotate'):h('span','Повторите сохранение в открытой форме')].filter(Boolean));if(conflict)remotePending=true;say(e.message,true); throw e; }
    finally { busy=false;updateHistoryControls();if(remotePending)queueMicrotask(()=>refreshSharedDocument());if(awardsRefreshPending){awardsRefreshPending=false;queueMicrotask(refreshAwards);} }
  }
  const run = (fn,opts) => change(fn,opts).catch(()=>{});
  async function undo(redo=false){
    const entry=history.peek(redo);
    if(!entry||busy||editor||document.querySelector('dialog[open]'))return;
    try{
      await change(d=>{history.applyTo(d,redo);M.record(d,'undo',{id:'application',name:(redo?'Повтор: ':'Отмена: ')+entry.label});},{undoable:false,retryable:false,historyStep:redo?'redo':'undo'});
      // Show the affected section so a global action never changes a hidden plan.
      if(entry.spaceId&&M.getSpace(doc,entry.spaceId)&&entry.spaceId!==activeSpace().id)selectSpace(entry.spaceId);
      if(view!==entry.section){focusId=null;focusTrail=[];selectedSection=null;sceneMemory=null;go(entry.section);}
      say((redo?'Повторено: ':'Отменено: ')+entry.label,false,!redo);
    }catch{}
  }
  const currentPlace = () => M.getNode(doc,place) || activeRooms()[0] || M.getNode(doc,M.UNPLACED_ID) || doc.nodes.find(n=>n.kind==='room');
  function rememberSection(){sectionState.set(view,{spaceId:activeSpaceId,place,query,category,collection,condition,roomFilter,sort,detailId,scroll:content.scrollTop});}
  function go(page){rememberSection();locatedId=null;view=page;const saved=sectionState.get(page);if(page==='space'&&saved?.spaceId&&saved.spaceId!==activeSpaceId)selectSpace(saved.spaceId);({place=null,query='',category='',collection='',condition='',roomFilter='',sort='name',detailId=null}=saved||{});if(page==='unplaced')place=M.UNPLACED_ID;searchInput.value=query;selected.clear();draw();content.scrollTop=saved?.scroll||0;if(page==='personal-metrics')personalMetrics.maybePrompt();recordAwardVisit();}
  const open = n => {if(!n)return;if(!M.canStore(n)){details(n);return;}
    if(view==='unplaced'){place=n.id;selected.clear();detailId=null;detailsPane.hidden=true;draw(true);return;}
    if(automobile.openNode(n.id)){go('automobile');return;}followSpace(n);
    locatedId=null;
    if(isBasicSection(n)){const parent=M.getNode(doc,n.parentId);if(world&&view==='space'&&spaceMode==='3d'){if(parent&&focusId!==parent.id)enterStorage(parent);selectStorageSection(n.id);return;}rememberSection();view='space';place=n.id;focusId=parent?.id||null;selectedSection=n.id;focusTrail=[];draw();return;}
    if(world&&view==='space'&&spaceMode==='3d'&&!n.virtual){
      if(n.kind==='room'){focusId=null;focusTrail=[];selectedSection=null;place=n.id;renderedPlace=place;world.focus({kind:'room',id:n.roomId});resetFocusUI();fillStorage(storagePane);return;}
      if(focusId&&n.parentId===focusId&&isBasicSection(n)){selectStorageSection(n.id);return;}
      enterStorage(n);return;
    }
    rememberSection();place=n.id;view=n.id===M.UNPLACED_ID?'unplaced':'space';query='';searchInput.value='';detailId=null;focusId=n.kind==='room'?null:n.id;focusTrail=[];selectedSection=null;draw();
  };
  function anchorFor(n){for(let a=n;a;a=M.getNode(doc,a.parentId)){if(a.furnitureId&&activePlan().furniture.some(f=>f.id===a.furnitureId))return a;}return null;}
  function showOnPlan(nodeId){
    if(editor)return;
    const node=M.getNode(doc,nodeId);if(automobile.openNode(nodeId)){go('automobile');return;}const target=planLocation(doc,nodeId);
    if(target.reason){say(target.reason,true);return;}
    followSpace(node);rememberSection();clearWorld();sceneMemory=null;
    locatedId=nodeId;view='space';spaceMode='3d';localStorage.setItem('iv:space-mode','3d');
    query='';searchInput.value='';selected.clear();detailId=null;detailsPane.hidden=true;
    place=target.roomId;focusId=null;focusTrail=[];selectedSection=null;draw();
    // The new world starts at the apartment view; the existing camera rig
    // animates from there to the actual furniture, including its real section.
    if(world&&target.anchorId){
      focusTrail.push({focusId:null,place:target.roomId,selectedSection:null,camera:world.cameraSnapshot()});
      if(target.focusId!==target.anchorId)focusTrail.push({focusId:target.anchorId,place:target.anchorId,selectedSection:null});
      selectedSection=target.sectionId;renderStorageFocus(M.getNode(doc,target.focusId));
    }
    place=target.placeId;renderedPlace=place;fillStorage(storagePane);
    const row=[...storagePane.querySelectorAll('[data-node-id]')].find(el=>el.dataset.nodeId===nodeId);
    const list=row?.closest('.iv-storage-list');
    if(list)list.scrollTo({top:list.scrollTop+row.getBoundingClientRect().top-list.getBoundingClientRect().top,behavior:reducedMotion()?'auto':'smooth'});
    content.scrollTop=0;
    if(!world)say('3D сейчас недоступно. Место вещи показано в списке: '+index().address(node),true);
    else if(target.note)say(target.note);
  }
  function resetFocusUI(){focusSignature=null;if(!sceneUI)return;sceneUI.scene.classList.remove('is-focused');sceneUI.labels.replaceChildren();sceneUI.bar.replaceChildren();}
  function renderStorageFocus(n){
    if(!world||!sceneUI)return false;const anchor=anchorFor(n);if(!anchor)return false;
    const shape=activePlan().furniture.find(f=>f.id===anchor.furnitureId),container=n.id!==anchor.id&&!n.kitchenModule&&!n.fridgeChamber;
    const openable=container||OPENABLE_TYPES.has(shape.type),zones=openable?(n.fridgeChamber&&!storageChildren(doc,n.id).length?[]:layoutZones(doc,n.id)):[];
    const signature=JSON.stringify([n.id,n.name,zones,selectedSection]);
    if(focusSignature===signature){focusId=n.id;return true;}
    focusSignature=signature;
    const labels=new Map();sceneUI.labels.replaceChildren(...zones.map(z=>{const b=button(z.name,()=>selectStorageSection(z.nodeId),nodeIcon(M.getNode(doc,z.nodeId)||n));b.className='iv-zone-label';b.dataset.fullLabel=z.name;if(z.fridgeChamber){b.classList.add('iv-fridge-label');b.dataset.shortLabel={cooling:'Холодильник',freezer:'Морозилка',fresh:'Свежесть'}[z.fridgeChamber];b.title=z.name;}if(z.moduleKey){b.classList.add('iv-cabinet-label');b.dataset.shortLabel=(KITCHEN_MODULE_TYPES[z.moduleType||'cabinet']?.short||'Шкаф')+' '+(Number(z.moduleKey.split(':')[1])+1);b.title=z.name;}b.classList.toggle('active',z.nodeId===selectedSection);b.setAttribute('aria-label',(z.moduleKey||z.fridgeChamber?'Открыть: ':'Секция: ')+z.name);b.hidden=true;labels.set(z.nodeId,b);return b;}));sceneUI.zoneButtons=labels;
    sceneUI.scene.classList.add('is-focused');sceneUI.scene.classList.toggle('no-motion',reducedMotion());
    sceneUI.bar.replaceChildren(button('Назад',leaveStorage,'back'),h('strong',n.name),openable?button(n.fridgeChamber||n.modelType==='fridge'?'Настроить холодильник':isSection(n)&&!n.kitchenModule?'Тип секции':n.kitchenModule&&!KITCHEN_MODULE_TYPES[n.kitchenModuleType||'cabinet']?.storage?'Тип модуля':'Секции',()=>editStorageLayout(n),'sliders'):h('span.iv-muted','Место хранения'));
    world.openStorage({id:anchor.furnitureId,zones,openable,container,selectedId:selectedSection,moduleKey:n.kitchenModule||null,chamberKey:n.fridgeChamber||null});
    focusId=n.id;return true;
  }
  function enterStorage(n){
    const previous={focusId,place,selectedSection,camera:world?.cameraSnapshot()};
    selectedSection=null;
    if(!renderStorageFocus(n)){place=n.id;renderedPlace=place;fillStorage(storagePane);return;}
    if(previous.focusId!==n.id)focusTrail.push(previous);place=n.id;renderedPlace=place;fillStorage(storagePane);
  }
  function selectStorageSection(id){const n=M.getNode(doc,id);if(!n)return;if((n.kitchenModule||n.fridgeChamber)&&focusId!==id){enterStorage(n);return;}selectedSection=id;place=id;renderedPlace=place;world?.selectSection(id);for(const [key,b]of sceneUI?.zoneButtons||[])b.classList.toggle('active',key===id);fillStorage(storagePane);}
  function leaveStorage(){
    if(!world||!focusId)return;const prev=focusTrail.pop();
    focusId=prev?.focusId||null;place=prev?.place||roomOf(M.getNode(doc,place))?.id||null;selectedSection=prev?.selectedSection||null;
    if(focusId&&M.getNode(doc,focusId))renderStorageFocus(M.getNode(doc,focusId));else{world.closeStorage();resetFocusUI();world.focus(place?{kind:'room',id:M.getNode(doc,place)?.roomId}:null);}
    renderedPlace=place;if(prev?.camera)world.restoreCamera(prev.camera,false);fillStorage(storagePane);
  }

  function drawNav() {
    const inventoryActive=['overview','space','catalog','item-master','categories','unplaced','archive'].includes(view);
    const primary=h('div.iv-main-sections',{'aria-label':'Основные разделы'},
      button('Инвентарь',()=>go('overview'),'box',inventoryActive?'active':''),automobileNav(),
      button('Походы и отпуска',()=>go('travel'),'map',view==='travel'?'active':''),
      button('Личные метрики',()=>go('personal-metrics'),'activity',view==='personal-metrics'?'active':''),
      button('Мониторинг квартиры',()=>go('monitoring'),'homeassistant',view==='monitoring'?'active':''));
    const inventoryNav=h('div.iv-inventory-subnav',{'aria-label':'Разделы инвентаря',hidden:!inventoryActive});
    for(const [key,label,glyph]of [['overview','Общая сводка','home'],['space','Пространство','map'],['catalog','Все вещи','box'],['item-master','Мастер предметов','sparkles'],['categories','Категории','list'],['unplaced','Без места','unplaced'],['archive','Архив','folder']]){
      inventoryNav.append(button(label,()=>go(key),glyph,view===key?'active':''));
      if(key==='space')inventoryNav.append(h('div.iv-space-nav',{'aria-label':'Мои пространства'},...M.listSpaces(doc).map(s=>button(s.name,()=>{selectSpace(s.id);view='space';query='';searchInput.value='';draw();},s.type==='garage'?'car':s.type==='work'?'sliders':'home',view==='space'&&s.id===activeSpace().id?'active':''))));
    }
    nav.replaceChildren(primary,inventoryNav);
    secondaryNav.replaceChildren(button('Редактор пространства',openEditor,'sliders'),...[['settings','Настройки','gear'],['trash','Корзина','trash'],['history','История','clock'],['awards','Награды','trophy']].map(([key,label,glyph])=>button(label,()=>go(key),glyph,view===key?'active':'')));
    for(const b of [...nav.querySelectorAll('button'),...secondaryNav.querySelectorAll('button'),...root.querySelectorAll('.iv-whats-new')]){const label=b.textContent.replace(/NEW$/,'').trim();b.title=label;b.setAttribute('aria-label',label);}
  }
  function automobileNav(){
    const b=button('Автомобиль',()=>go('automobile'),'car',view==='automobile'?'active':'');let timer=0;
    b.ondragover=e=>{if(e.dataTransfer.types.includes('application/x-inventory-node')){e.preventDefault();b.classList.add('iv-drop');if(!timer&&view!=='automobile')timer=setTimeout(()=>go('automobile'),650);}};
    b.ondragleave=()=>{clearTimeout(timer);timer=0;b.classList.remove('iv-drop');};
    b.ondrop=e=>{e.preventDefault();clearTimeout(timer);b.classList.remove('iv-drop');const c=automobile.activeCar;if(!c){say('Сначала добавьте автомобиль',true);return;}const target=doc.nodes.find(n=>n.parentId===c.rootId&&n.carCompartment==='trunk');if(target)automobile.dropTarget(b,target.id).ondrop(e);};return b;
  }
  function sceneSignature(){return JSON.stringify([activePlan(),doc.nodes.filter(n=>n.furnitureId&&n.archived).map(n=>n.furnitureId),appearance.prefs.theme,reducedMotion()]);}
  function clearWorld() { if(sceneUI){clearTimeout(sceneUI.weatherTimer);sceneUI.weatherFx?.dispose();}if(world)sceneMemory={...world.cameraSnapshot?.(),place:renderedPlace};resize?.disconnect();resize=null;world?.dispose();world=null;worldSignature=null;focusSignature=null;sceneUI=null; }
  function draw(preserveScroll=false) {
    monitoring.dispose();automobile.dispose();travel.dispose();
    content.classList.toggle('im-content',view==='item-master');
    content.classList.toggle('tr-content',view==='travel');
    content.classList.toggle('au-content',view==='automobile');
    root.querySelector('.iv-shell')?.classList.toggle('is-automobile',view==='automobile');
    content.classList.toggle('mn-content',view==='monitoring');
    root.querySelector('.iv-shell')?.classList.toggle('is-monitoring',view==='monitoring');
    content.classList.toggle('pm-content',view==='personal-metrics');
    root.querySelector('.iv-shell')?.classList.toggle('is-personal-metrics',view==='personal-metrics');
    if(view==='monitoring'||view==='automobile'||view==='travel'||view==='personal-metrics'||view==='item-master')detailId=null;
    document.documentElement.dataset.inventoryMotion=reducedMotion()?'off':'on';
    content.classList.toggle('iv-home-content',view==='space'||view==='unplaced');
    content.classList.toggle('iv-catalog-compact',view==='catalog');
    content.classList.toggle('iv-categories-compact',view==='categories');
    clearTimeout(searchTimer);searchTimer=0;
    const scroll=content.scrollTop;
    closeActionMenu?.();closeActionMenu=null;
    if(view!=='space'||spaceMode!=='3d'||worldSignature!==sceneSignature())clearWorld();
    drawNav();
    if(view==='item-master')itemMaster.render(content);
    else if(view==='personal-metrics')personalMetrics.render(content);
    else if(view==='travel')travel.render(content);
    else if(view==='automobile')automobile.render(content);
    else if(view==='monitoring')monitoring.render(content);
    else if(view==='overview')drawOverview();
    else if(view==='space'||view==='unplaced')drawHome();
    else if(view==='catalog' || view==='archive') drawCatalog();
    else if(view==='categories')drawCategories();
    else if(view==='trash') drawTrash();
    else if(view==='history') drawHistory();
    else if(view==='awards') drawAwards();
    else drawSettings();
    drawDetails();if(preserveScroll)content.scrollTop=scroll;
  }
  function drawAwards(){
    let awards;
    try{awards=calculateAwards(doc,nativeSettings);}catch{content.replaceChildren(title('Награды','Достижения за порядок в доме'),empty('Пока не удалось пересчитать награды. Каталог и сохранение доступны.'));return;}
    renderAwards(content,awards,awardViewState);
  }
  function refreshAwards(){if(busy){awardsRefreshPending=true;return;}const changed=syncAwards({...doc,awards:structuredClone(doc.awards)},nativeSettings,{visitDay:document.hidden?null:awardToday()});if(changed)change(()=>{},{undoable:false,retryable:false}).catch(()=>{});else if(view==='awards')draw(true);}
  function recordAwardVisit(){
    if(document.hidden||doc.demoProfile)return;
    const day=awardToday();
    if(!Array.isArray(doc.awards?.activity)||!doc.awards.activity.some(r=>r.date===day))refreshAwards();
  }
  function showWhatsNew() {
    modal('Что нового',(body)=>body.append(h('p.iv-muted',`Life Assistant · текущая версия ${APP_VERSION}`),
      h('div.iv-releases',...releases.map((release,index)=>h('article.iv-card.iv-release',
        h('div.iv-release-heading',h('h2',`Версия ${release.version}`),index===0?h('span.iv-release-current','Текущая'):null,
          h('time',{datetime:release.date},displayDate(release.date))),
        h('h3',release.title),h('ul',...release.changes.map(text=>h('li',text))))))));
  }
  function title(name,sub,actions=[]) { return h('div.iv-heading',h('div',h('h1',name),h('p',sub)),h('div.iv-actions',...actions)); }
  function metric(label,value,glyph,sub) { return h('div.iv-metric',icon(glyph,22),h('div',h('small',label),h('strong',value),sub?h('span',sub):null)); }
  function fillPercent(n){return n?n.fill:M.apartmentFill(doc).value;}
  function fillMeter(n,mini=false){const value=fillPercent(n);return h(`div.iv-fill${mini?'.iv-fill-mini':''}`,h('span',`Заполненность: ${value==null?'не указана':value+'%'}`),h('progress',{max:100,value:value??0,'aria-label':`Заполненность ${n?.name||'квартиры'}: ${value==null?'не указана':value+'%'}`,class:value==null?'is-unknown':''}));}
  function configurePlace(n){if(n.kind==='room')editRoomIcon(n);else editFill(n);}
  function fillControl(n){const value=fillPercent(n),summary=!n?M.apartmentFill(doc):null;return h('div.iv-fill',h('div.iv-fill-label',h('span',`Заполненность ${value==null?'не указана':value+'%'}`),n?button('Настроить',()=>configurePlace(n),'sliders'):null),h('progress',{max:100,value:value??0,'aria-label':`Заполненность ${n?.name||'квартиры'}`,class:value==null?'is-unknown':''}),summary?h('small.iv-muted',`Среднее по комнатам · учтено ${summary.known} из ${summary.total}`):null);}
  function editFill(n){modal('Настройка — '+(n?.name||'вся квартира'),(body,close)=>{
    const amount=input(fillPercent(n),{type:'number',min:0,max:100,step:1,'aria-label':'Заполненность, %'}),disabled=input('',{type:'checkbox','aria-label':'Не быть хранилищем',checked:n?.storageEnabled===false});
    const refresh=()=>amount.disabled=n?.kind==='furniture'&&disabled.checked;disabled.onchange=refresh;refresh();
    body.append(h('p.iv-muted','Оцените физическую заполненность вручную, от 0 до 100%.'),field('Заполненность, %',amount));
    if(n?.kind==='furniture')body.append(h('label.if-storage-role',disabled,'Не быть хранилищем'),h('p.iv-muted','Объект останется на плане и в инвентаре. Перед отключением переместите его вещи в другое место.'));
    body.append(button('Сохранить',async()=>{const value=amount.value===''||disabled.checked?null:Number(amount.value);if(value!=null&&(!Number.isFinite(value)||value<0||value>100))return say('Укажите процент от 0 до 100',true);try{await change(d=>{if(n)M.updateNode(d,n.id,{fill:value,...(n.kind==='furniture'?{storageEnabled:!disabled.checked}:{})});else d.settings.apartmentFill=value;},{action:'Настройка мебели и хранения'});close();}catch{}},'check','primary'));
  });}
  function editFridge(n){modal(n.name==='Холодильник'?'Настройка холодильника':'Холодильник — '+n.name,(body,close)=>{
    const shape=M.planForNode(doc,n).furniture.find(f=>f.id===n.furnitureId),config=fridgeConfig(shape),installation=select(FRIDGE_INSTALLATIONS,config.installation,{'aria-label':'Тип холодильника'}),count=select([['1','1'],['2','2'],['3','3']],String(config.chambers),{'aria-label':'Количество отделений'}),freezer=select(FREEZER_POSITIONS,config.freezerPosition,{'aria-label':'Морозилка'}),preview=h('div.iv-grid-preview',{'aria-label':'Схема холодильника',style:{width:'130px',height:'190px'}}),notice=h('p.iv-muted'),error=h('p.iv-form-error',{role:'alert'});
    const options=()=>({installation:installation.value,chambers:Number(count.value),freezerPosition:freezer.value});
    function paint(){freezer.disabled=count.value==='1';preview.replaceChildren(...fridgeChambers({fridge:options()}).map(c=>h('span',{style:{left:'0',top:c.rect[1]*100+'%',width:'100%',height:c.rect[3]*100+'%'}},c.name)));notice.textContent=Number(count.value)!==config.chambers?'Прежние отделения перейдут в корзину, продукты останутся в холодильнике. Новые отделения будут пустыми; изменение можно отменить.':'Тип и положение морозилки можно изменить с сохранением продуктов. В однокамерном холодильнике отдельной морозилки нет.';}
    installation.onchange=count.onchange=freezer.onchange=paint;
    body.append(field('Тип холодильника',installation),h('div.iv-grid-controls',field('Отделения',count),field('Морозилка',freezer)),preview,notice,error,button('Сохранить',async()=>{try{if(focusId===n.id||M.getNode(doc,focusId)?.fridgeChamber){focusId=n.id;place=n.id;selectedSection=null;focusTrail=[];}await change(d=>M.configureFridge(d,n.id,options()));close();say('Настройки холодильника сохранены');}catch(e){error.textContent=e.message;}},'check','primary'));paint();
  });}
  function editKitchenModuleType(n){modal('Тип кухонного модуля',(body,close)=>{
    const type=select(kitchenTypeOptions(n.kitchenModule.split(':')[0]),n.kitchenModuleType||'cabinet',{'aria-label':'Тип кухонного модуля'}),error=h('p.iv-form-error',{role:'alert'});
    body.append(h('p',n.name),field('Тип модуля',type),h('p.iv-muted','При замене прежние секции перейдут в корзину, вещи сохранятся в месте хранения. Внешний вид изменится на плане и при открытии кухни. Действие можно отменить.'),error,button('Сохранить',async()=>{try{await change(d=>M.changeKitchenModuleType(d,n.id,type.value));close();say('Тип кухонного модуля сохранён');}catch(e){error.textContent=e.message;}},'check','primary'));
  });}
  function editStorageLayout(n){
    if(n.carCompartment&&carForNode(doc,n))return automobile.compartmentForm(n);const fridgeNode=n.fridgeChamber?M.getNode(doc,n.parentId):n;if(M.planForNode(doc,fridgeNode).furniture.some(f=>f.id===fridgeNode?.furnitureId&&f.type==='fridge')){editFridge(fridgeNode);return;}if(n.kitchenModule&&!KITCHEN_MODULE_TYPES[n.kitchenModuleType||'cabinet']?.storage){editKitchenModuleType(n);return;}modal(isSection(n)&&!n.kitchenModule?'Тип секции':'Секции — '+n.name,(body,close)=>{
    const error=h('p.iv-form-error',{role:'alert'}),shape=M.planForNode(doc,n).furniture.find(f=>f.id===n.furnitureId);
    if(isKitchenType(shape?.type)){
      const choices=[],list=h('div.iv-auto-sections');
      const saveTypes=async()=>{if(choices.some(c=>c.type.value!==(c.node.kitchenModuleType||'cabinet')))await change(d=>{for(const c of choices)M.changeKitchenModuleType(d,c.node.id,c.type.value);});};
      for(const child of storageChildren(doc,n.id).filter(c=>c.kitchenModule)){const type=select(kitchenTypeOptions(child.kitchenModule.split(':')[0]),child.kitchenModuleType||'cabinet',{'aria-label':'Тип модуля: '+child.name});choices.push({node:child,type});const sections=button('Секции',async()=>{try{await saveTypes();close();editStorageLayout(M.getNode(doc,child.id));}catch(e){error.textContent=e.message;}},'sliders');type.onchange=()=>{sections.hidden=!KITCHEN_MODULE_TYPES[type.value].storage;};type.onchange();list.append(h('div.iv-kitchen-module-row',h('strong',child.name),type,sections));}
      body.append(h('p.iv-muted','Выберите тип каждого модуля. Модель кухни изменится после сохранения. При замене прежние секции перейдут в корзину, вещи сохранятся в месте хранения.'),list,error,button('Сохранить',async()=>{try{await saveTypes();close();say('Типы кухонных модулей сохранены');}catch(e){error.textContent=e.message;}},'check','primary'));return;
    }
    if(isSection(n)&&!n.kitchenModule){const type=select(SECTION_KINDS,n.kind,{'aria-label':'Тип секции'});body.append(field('Тип секции',type),error,button('Сохранить',async()=>{try{await change(d=>M.changeSectionType(d,n.id,type.value));close();}catch(e){error.textContent=e.message;}},'check','primary'));return;}
    if(n.kitchenModule)body.append(button('Тип модуля: '+KITCHEN_MODULE_TYPES[n.kitchenModuleType||'cabinet'].name,()=>{close();editKitchenModuleType(n);},'sliders'));
    const children=storageChildren(doc,n.id),zones=layoutZones(doc,n.id),initialColumns=n.storageLayout?.columns||Math.max(1,new Set(zones.map(z=>z.rect[0])).size);
    const columns=select(Array.from({length:6},(_,i)=>[String(i+1),String(i+1)]),String(initialColumns),{'aria-label':'Столбцы по горизонтали'});
    const rowCount=select(Array.from({length:12},(_,i)=>[String(i+1),String(i+1)]),String(n.storageLayout?.rows||Math.ceil(Math.max(1,children.length)/initialColumns)),{'aria-label':'Строки по вертикали'});
    const list=h('div.iv-auto-sections'),preview=h('div.iv-grid-preview',{'aria-label':'Предпросмотр секций'}),types=[];
    const save=button('Сохранить',async()=>{try{await change(d=>M.setStorageGrid(d,n.id,{columns:Number(columns.value),rows:Number(rowCount.value),kinds:types.map(t=>t.value)}));close();say('Сетка и типы секций сохранены');}catch(e){error.textContent=e.message;}},'check','primary');
    function paint(){const cols=Number(columns.value),rows=Number(rowCount.value),count=cols*rows,values=types.map(t=>t.value);types.length=0;list.replaceChildren();preview.replaceChildren();preview.style.aspectRatio='1.4';
      const rects=sectionRects('grid',cols,rows,count);
      for(let i=0;i<count;i++){const kind=values[i]||children[i]?.kind||children.at(-1)?.kind||'shelf',type=select(SECTION_KINDS,kind,{'aria-label':'Тип секции '+(i+1)});types.push(type);list.append(h('div.iv-auto-section',h('strong','Секция '+(i+1)),type));const [x,y,w,hgt]=rects[i];preview.append(h('span',{style:{left:x*100+'%',top:y*100+'%',width:w*100+'%',height:hgt*100+'%'}},String(i+1)));}
      error.className=count<children.length?'iv-muted':'iv-form-error';error.textContent=count<children.length?`Будет ${plural(count,['секция','секции','секций'])} вместо ${children.length}. Прежние секции перейдут в корзину, вещи сохранятся в этом месте. Новая сетка будет пустой. Действие можно отменить.`:'';
    }
    columns.onchange=rowCount.onchange=paint;
    body.append(h('p.iv-muted','Выберите столбцы по горизонтали и строки по вертикали. Пространство делится на равные доли автоматически, без ввода размеров.'),h('div.iv-grid-controls',field('Столбцы ↔',columns),field('Строки ↕',rowCount)),preview,list,error,save);paint();
  });}
  function stats(){
    const t=index().totals(),today=new Date(),month=today.getFullYear()*12+today.getMonth();
    const active=doc.nodes.filter(n=>{if(n.archived||!n.createdAt)return false;const added=new Date(n.createdAt);return !Number.isNaN(added.getTime())&&added.getFullYear()*12+added.getMonth()===month;});
    const addedItems=active.filter(n=>['item','furniture'].includes(n.kind)).length;
    const addedStorage=active.filter(n=>n.kind!=='room'&&M.canStore(n)).length;
    const growth=(label,value,glyph,count)=>{const card=metric(label,value,glyph,`+${count} за месяц`);card.classList.add('iv-metric-growth');return card;};
    return h('div.iv-metrics',metric('Стоимость покупки',M.money(t.purchase),'box'),metric('Текущая оценка',M.money(t.current),'activity'),growth('Вещи',t.items,'box',addedItems),growth('Места хранения',t.storage,'folder',addedStorage));
  }
  function countText(nodeId){const t=index().totals(nodeId);return `${plural(t.items,['вещь','вещи','вещей'])} · ${plural(t.storage,['место хранения','места хранения','мест хранения'])}`;}
  function drawOverview(){
    const recent=doc.nodes.filter(n=>n.kind!=='room'&&!isSection(n)&&!n.archived).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,4);
    const rooms=doc.nodes.filter(n=>n.kind==='room'&&!n.virtual);
    const recentCard=h('section.iv-card',h('h2','Недавние вещи'),...(recent.length?recent.map(n=>h('div.iv-recent',nodeThumb(n),button(n.name,()=>details(n)),h('small.iv-muted',index().address(n)))):[empty('Добавьте первую вещь')]),button('Все вещи',()=>{go('catalog');sort='date';draw();},'next'));
    const carCards=automobileCars(doc).map(car=>h('div.iv-room-card.iv-car-summary',{'data-car-id':car.id},h('div.iv-room-card-heading',button(car.name,()=>{automobile.openNode(car.rootId);go('automobile');},'car')),h('small.iv-muted',countText(car.rootId)),h('button.iv-car-preview',{type:'button','aria-label':'Открыть автомобиль: '+car.name,onclick:()=>{automobile.openNode(car.rootId);go('automobile');}},icon('car',60))));
    content.replaceChildren(title('Общая сводка','Имущество, важные даты и последние вещи'),stats(),
      h('section.iv-card.iv-overview-fill',h('h2','Все пространства'),fillControl(null),h('div.iv-room-summary',...rooms.map(n=>h('div.iv-room-card',{'data-room-id':n.roomId,style:{borderColor:roomColor(n)+'80',backgroundColor:roomColor(n)+'22'}},h('div.iv-room-card-heading',button(n.name,()=>open(n),nodeIcon(n)),button('Настроить комнату',()=>editRoomIcon(n),'palette')),h('small.iv-muted',countText(n.id)),fillControl(n))))),
      h('div.iv-overview-grid',rarityChart(doc),categorySummary(),monthSummary()),
      h('div.iv-overview-grid',attention(),recentCard));
    content.querySelector('.iv-room-summary')?.append(...carCards);
    requestAnimationFrame(()=>{if(view!=='overview')return;const carImages=renderCarPreviews(automobileCars(doc));for(const card of carCards){const src=carImages.get(card.dataset.carId);if(src){card.style.backgroundImage=`linear-gradient(0deg,rgba(8,13,24,.45),rgba(8,13,24,.12)),url("${src}")`;card.classList.add('has-preview');card.querySelector('.iv-car-preview').replaceChildren();}}const excluded=doc.nodes.filter(n=>n.archived).map(n=>n.furnitureId).filter(Boolean),images=new Map(M.listSpaces(doc).flatMap(s=>[...renderRoomPreviews(s.plan,rooms.filter(n=>(n.spaceId||M.PRIMARY_SPACE_ID)===s.id).map(n=>n.roomId),excluded)]));for(const card of content.querySelectorAll('.iv-room-card')){const src=images.get(card.dataset.roomId);if(src){card.style.backgroundImage=`linear-gradient(0deg,rgba(8,13,24,.88),rgba(8,13,24,.38)),url("${src}")`;card.classList.add('has-preview');}}});
  }
  function editRoomIcon(n){modal('Настройка комнаты — '+n.name,(body,close)=>{
    const form=roomPresentationForm(n),amount=input(n.fill??'',{type:'number',min:0,max:100,step:1,'aria-label':'Заполненность, %'}),error=h('p.iv-form-error',{role:'alert'});
    const save=button('Сохранить',async()=>{
      const value=amount.value===''?null:Number(amount.value);
      if(value!=null&&(!Number.isFinite(value)||value<0||value>100)){error.textContent='Укажите заполненность от 0 до 100% или оставьте поле пустым.';return;}
      save.disabled=true;error.textContent='';
      try{await change(d=>{const target=M.getNode(d,n.id);form.apply(target);target.fill=value;const room=M.planForNode(d,n).rooms.find(r=>r.id===n.roomId);if(room)form.apply(room);});close();}
      catch(e){error.textContent=e.message;save.disabled=false;}
    },'check','primary');
    body.append(form.element,field('Заполненность, %',amount),h('p.iv-muted','Физическая заполненность комнаты. Пустое поле — значение не указано.'),error,save);
  });}

  function attention(){const due=M.dueItems(doc),loose=M.children(doc,M.UNPLACED_ID);return h('section.iv-card',h('h2','Требует внимания'),...(due.length?due.slice(0,8).map(x=>button(`${x.node.name} · ${x.key==='expiry'?'Срок годности':'Гарантия'} · ${x.days<0?'истёк':x.days===0?'сегодня':`через ${x.days} дн.`}`,()=>details(x.node),'clock')):[]),loose.length?button(`Без места · ${plural(index().totals(M.UNPLACED_ID).items,['вещь','вещи','вещей'])}`,()=>go('unplaced'),'folder'):null,!due.length&&!loose.length?h('p.iv-muted','Ближайших сроков и вещей без места нет'):null,...doc.nodes.filter(n=>n.kind==='room'&&!n.virtual&&!n.roomType).map(n=>button('Выбрать тип: '+n.name,()=>editRoomIcon(n),'home')),translationCandidates(doc.plan).length?button('Перевести стандартные названия…',translateNames,'list'):null,h('small.iv-muted',`Предупреждение за ${doc.settings.reminderDays} дн.`));}
  function breadcrumbs(n){const chain=[];for(let a=n;a;a=M.getNode(doc,a.parentId))chain.unshift(a);return h('nav.iv-breadcrumbs',{'aria-label':'Адрес хранения'},button(carForNode(doc,n)?'Автомобиль':M.spaceForNode(doc,n)?.name||'Пространство',()=>{if(automobile.openNode(n.id)){go('automobile');return;}followSpace(n);place=null;view='space';draw();},carForNode(doc,n)?'car':'home'),...chain.flatMap(a=>[h('span','›'),button(a.name,()=>a.kind==='item'?details(a):open(a),nodeIcon(a))]));}
  function storageTree(){const tree=h('section.iv-tree',{'aria-label':'Дерево мест хранения'}),needle=input('',{type:'search',placeholder:'Найти место…','aria-label':'Поиск в дереве'}),branches=h('div.iv-tree-branches');
    const expanded=new Set(JSON.parse(localStorage.getItem('iv:tree-expanded')||'[]'));for(let a=M.getNode(doc,place);a;a=M.getNode(doc,a.parentId))expanded.add(a.id);
    function paint(){const q=needle.value.trim().toLocaleLowerCase('ru');function branch(n,depth=0){const nested=M.children(doc,n.id).filter(M.canStore);const match=!q||index().address(n).toLocaleLowerCase('ru').includes(q)||M.descendants(doc,n.id).some(x=>M.canStore(x)&&x.name.toLocaleLowerCase('ru').includes(q));if(!match)return null;const group=h('div.iv-tree-branch'+(n.id===M.UNPLACED_ID?'.iv-tree-unplaced':''));const toggle=button(nested.length?(expanded.has(n.id)||q?'−':'+'):'·',()=>{expanded.has(n.id)?expanded.delete(n.id):expanded.add(n.id);localStorage.setItem('iv:tree-expanded',JSON.stringify([...expanded]));paint();});toggle.setAttribute('aria-label','Развернуть: '+n.name);if(!nested.length)toggle.disabled=true;const row=h('div.iv-tree-row',{style:{paddingLeft:depth*12+'px'}},toggle,button(view==='unplaced'&&n.kind==='room'&&!n.virtual?index().address(n):n.name,()=>open(n),nodeIcon(n),place===n.id?'active':''));dropTarget(row,n.id);group.append(row);if(expanded.has(n.id)||q)group.append(...nested.map(x=>branch(x,depth+1)).filter(Boolean));return group;}const roots=view==='unplaced'?[M.getNode(doc,M.UNPLACED_ID),...doc.nodes.filter(n=>n.kind==='room'&&n.id!==M.UNPLACED_ID)].filter(Boolean):activeRooms();branches.replaceChildren(...roots.map(n=>branch(n)).filter(Boolean));}
    needle.oninput=paint;tree.append(h('h2','Места хранения'),needle,branches);paint();return tree;
  }
  function spaceSwitcher(){
    return h('div.iv-actions.iv-space-switcher',button('Добавить пространство',()=>spaceDialog(),'plus'),button('Настроить пространство',()=>spaceDialog(activeSpace()),'sliders'));
  }
  function spaceDialog(existing=null){modal(existing?'Настроить пространство':'Добавить пространство',(body,close)=>{
    const name=input(existing?.name||'',{required:true,maxlength:200,placeholder:'Например, Гараж','aria-label':'Название пространства'}),type=select(M.SPACE_TYPES,existing?.type||'apartment',{'aria-label':'Тип пространства'}),error=h('p.iv-form-error',{role:'alert'});
    const save=button(existing?'Сохранить':'Добавить',async()=>{save.disabled=true;try{let id=existing?.id;await change(d=>{if(id)M.updateSpace(d,id,{name:name.value,type:type.value});else id=M.addSpace(d,{name:name.value,type:type.value});},{action:existing?'Настройка пространства':'Добавление пространства'});close();selectSpace(id);view='space';draw();}catch(e){error.textContent=e.message;save.disabled=false;}},'check','primary');
    body.append(field('Название',name),field('Тип',type),h('p.iv-muted','Вещи, категории и поиск общие. У каждого пространства — свой план и комнаты.'),error,save);name.focus();
  });}
  function weatherCityDialog(){
    const spaceId=activeSpace().id,current=doc.settings.weatherLocations?.[spaceId];
    modal('Погода — '+activeSpace().name,(body,close)=>{
      const city=input(current?.name||'',{type:'search',placeholder:'Введите город','aria-label':'Город для погоды'}),results=h('div.iv-weather-cities'),error=h('p.iv-form-error',{role:'status'});let request=0;
      const choose=async value=>{try{await change(d=>{d.settings.weatherLocations={...d.settings.weatherLocations};if(value)d.settings.weatherLocations[spaceId]=value;else delete d.settings.weatherLocations[spaceId];},{action:'Город для погоды',retryable:false});close();}catch(e){error.textContent=e.message;}};
      const search=button('Найти город',async()=>{const token=++request;search.disabled=true;error.textContent='Поиск города…';try{const cities=await findWeatherCities(city.value);if(token!==request||!results.isConnected)return;results.replaceChildren(...cities.map(c=>button(c.label,()=>choose(c),'home')));error.textContent=cities.length?'':'Город не найден. Уточните название.';}catch{error.textContent='Не удалось найти город. Проверьте подключение и повторите.';}finally{search.disabled=false;}},'search');
      city.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search.click();}};
      body.append(...[h('p.iv-muted','Город задаётся отдельно для каждого пространства.'),field('Город',city),search,results,error,current?button('Отключить погоду',()=>choose(null),'close'):null,h('p.iv-muted',h('a',{href:'https://open-meteo.com/',target:'_blank',rel:'noopener noreferrer'},'Погода: Open-Meteo'), ' · Поиск городов: GeoNames.')].filter(Boolean));city.focus();
    });
  }
  function refreshSceneWeather(ui=sceneUI){
    if(!ui?.weather)return;clearTimeout(ui.weatherTimer);
    const city=doc.settings.weatherLocations?.[activeSpace().id];
    if(!validWeatherCity(city)){ui.weather.textContent='Указать город';ui.weather.title='Настроить погоду';ui.weather.setAttribute('aria-label','Указать город для погоды');ui.weather.classList.remove('is-stale');ui.weatherFx.setWeather(null);ui.weatherKey=null;return;}
    const key=city.latitude+','+city.longitude;ui.weatherKey=key;
    const paint=(value,stale=false)=>{if(sceneUI!==ui||ui.weatherKey!==key)return;ui.weather.textContent=(value.temperature>0?'+':'')+Math.round(value.temperature)+'°';ui.weather.title=city.name+' · '+weatherDescription(value.code)+(stale?' · сохранённые данные, обновить не удалось':' · '+new Date(value.fetchedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}));ui.weather.setAttribute('aria-label',ui.weather.title+' · '+ui.weather.textContent);ui.weather.classList.toggle('is-stale',stale);ui.weatherFx.setWeather(value);};
    const cached=weatherService.cached(city);if(cached)paint(cached,Date.now()-cached.fetchedAt>=WEATHER_TTL);else {ui.weather.textContent='Погода…';ui.weatherFx.setWeather(null);}
    weatherService.current(city).then(value=>paint(value)).catch(()=>{if(sceneUI!==ui||ui.weatherKey!==key)return;if(cached)paint(cached,true);else {ui.weather.textContent='Погода недоступна';ui.weather.title='Нажмите, чтобы проверить город';ui.weatherFx.setWeather(null);}}).finally(()=>{if(sceneUI===ui&&ui.weatherKey===key){clearTimeout(ui.weatherTimer);ui.weatherTimer=setTimeout(()=>{if(!document.hidden)refreshSceneWeather(ui);},WEATHER_TTL);};});
  }
  function drawHome(){
    const unplaced=view==='unplaced';if(unplaced&&!M.getNode(doc,place))place=M.UNPLACED_ID;
    const rooms=unplaced?null:h('div.iv-room-tabs',button('Всё пространство',()=>{focusId=null;focusTrail=[];selectedSection=null;place=null;view='space';sceneMemory=null;draw();},'home',!place?'active':''),...activeRooms().map(n=>button(n.name,()=>{focusId=null;focusTrail=[];selectedSection=null;place=n.id;sceneMemory=null;draw();},nodeIcon(n),place===n.id?'active':'')));
    const modes=h('div.iv-actions',...(!unplaced?[button('3D + содержимое',()=>{spaceMode='3d';localStorage.setItem('iv:space-mode',spaceMode);draw();},'map',spaceMode==='3d'?'active':''),button('Дерево + содержимое',()=>{spaceMode='tree';localStorage.setItem('iv:space-mode',spaceMode);draw();},'list',spaceMode==='tree'?'active':'')]:[]));
    if(unplaced)modes.append(button('Импорт из Excel',importExcel,'upload'));
    const pane=h('section.iv-storage'+(unplaced?'.iv-storage-unplaced':''));storagePane=pane;fillStorage(pane);
    content.replaceChildren(title(unplaced?'Без места':activeSpace().name,unplaced?'Распределите вещи по комнатам и местам хранения':'План пространства и содержимое мест хранения',[...modes.children]),...(!unplaced?[spaceSwitcher(),rooms]:[]));
    if(spaceMode==='tree'||unplaced){content.append(h('div.iv-home-grid.iv-tree-mode',storageTree(),pane));return;}
    if(world&&sceneUI){
      refreshSceneWeather();content.append(h('div.iv-home-grid',sceneUI.scene,pane));
      const chosen=M.getNode(doc,focusId)||M.getNode(doc,place);
      if(chosen&&chosen.kind!=='room'&&anchorFor(chosen))renderStorageFocus(chosen);
      else if(focusId||renderedPlace!==place){focusId=null;resetFocusUI();const room=roomOf(chosen);world.focus(room?.roomId?{kind:'room',id:room.roomId}:null);}
      renderedPlace=place;return;
    }
    const canvas=h('canvas.iv-model-canvas',{'aria-label':'Интерактивная 3D-планировка пространства'}),weather=button('Указать город',weatherCityDialog,null,'iv-weather-chip'),hover=h('span.iv-scene-hover');
    const labels=h('div.iv-focus-labels'),bar=h('div.iv-focus-bar');const scene=h('section.iv-scene',h('div.iv-scene-title',h('span',activePlan().name),hover),canvas,weather,h('div.iv-scene-vignette'),labels,bar,h('div.iv-scene-hint','Перетащите для вращения · колесо для масштаба · нажмите на мебель'));sceneUI={scene,labels,bar,weather,weatherFx:createWeatherScene(scene,{reducedMotion:reducedMotion(),theme:appearance.prefs.theme}),zoneButtons:new Map()};
    content.append(h('div.iv-home-grid',scene,pane));const cfg=normalize(structuredClone(activePlan()));cfg.inventoryPicking=true;cfg.furniture=cfg.furniture.filter(f=>!doc.nodes.find(n=>n.furnitureId===f.id)?.archived);
    const state={lights:{},acs:{}};for(const l of cfg.lights)state.lights[l.id]={on:true,brightness:.72,temp:3200,color:l.color||null};for(const a of cfg.acs)state.acs[a.id]={on:false,mode:'cool',fan:'auto',swing:'off',sleep:false,target:23};
    try{world=createWorld(canvas,cfg,{state,on:()=>()=>{}},{reduceMotion:reducedMotion(),exterior:true,onBackdropMask:points=>sceneUI?.weatherFx.setMask(points),background:appearance.prefs.theme==='light'?'#e4edf6':'#0b1423',onZones:anchors=>{if(!sceneUI)return;for(const a of anchors){const b=sceneUI.zoneButtons.get(a.nodeId);if(b){b.hidden=!a.visible;b.style.left=a.x+'px';b.style.top=a.y+'px';const zoneWidth=Math.min(a.moduleKey?90:150,Math.max(28,a.screenWidth*.86));b.style.width=zoneWidth+'px';b.style.fontSize=zoneWidth<(b.classList.contains('iv-fridge-label')?110:60)?'10px':'12px';if(b.dataset.shortLabel){b.classList.toggle('is-narrow',zoneWidth<55);b.lastChild.textContent=zoneWidth<55?b.dataset.shortLabel.match(/\d+$/)?.[0]||b.dataset.shortLabel:b.dataset.shortLabel;};b.style.height=Math.min(a.moduleKey?32:44,Math.max(28,a.screenHeight*.65))+'px';}}},onHover:t=>{const n=t?.kind==='furniture'?doc.nodes.find(n=>n.furnitureId===t.id):null;hover.textContent=n?.name||'';if(sceneUI){sceneUI.weather.hidden=Boolean(t);sceneUI.scene.classList.toggle('is-object-hover',Boolean(t));}},onPick:t=>{if(t?.kind==='section'){selectStorageSection(t.id);return;}const n=t?.kind==='room'?doc.nodes.find(n=>n.roomId===t.id):t?.kind==='furniture'?doc.nodes.find(n=>n.furnitureId===t.id):null;if(n)open(n);}});
      worldSignature=sceneSignature();refreshSceneWeather();
      world.setInsets(36,20);world.setRunning(!document.hidden);sceneUI.weatherFx.setRunning(!document.hidden);
      const chosen=M.getNode(doc,focusId)||M.getNode(doc,place);
      if(chosen&&chosen.kind!=='room'&&anchorFor(chosen)){renderStorageFocus(chosen);if(sceneMemory?.place===place)world.restoreCamera(sceneMemory);}
      else if(sceneMemory?.place===place&&sceneMemory.focus?.kind!=='furniture')world.restoreCamera(sceneMemory);
      else{const room=roomOf(M.getNode(doc,place));if(room?.roomId)world.focus({kind:'room',id:room.roomId});}
      renderedPlace=place;resize=new ResizeObserver(()=>world?.resize());resize.observe(canvas);
    }catch(e){console.warn('Не удалось открыть 3D-сцену',e);scene.append(h('div.iv-3d-error','3D недоступно. Все вещи доступны в списке справа.'));}
  }
  function roomOf(n){let a=n;while(a&&a.kind!=='room')a=M.getNode(doc,a.parentId);return a;}
  function storageDropAllowed(ids,destination){
    const target=M.getNode(doc,destination);if(!target||target.archived||!M.canStore(target))return false;
    if(!ids.some(id=>M.getNode(doc,id)?.parentId!==destination))return false;
    return !ids.some(id=>id===destination||M.descendants(doc,id).some(n=>n.id===destination));
  }
  async function moveDroppedNodes(ids,destination){
    if(!storageDropAllowed(ids,destination))return;
    const roots=ids.filter(id=>!ids.some(other=>other!==id&&M.descendants(doc,other).some(n=>n.id===id)));
    const containers=roots.map(id=>M.getNode(doc,id)).filter(n=>n&&n.kind!=='item'&&M.children(doc,n.id).length);
    if(containers.length&&!confirm(containers.length===1?`Переместить «${containers[0].name}» вместе со всем содержимым?`:`Переместить ${containers.length} контейнеров вместе с содержимым?`))return;
    try{await change(d=>moveAutomobileItems(d,ids,destination),{action:'Перемещение выбранных вещей',retryable:false});say(`Перемещено: ${roots.length} · ${M.getNode(doc,destination)?.name||'новое место'}`);}catch{}
  }
  function dropTarget(el,destination) {
    el.dataset.storageDestination=destination;
    el.ondragover=e=>{if(e.dataTransfer.types.includes('application/x-inventory-node')){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';el.classList.add('iv-drop');}};
    el.ondragleave=()=>el.classList.remove('iv-drop');
    el.ondrop=e=>{e.preventDefault();e.stopPropagation();el.classList.remove('iv-drop');const nodeId=e.dataTransfer.getData('application/x-inventory-node');if(!nodeId)return;
      try{const raw=e.dataTransfer.getData('application/x-inventory-nodes'),ids=raw?JSON.parse(raw):[nodeId];if(!Array.isArray(ids)||!ids.every(v=>typeof v==='string'))return;
        moveDroppedNodes(ids,destination);
      }catch(e){say(e.message,true);}
    };return el;
  }
  function draggable(el,n){
    if(n.kind==='room'||n.archived||view==='unplaced'&&(isSection(n)||n.carCompartment))return el;
    if(view==='unplaced')return bindStorageDrag(el,{root,getSelection:()=>busy?[]:selected.has(n.id)?[...selected]:[n.id],destinationAllowed:storageDropAllowed,move:moveDroppedNodes});
    el.draggable=true;el.addEventListener('dragstart',e=>{if(e.target?.matches?.('input')){e.preventDefault();return;}e.stopPropagation();e.dataTransfer.setData('application/x-inventory-node',n.id);e.dataTransfer.setData('application/x-inventory-nodes',JSON.stringify(selected.has(n.id)?[...selected]:[n.id]));e.dataTransfer.setData('text/plain',n.name);e.dataTransfer.effectAllowed='move';});return el;
  }
  function fillStorage(pane){
    const n=M.getNode(doc,place),nodes=n?M.children(doc,n.id):activeRooms(),totals=n?index().totals(n.id):activeRooms().reduce((sum,r)=>{const t=index().totals(r.id);for(const k of Object.keys(sum))sum[k]+=t[k];return sum;},{count:0,items:0,storage:0,purchase:0,current:0});
    const head=n?h('div',view==='unplaced'?null:breadcrumbs(n),h('h2',n.name)):h('div',h('h2','Комнаты и хранение'));
    const located=M.getNode(doc,locatedId),notice=located&&(located.parentId===place||located.id===place)?h('div.iv-location-result',{role:'status'},icon('camera',18),h('div',h('strong','Показано: '+located.name),h('small',index().address(located)))):null;
    pane.replaceChildren(...[notice,head,h('div.iv-storage-total',h('strong',(isSection(n)?'Содержимое: ':'')+M.money(totals.purchase)),h('small',isSection(n)?'Место хранения без собственной стоимости':n&&n.kind!=='room'?`Объект ${M.money(n.purchaseCents)} · содержимое ${M.money(totals.purchase-(n.purchaseCents||0))}`:n?countText(n.id):`${plural(totals.items,['вещь','вещи','вещей'])} · ${plural(totals.storage,['место хранения','места хранения','мест хранения'])}`)),(!n||!n.virtual)&&fillPercent(n)>0?fillControl(n):null,
      h('div.iv-actions',n?button('Добавить вещь',()=>editNode(null,{parentId:n.id}),'plus'):null,n&&!n.virtual&&!(fillPercent(n)>0)?button('Настроить',()=>configurePlace(n),'sliders'):null,n&&!n.virtual&&n.kind!=='room'&&!isSection(n)&&n.modelType!=='fridge'?button('Отсек',()=>editNode(null,{parentId:n.id,kind:'shelf'}),'folder'):null,n&&n.kind!=='room'?button('Карточка',()=>details(n),'next'):null,n&&n.kind!=='room'?actionsButton(n):null)].filter(Boolean));
    if(view==='unplaced'){
      const source=createLocationPicker({getDoc:()=>doc,value:n?.id||M.UNPLACED_ID,label:'Показать вещи из хранилища',onChange:id=>{place=id;selected.clear();detailId=null;detailsPane.hidden=true;draw(true);}});
      pane.prepend(h('div.iv-unplaced-source',field('Показать вещи из',source)));
    }
    if(view!=='unplaced'&&n&&n.kind!=='room'&&anchorFor(n))pane.append(h('div.iv-focus-actions.iv-actions',n.id!==focusId&&!isBasicSection(n)?button('Открыть внутри',()=>enterStorage(n),'box'):null,button(n.fridgeChamber||n.modelType==='fridge'?'Настроить холодильник':isSection(n)&&!n.kitchenModule?'Тип секции':n.kitchenModule&&!KITCHEN_MODULE_TYPES[n.kitchenModuleType||'cabinet']?.storage?'Тип модуля':'Секции',()=>editStorageLayout(n),'sliders')));
    if(view==='unplaced'){
      const movable=nodes.filter(child=>child.kind!=='room'&&!isSection(child)&&!child.carCompartment&&!child.archived),ids=new Set(movable.map(child=>child.id));
      for(const id of [...selected])if(!ids.has(id))selected.delete(id);
      const refresh=()=>{const offset=pane.querySelector('.iv-storage-scroll')?.scrollTop||0;fillStorage(pane);pane.querySelector('.iv-storage-scroll').scrollTop=offset;};
      const all=button(movable.length&&movable.every(child=>selected.has(child.id))?'Снять выделение':'Выделить все',()=>{if(movable.every(child=>selected.has(child.id)))selected.clear();else for(const child of movable)selected.add(child.id);refresh();},'check');all.disabled=!movable.length;
      const move=button('Переместить',()=>moveDialog([...selected]),'folder','primary');move.disabled=!selected.size;
      pane.append(h('div.iv-unplaced-bulk',h('span',`Выбрано: ${selected.size}`),all,move,selected.size&&!movable.every(child=>selected.has(child.id))?button('Снять выделение',()=>{selected.clear();refresh();},'close'):null),h('small.iv-unplaced-drag-hint','Перетащите карточки на место в дереве слева или выберите место кнопкой.'));
    }
    const list=h('div.iv-storage-list');for(const child of nodes){const main=button('',()=>open(child));main.className='iv-storage-open';main.replaceChildren(nodeThumb(child),h('span.iv-row-copy',h('strong',child.name),h('small',!M.canStore(child)?index().categoryName(child.categoryId)||'Вещь':countText(child.id))),h('span.iv-row-price',isSection(child)?(index().totals(child.id).purchase?M.money(index().totals(child.id).purchase)+' внутри':''):M.money(index().totals(child.id).purchase)));const row=draggable(h('div.iv-storage-row',{'data-node-id':child.id},main),child);if(child.id===locatedId){row.classList.add('is-located');main.setAttribute('aria-current','location');}row.oncontextmenu=e=>{if(child.kind!=='room'){e.preventDefault();showActions(child,row);}};
      if(view==='unplaced'&&child.kind!=='room'&&!isSection(child)&&!child.carCompartment&&!child.archived){
        const checkbox=h('input.iv-storage-select',{type:'checkbox','aria-label':`Выбрать ${child.name}`,onchange:e=>{e.target.checked?selected.add(child.id):selected.delete(child.id);const offset=pane.querySelector('.iv-storage-scroll')?.scrollTop||0;fillStorage(pane);pane.querySelector('.iv-storage-scroll').scrollTop=offset;},ondragstart:e=>{e.preventDefault();e.stopPropagation();}});
        checkbox.checked=selected.has(child.id);row.classList.toggle('is-selected',checkbox.checked);row.prepend(checkbox);
      }
      paintRarity(row,doc,child);
      if(child.kind==='item')main.querySelector('.iv-row-copy').append(rarityBadge(doc,child));
      const tripTags=travelTags(doc,child);if(tripTags)main.querySelector('.iv-row-copy').append(tripTags);
      if(M.canStore(child))dropTarget(row,child.id);
      main.title=child.name+' · '+(!M.canStore(child)?index().categoryName(child.categoryId)||'Вещь':countText(child.id));
      if(view!=='unplaced'&&child.kind!=='room'){const locate=button('',e=>{e.stopPropagation();showOnPlan(child.id);},'eye','iv-storage-locate');locate.title='Показать на 3D-плане';locate.setAttribute('aria-label','Показать на плане: '+child.name);row.append(locate);}
      if(child.kind!=='room'&&!isSection(child))row.append(wearIndicator(child));if(M.canStore(child)&&!child.virtual&&fillPercent(child)>0){row.classList.add('iv-storage-has-fill');row.append(fillMeter(child,true));}list.append(row);}
    if(!nodes.length)list.append(empty('Здесь пока пусто. Добавьте вещь или переместите её сюда.'));pane.append(h('div.iv-storage-scroll',list));if(n)dropTarget(pane,n.id);
  }
  function wearIndicator(n){
    const value=itemWear(n),label='Износ '+(value==null?'не указан':value+'%');
    return h('div.iv-wear-indicator',h('small',label),h('progress',{max:100,value:value??0,'aria-label':n.name+': '+label}));
  }
  function wearControl(n){
    const value=itemWear(n),caption=button('Износ '+(value==null?'—':value+'%')+(resolvedWearMode(n)!=='manual'?' · авто':''),()=>editWear(n),null,'iv-wear-caption');
    caption.setAttribute('aria-label','Настроить износ: '+n.name);
    const slider=input(value??0,{type:'range',min:0,max:100,step:1,'aria-label':'Износ: '+n.name});
    slider.oninput=()=>{caption.textContent='Износ '+slider.value+'%';};
    slider.onchange=()=>run(d=>M.updateNode(d,n.id,{wearMode:'manual',wear:Number(slider.value)}));
    const control=h('div.iv-wear',caption,slider);control.ondragstart=e=>{e.preventDefault();e.stopPropagation();};control.onpointerdown=e=>e.stopPropagation();return control;
  }
  function editWear(n){modal('Износ — '+n.name,(body,close)=>{
    const mode=select([['standard','Стандартно: от добавления, 36 месяцев'],['automatic','Своя дата покупки и срок'],['manual','Вручную']],resolvedWearMode(n),{'aria-label':'Способ расчёта износа'});
    const manual=input(itemWear(n)??0,{type:'range',min:0,max:100,step:1,'aria-label':'Ручной износ, %'}),percent=h('output',(itemWear(n)??0)+'%');
    const purchased=input(n.purchasedAt||'',{type:'date','aria-label':'Дата покупки для износа'}),life=input(n.usefulLifeMonths??'',{type:'number',min:1,max:1200,step:1,'aria-label':'Срок полезного использования, месяцев'});
    const preview=h('p.iv-muted'),error=h('p.iv-form-error',{role:'alert'});
    function refresh(){manual.disabled=mode.value!=='manual';purchased.disabled=life.disabled=mode.value!=='automatic';percent.textContent=manual.value+'%';const value=itemWear({...n,wearMode:mode.value,wear:Number(manual.value),purchasedAt:purchased.value,usefulLifeMonths:Number(life.value)});preview.textContent=value==null?'Укажите дату покупки и срок полезного использования.':'Текущий износ: '+value+'%.'+(mode.value==='standard'?' От даты добавления '+displayDate(wearSchedule({...n,wearMode:'standard'}).start||n.createdAt)+', срок — 36 месяцев.':mode.value==='automatic'?' По указанной дате покупки и сроку службы.':' Задан вручную.');}
    for(const el of [mode,manual,purchased,life])el.addEventListener('input',refresh);
    body.append(field('Способ расчёта',mode),field('Износ вручную',manual),percent,field('Дата покупки',purchased),field('Срок полезного использования, месяцев',life),preview,error,button('Сохранить',async()=>{
      const props={wearMode:mode.value,wear:Number(manual.value),purchasedAt:purchased.value,usefulLifeMonths:life.value===''?null:Number(life.value)};
      try{validateWear({...n,...props});await change(d=>M.updateNode(d,n.id,props));close();}catch(e){error.textContent=e.message;}
    },'check','primary'));refresh();
  });}
  function nodeThumb(n){return nodeThumbnail(doc,n);}
  function actionsButton(n){const el=button('',e=>{e.stopPropagation();showActions(n,el);},'more','iv-more');el.setAttribute('aria-label',`Действия: ${n.name}`);el.title='Действия';return el;}
  function showActions(n,anchor){
    closeActionMenu?.();
    if(view==='unplaced'&&selected.has(n.id)&&selected.size>1){
      const ids=[...selected];
      closeActionMenu=openMenu(menuHost,anchor,[{label:`Переместить выбранные (${ids.length})`,icon:icon('folder',15),action:()=>moveDialog(ids)},{label:'Снять выделение',icon:icon('close',15),action:()=>{selected.clear();fillStorage(storagePane);}}]);return;
    }
    const items=[{label:'Открыть карточку',icon:icon('next',15),action:()=>details(n)}];
    if(n.archived)items.push({label:'Вернуть из архива',icon:icon('undo',15),action:()=>restoreDialog(n)});
    else {items.push({label:'Редактировать',icon:icon('sliders',15),action:()=>editNode(n)});if(!isSection(n))items.push({label:'Переместить',icon:icon('folder',15),action:()=>moveDialog([n.id])},{label:'В архив',icon:icon('folder',15),action:()=>archiveDialog(n)});}
    if(n.kind==='furniture'&&!n.archived)items.push({label:n.furnitureId?'Убрать с плана':'Разместить на плане',icon:icon('map',15),action:()=>n.furnitureId?detachFromPlan(n):openEditor(n.id)});
    items.push('-',{label:'Удалить в корзину',icon:icon('trash',15),action:()=>deleteDialog(n)});
    closeActionMenu=openMenu(menuHost,anchor,items);
  }
  function categorySummary(){const roots=doc.categories.filter(c=>!c.parentId).sort((a,b)=>a.name.localeCompare(b.name,'ru'));return h('section.iv-card',h('h2','По категориям'),...roots.map(c=>{const label=index().categoryName(c.id);const count=doc.nodes.filter(n=>!n.archived&&n.kind!=='room'&&!isSection(n)&&(index().categoryName(n.categoryId)===label||index().categoryName(n.categoryId).startsWith(label+' / '))).length;return count?button(`${c.name} · ${count}`,()=>{go('catalog');category=c.id;draw();},categoryAppearance(doc,c.id).glyph):null;}));}
  function reminders(){const due=M.dueItems(doc);return h('section.iv-card',h('h2','Важные даты'),...(due.length?due.slice(0,8).map(x=>button(`${x.node.name} · ${x.key==='expiry'?'Срок годности':'Гарантия'} · ${x.days<0?'истёк':x.days===0?'сегодня':`через ${x.days} дн.`}`,()=>details(x.node),'clock')):[h('p.iv-muted','Ближайших сроков нет')]),h('small.iv-muted',`Предупреждение за ${doc.settings.reminderDays} дн.`));}
  function monthSummary(){const months=new Map();for(const e of doc.events){if(isSection(M.getNode(doc,e.nodeId))||['Изменено количество секций','Изменен тип кухонного модуля','Изменено количество отделений холодильника'].includes(e.reason)||!['purchase','archive'].includes(e.type))continue;const m=(e.effectiveDate||e.date).slice(0,7);if(!months.has(m))months.set(m,{purchase:0,sale:0,writeoff:0});const v=months.get(m);if(e.type==='purchase')v.purchase+=e.purchaseCents||0;else if(e.reason==='Продано')v.sale+=e.saleCents||0;else v.writeoff+=e.purchaseCents||0;}return h('section.iv-card',h('h2','Покупки, продажи, списания'),...([...months.keys()].sort().reverse().slice(0,6).map(m=>{const v=months.get(m);return h('div.iv-month',h('strong',m),h('span',`Покупки ${M.money(v.purchase)}`),h('span',`Продажи ${M.money(v.sale)}`),h('span',`Списания ${M.money(v.writeoff)}`));})),h('small.iv-muted','История накапливается с начала использования.'))}
  function categoryOptions(){return [['','Без категории'],...doc.categories.map(c=>[c.id,index().categoryName(c.id)]).sort((a,b)=>a[1].localeCompare(b[1],'ru'))];}
  function drawCatalog(){
    const archived=view==='archive';let nodes=M.catalogItems(doc,query,archived,index());
    if(!archived&&!showFurniture&&!query.trim())nodes=nodes.filter(n=>{const modelType=n.modelType||M.planForNode(doc,n).furniture.find(f=>f.id===n.furnitureId)?.type;if(ELECTRONICS_TYPES.has(modelType))return true;if(n.kind==='furniture')return false;const seen=new Set();for(let c=doc.categories.find(c=>c.id===n.categoryId);c&&!seen.has(c.id);c=doc.categories.find(parent=>parent.id===c.parentId)){seen.add(c.id);if(['furniture','decor'].includes(c.id)||['furniture','decor'].includes(c.kind))return false;}return true;});
    if(collection){if((doc.collections||[]).some(c=>c.id===collection))nodes=nodes.filter(n=>(n.collectionIds||[]).includes(collection));else collection='';}
    if(category){const target=index().categoryName(category);nodes=nodes.filter(n=>index().categoryName(n.categoryId)===target||index().categoryName(n.categoryId).startsWith(target+' / '));}if(condition)nodes=nodes.filter(n=>n.condition===condition);if(roomFilter){const ids=new Set([roomFilter,...M.descendants(doc,roomFilter).map(n=>n.id)]);nodes=nodes.filter(n=>ids.has(n.id));}
    const pageKey=JSON.stringify([view,query,category,collection,condition,roomFilter,sort,showFurniture,catalogMode]);if(pageKey!==catalogPageKey){catalogLimit=100;catalogPageKey=pageKey;}
    nodes.sort((a,b)=>sort==='price'?(b.purchaseCents||0)-(a.purchaseCents||0):sort==='date'?(b.createdAt||'').localeCompare(a.createdAt||''):a.name.localeCompare(b.name,'ru'));
    const filters=h('div.iv-filters',select([['','Все категории'],...categoryOptions().slice(1)],category,{'aria-label':'Фильтр по категории',onchange:e=>{category=e.target.value;draw();}}),select([['','Все комнаты'],...doc.nodes.filter(n=>n.kind==='room').map(n=>[n.id,index().address(n)])],roomFilter,{'aria-label':'Фильтр по комнате',onchange:e=>{roomFilter=e.target.value;draw();}}),select([['','Любое состояние'],...M.CONDITIONS.map(c=>[c,c])],condition,{'aria-label':'Фильтр по состоянию',onchange:e=>{condition=e.target.value;draw();}}),select([['name','По названию'],['price','По стоимости'],['date','По дате добавления']],sort,{'aria-label':'Сортировка',onchange:e=>{sort=e.target.value;draw();}}));
    if(automobileCars(doc).length)filters.append(select([['','Автомобиль: любой / дом'],...automobileCars(doc).map(c=>[c.rootId,c.name])],automobileCars(doc).some(c=>c.rootId===roomFilter)?roomFilter:'',{'aria-label':'Фильтр по автомобилю',onchange:e=>{roomFilter=e.target.value;draw();}}));
    if((doc.collections||[]).length)filters.append(select([['','Все подборки'],...doc.collections.slice().sort((a,b)=>a.name.localeCompare(b.name,'ru')).map(c=>[c.id,c.name])],collection,{'aria-label':'Фильтр по подборке',onchange:e=>{collection=e.target.value;draw();}}));
    const chips=h('div.iv-filter-chips');for(const [label,value,reset] of [['Категория',category,()=>category=''],['Подборка',collection,()=>collection=''],['Комната',roomFilter,()=>roomFilter=''],['Состояние',condition,()=>condition='']])if(value)chips.append(button(label+': '+(label==='Категория'?index().categoryName(value):label==='Подборка'?doc.collections.find(c=>c.id===value)?.name||value:M.getNode(doc,value)?.name||value)+' ×',()=>{reset();draw();}));if(category||collection||roomFilter||condition)chips.append(button('Сбросить фильтры',()=>{category='';collection='';roomFilter='';condition='';draw();},'rotate'));
    const modes=h('div.iv-actions',button('Экспорт в Excel',exportExcel,'download'),...['table','grid'].map(mode=>{const b=button(mode==='table'?'Таблица':archived?'Фото':'Плитки',()=>{catalogMode=mode;localStorage.setItem('iv:catalog-mode',mode);draw(true);},mode==='table'?'list':'box',catalogMode===mode?'active':'');b.setAttribute('aria-pressed',String(catalogMode===mode));return b;}),!archived&&nodes.length?button(nodes.every(n=>selected.has(n.id))?'Снять выделение':'Выделить все',()=>{if(nodes.every(n=>selected.has(n.id)))for(const n of nodes)selected.delete(n.id);else for(const n of nodes)selected.add(n.id);draw(true);},'check'):null,!archived?h('label.iv-show-furniture',h('input',{type:'checkbox',checked:showFurniture,onchange:e=>{showFurniture=e.target.checked;localStorage.setItem('iv:show-furniture',String(showFurniture));selected.clear();draw(true);}}),h('span','Показывать мебель')):null,catalogMode==='table'?button('Сбросить ширину столбцов',()=>{resetColumns(archived?'archive':'catalog');draw(true);},'rotate'):null);
    content.replaceChildren(title(archived?'Архив':'Все вещи',`${plural(nodes.length,['запись','записи','записей'])}${query?' · «'+query+'»':''}`,[]),modes,filters,chips);
    if(query.trim()&&!archived){const places=index().search(query,false,true).filter(n=>n.kind==='room'||isSection(n));if(places.length)content.append(h('section.iv-search-places',h('h2','Места хранения'),h('div.iv-actions',...places.slice(0,20).map(n=>button(index().address(n),()=>open(n),nodeIcon(n))))));}
    if(selected.size&&!archived)content.append(h('div.iv-bulk',h('span',`Выбрано: ${selected.size}`),button('Переместить',()=>moveDialog([...selected]),'folder'),button('Снять выделение',()=>{selected.clear();draw(true);},'close'),button('Удалить',()=>bulkDeleteDialog([...selected]),'trash','danger')));
    const list=h(catalogMode==='grid'?'div.iv-photo-grid':'div.iv-table');if(catalogMode==='table')list.append(h('div.iv-table-head',h('span'),h('span','Вещь'),h('span',archived?'Выбытие':'Место хранения'),h('span','Цена объекта'),h('span','Действия')));
    for(const n of nodes.slice(0,catalogLimit)){
      const checkbox=h('input',{type:'checkbox','aria-label':`Выбрать ${n.name}`,onchange:e=>{e.target.checked?selected.add(n.id):selected.delete(n.id);draw(true);}});checkbox.checked=selected.has(n.id);
      const metadata=h('span.iv-item-meta',h('small',{title:index().categoryName(n.categoryId)||M.KINDS[n.kind]},index().categoryName(n.categoryId)||M.KINDS[n.kind]),rarityBadge(doc,n));
      if(!archived&&catalogMode==='table'&&!isSection(n))metadata.append(wearIndicator(n));
      const item=h('button.iv-item-name',{onclick:()=>details(n)},nodeThumb(n),h('span.iv-item-copy',h('strong',n.name),metadata,travelTags(doc,n)));
      const row=draggable(h(catalogMode==='grid'?'article.iv-photo-card':'div.iv-table-row',archived&&catalogMode==='table'?h('span',{'aria-hidden':'true'}):archived?null:checkbox,item,
        h('button.iv-address',{onclick:()=>details(n),title:archived?index().address(n):M.getNode(doc,n.parentId)?index().address(M.getNode(doc,n.parentId)):'Без места'},archived?`${n.archived.reason} · ${displayDate(n.archived.date)}${n.archived.saleCents!=null?' · '+M.money(n.archived.saleCents):''}`:M.getNode(doc,n.parentId)?index().address(M.getNode(doc,n.parentId)):'Без места'),
        h('div.iv-prices',h('strong',M.money(n.purchaseCents)),n.currentCents!=null?h('small',M.money(n.currentCents)):null),
        h('div.iv-actions',archived?button('Вернуть',()=>restoreDialog(n),'undo'):button('Открыть',()=>details(n),'next'),actionsButton(n))),n);
      paintRarity(row,doc,n);
      if(n.photo)row.classList.add('has-photo');
      row.oncontextmenu=e=>{e.preventDefault();showActions(n,row);};
      if(!isSection(n)&&!archived&&catalogMode==='grid')row.append(wearIndicator(n));
      list.append(row);
    }
    if(!nodes.length)list.append(empty(query||category||collection||roomFilter||condition?'Ничего не найдено. Измените запрос или фильтры.':archived?'В архиве пока нет вещей. Здесь появятся проданные, подаренные и списанные вещи.':'Вещей пока нет. Нажмите «Добавить вещь».'));content.append(list);if(nodes.length>catalogLimit)content.append(button(`Показать ещё · ${Math.min(catalogLimit,nodes.length)} из ${nodes.length}`,()=>{catalogLimit+=100;draw(true);},'next'));if(catalogMode==='table')resizableColumns(list,archived?'archive':'catalog');
  }
  function drawHistory(){
    const needle=input('',{type:'search',placeholder:'Вещь или адрес…','aria-label':'Поиск в истории'}),kind=select([['','Все события'],...Object.entries(eventNames)],'',{'aria-label':'Тип события'}),list=h('div.iv-history');let limit=100;
    function paint(){const q=needle.value.trim().toLocaleLowerCase('ru'),events=doc.events.slice().reverse().filter(e=>(!kind.value||e.type===kind.value)&&(!q||[e.name,e.from,e.to,e.reason].join(' ').toLocaleLowerCase('ru').includes(q)));list.replaceChildren(...events.slice(0,limit).map(e=>h('article.iv-event',icon(e.type==='move'?'folder':'clock',18),h('div',M.getNode(doc,e.nodeId)?button(`${eventNames[e.type]||e.type} · ${e.name}`,()=>details(M.getNode(doc,e.nodeId))):h('strong',`${eventNames[e.type]||e.type} · ${e.name}`),h('small',e.type==='move'?`${e.from} → ${e.to}`:e.type==='value'?`${M.money(e.beforePurchase)} → ${M.money(e.purchaseCents)} · оценка ${M.money(e.currentCents)}`:e.reason||(e.type==='purchase'?M.money(e.purchaseCents):''))),h('time',displayDate(e.effectiveDate||e.date)))));if(!events.length)list.append(empty('Подходящих событий пока нет'));if(events.length>limit)list.append(button('Показать ещё',()=>{limit+=100;paint();},'next'));}
    needle.oninput=paint;kind.onchange=paint;content.replaceChildren(title('История имущества','Добавления, покупки, перемещения и выбытие'),h('div.iv-filters.iv-history-filter',needle,kind),list);paint();
  }
  function drawTrash(){
    const entries=(doc.trash||[]).slice().sort((a,b)=>b.removedAt.localeCompare(a.removedAt)),needle=input('',{type:'search',placeholder:'Найти удалённую вещь…','aria-label':'Поиск в корзине'}),list=h('div.iv-trash-list');function paint(){const found=entries.filter(e=>e.nodes.some(n=>n.name.toLocaleLowerCase('ru').includes(needle.value.toLocaleLowerCase('ru'))));list.replaceChildren(...found.map(entry=>{const n=entry.nodes.find(n=>n.id===entry.rootId);return h('article.iv-trash-row',nodeThumb(n),h('div.iv-row-copy',h('strong',n.name),h('small',`${displayDate(entry.removedAt)} · ${plural(entry.nodes.length,['позиция','позиции','позиций'])}${n.archived?' · из архива':''}`)),button('Восстановить',()=>recoverDialog(entry),'undo'));}));if(!found.length)list.append(empty(entries.length?'Ничего не найдено':'Корзина пуста'));}needle.oninput=paint;const clear=button('Очистить корзину',clearTrash,'trash','danger');clear.disabled=!entries.length;content.replaceChildren(title('Корзина','Вещи и мебель можно восстановить вместе с содержимым',[clear]),needle,list);paint();
  }
  function clearTrash(){const count=(doc.trash||[]).reduce((sum,e)=>sum+e.nodes.length,0);if(!count)return;modal('Очистить корзину?',(body,close)=>{const error=h('p.iv-form-error',{role:'alert'}),submit=button('Очистить навсегда',async()=>{submit.disabled=true;try{await change(d=>{d.trash=[];},{undoable:false,retryable:false});history.clear();updateHistoryControls();close();say('Корзина очищена');}catch(e){error.textContent=e.message;submit.disabled=false;}},'trash','danger');body.append(h('p',`Будут удалены все объекты из корзины: ${count}, включая вложенные вещи и мебель.`),h('p.iv-muted','После очистки восстановить их из корзины или отменой действия не получится. Ранее созданные резервные копии сохранятся.'),error,h('div.iv-actions',button('Отмена',close,'close'),submit));});}
  function modal(name,build,{wide=false}={}){
    const dialog=h(`dialog.iv-dialog${wide?'.wide':''}`,{'aria-label':name});
    const body=h('div.iv-dialog-body');const close=()=>{dialog.close();dialog.remove();};
    dialog.append(h('div.iv-dialog-title',h('h2',name),button('Закрыть',close,'close')),body);document.body.append(dialog);
    dialog.addEventListener('close',()=>dialog.remove());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
    build(body,close);dialog.showModal();return dialog;
  }
  function details(n){const previous=activeSpace(doc).id;followSpace(n);if(previous!==activeSpace(doc).id)draw();detailId=n?.id||null;drawDetails();detailsPane.querySelector('h2')?.focus();}
  function editWeightAndVolume(n){const volumeKey=n.fields?.['Транспортный объём, л']!=null?'Транспортный объём, л':'Объём, л';modal('Вес и объём',(body,close)=>{const weight=input(itemWeightKg(n)==null?'':itemWeightKg(n)*1000,{'aria-label':'Вес предмета, г'}),volume=input(itemVolumeLiters(n)??'',{'aria-label':'Объём предмета, л'}),error=h('p.iv-form-error',{role:'alert'});body.append(field('Вес предмета, г',weight),h('p.iv-muted',estimatedWeight(n)?'Сейчас указан приблизительный вес. Сохраните уточнённое значение, чтобы снять отметку оценки.':'Вес сохранится в карточке предмета.'),field('Объём предмета, л',volume),h('p.iv-muted','Объём предмета справочный. Занятый объём хранилищ поездки задаётся отдельно.'),error,button('Сохранить',async()=>{try{const grams=travelDecimal(weight.value,{required:true}),liters=travelDecimal(volume.value);await change(d=>{setWeight(d,n.id,grams);const node=M.getNode(d,n.id);if(liters==null)delete node.fields[volumeKey];else node.fields[volumeKey]=String(liters);},{action:'Вес и объём предмета'});close();details(M.getNode(doc,n.id));}catch(e){error.textContent=e.message;}},'check','primary'));});}
  function drawDetails(){
    const n=M.getNode(doc,detailId);paintRarity(detailsPane,doc,n);detailsPane.hidden=!n;if(!n){detailsPane.replaceChildren();return;}const totals=n.archived?{purchase:[n,...M.descendants(doc,n.id)].filter(x=>x.archived?.group===n.archived.group).reduce((sum,x)=>sum+(x.purchaseCents||0),0)}:index().totals(n.id);
    const inCar=carForNode(doc,n),location=inCar?{reason:null}:planLocation(doc,n.id),locate=button(inCar?'Показать в автомобиле':'Показать на плане',()=>showOnPlan(n.id),'camera');
    locate.disabled=Boolean(location.reason);locate.title=location.reason||'Подлететь к месту хранения и показать, где находится объект';
    const locateAction=h('div.iv-locate-action',locate,location.reason?h('small.iv-muted',location.reason):null);
    const values={'Источник веса':estimatedWeight(n)?n.weightEstimate.basis+' (≈)':null,'Категория':index().categoryName(n.categoryId),'Подборки':itemCollections(doc,n).map(c=>c.name).join(', '),'Текущая оценка':n.currentCents!=null?M.money(n.currentCents):null,'Состояние':n.condition,'Износ':itemWear(n)!=null?itemWear(n)+'%'+(resolvedWearMode(n)!=='manual'?' · по сроку службы':''):null,'Срок полезного использования':resolvedWearMode(n)!=='manual'?wearSchedule(n).months+' мес.':null,'Дата покупки':n.purchasedAt?displayDate(n.purchasedAt):null,'Срок годности':n.expiry?displayDate(n.expiry):null,'Гарантия до':n.warranty?displayDate(n.warranty):null,...n.fields};
    const detailValue=(key,value)=>{if(key!=='Цвет')return h('dd',value);const swatch=COLORS.find(([label])=>label.toLocaleLowerCase('ru')===String(value).toLocaleLowerCase('ru'))?.[1];return h('dd.iv-selected-color',{vars:swatch&&!swatch.includes('gradient')?{'--selected-color':swatch}:{}},value);};
    if(n.quantity!==1||n.unit!=='шт.')values['Количество']=n.quantity+' '+n.unit;
    const actions=h('div.iv-actions',n.archived?button('Вернуть',()=>restoreDialog(n),'undo'):button('Редактировать',()=>editNode(n),'sliders','primary'),n.kind!=='item'&&!n.archived&&M.canStore(n)?button('Содержимое',()=>open(n),'folder'):null,actionsButton(n));
    detailsPane.replaceChildren(...[h('div.iv-detail-heading',h('h2',{tabindex:-1},n.name),button('Закрыть',()=>{detailId=null;drawDetails();},'close')),breadcrumbs(n),paintRarity(h('div.iv-detail-hero',nodeThumb(n),h('div',rarityBadge(doc,n),h('strong.iv-detail-price',M.money(!M.canStore(n)?n.purchaseCents:totals.purchase)),h('small.iv-muted',isSection(n)?'Стоимость содержимого':!M.canStore(n)?'Стоимость покупки':`Объект ${M.money(n.purchaseCents)} · содержимое ${M.money(totals.purchase-(n.purchaseCents||0))}`))),doc,n),locateAction,actions,travelPossession(n)?h('div.iv-actions',button(n.travelEligible?'Для походов ✓':'Добавить в поход',()=>{change(d=>{M.getNode(d,n.id).travelEligible=!n.travelEligible;},{action:'Доступность вещи для походов'}).then(()=>details(M.getNode(doc,n.id))).catch(()=>{});},'map','iv-travel-toggle'),button(estimatedWeight(n)?'Уточнить вес и объём':'Вес и объём',()=>editWeightAndVolume(n),'sliders'),travelTags(doc,n)):null,!isSection(n)&&n.kind!=='room'&&!n.archived?wearControl(n):null,n.archived?h('p.iv-archive-info',`${n.archived.reason} · ${displayDate(n.archived.date)}`):null,
      h('dl.iv-details',...Object.entries(values).filter(([,v])=>v!=null&&v!=='').flatMap(([k,v])=>[h('dt',k),detailValue(k,v)])),n.notes?h('p.iv-notes',n.notes):null,!n.archived&&n.kind!=='room'?h('div.iv-actions',button('Переместить',()=>moveDialog([n.id]),'folder'),!isSection(n)?button('Создать копию',()=>{const copy=structuredClone(n);delete copy.id;delete copy.furnitureId;copy.name+=' — копия';copy.acquisition='existing';editNode(null,copy);},'copy'):null,n.kind==='furniture'?button(n.furnitureId?'Убрать с плана':'Разместить на плане',()=>n.furnitureId?detachFromPlan(n):openEditor(n.id),'map'):null):null,
      M.canStore(n)&&!n.virtual?fillControl(n):null,h('h3','История вещи'),...doc.events.filter(e=>e.nodeId===n.id).slice(-5).reverse().map(e=>h('p.iv-muted',`${displayDate(e.effectiveDate||e.date)} · ${eventNames[e.type]||e.type}${e.from?' · '+e.from+' → '+e.to:''}`))].filter(Boolean));
  }
  function detachFromPlan(n){modal('Убрать с плана',(body,close)=>body.append(h('p',`«${n.name}» исчезнет с плана. Карточка и всё содержимое останутся на своём месте.`),button('Убрать с плана',async()=>{try{await change(d=>M.detachFurniture(d,n.id));close();say('Убрано с плана, карточка сохранена');}catch{}},'map')));}
  function destinationSelect(value,movingId){return createLocationPicker({getDoc:()=>doc,value:value||M.UNPLACED_ID,movingId,required:true,label:'Место хранения'});}
  function deleteOptions(document,node){
    const keep=input('',{type:'checkbox','aria-label':'Сохранить вещи в «Без места»'});
    const mode=select([['all','Удалить вместе с содержимым'],['move','Перенести вещи в другое место']],'all',{'aria-label':'Что делать с содержимым'}),target=createLocationPicker({getDoc:()=>document,value:node.parentId,movingId:node.id,required:true,label:'Куда перенести вещи'});
    const targetField=field('Куда перенести вещи',target),extra=h('div',field('Содержимое',mode),targetField);
    function refresh(){extra.hidden=keep.checked;targetField.hidden=mode.value!=='move';}
    keep.onchange=mode.onchange=refresh;refresh();
    return {element:h('div.iv-delete-options',h('label.iv-check',keep,'Сохранить вещи в «Без места»'),h('p.iv-muted','Встроенные полки и отсеки удаляются вместе с мебелью.'),extra),value:()=>({together:!keep.checked&&mode.value==='all',destination:keep.checked?M.UNPLACED_ID:target.value})};
  }
  function bulkDeleteDialog(ids){
    const nodes=ids.map(id=>M.getNode(doc,id)).filter(Boolean);if(!nodes.length)return;
    modal('Удалить выбранные вещи?',(body,close)=>{
      const keep=input('',{type:'checkbox','aria-label':'Сохранить вложенные вещи в «Без места»'}),error=h('p.iv-form-error',{role:'alert'}),hasContents=nodes.some(n=>M.descendants(doc,n.id).length);
      const submit=button('Удалить в корзину',async()=>{submit.disabled=true;try{await change(d=>M.removeMany(d,ids,{together:!keep.checked,destination:M.UNPLACED_ID}),{action:'Удаление выбранных вещей',retryable:false});close();say('Выбранные вещи перемещены в корзину');}catch(e){error.textContent=e.message;submit.disabled=false;}},'trash','danger');
      body.append(...[h('p',`Выбрано: ${nodes.length}. Предметы исчезнут из каталога и с плана. Их можно восстановить из корзины.`),h('ul.iv-delete-selection',...nodes.slice(0,8).map(n=>h('li',n.name))),nodes.length>8?h('p.iv-muted',`И ещё ${nodes.length-8}`):null,hasContents?h('label.iv-check',keep,'Сохранить вложенные вещи в «Без места»'):null,hasContents?h('p.iv-muted','Отмеченные вами предметы будут удалены. Встроенные полки и отсеки удаляются вместе с мебелью.'):null,error,h('div.iv-actions',button('Отмена',close,'close'),submit)].filter(Boolean));
    });
  }
  function deleteDialog(n){modal(`Удалить «${n.name}»?`,(body,close)=>{
    const nested=M.descendants(doc,n.id),options=deleteOptions(doc,n);
    const error=h('p.iv-form-error',{role:'alert'});
    const submit=button('Удалить',async()=>{submit.disabled=true;error.textContent='';try{await change(d=>M.remove(d,n.id,{...options.value()}));close();say('Перемещено в корзину');}catch(e){error.textContent=e.message;submit.disabled=false;}},'trash','danger');
    body.append(h('p','Объект исчезнет из каталога и с плана. Его можно будет восстановить из корзины.'),h('p.iv-muted',nested.length?`Внутри: ${nested.length} позиций, включая вложенные отсеки и вещи.`:'Внутри нет других вещей.'),...(nested.length?[options.element]:[]),error,h('div.iv-dialog-actions',button('Отмена',close,'close'),submit));
  });}
  function recoverDialog(entry){modal('Восстановить из корзины',(body,close)=>{
    const n=entry.nodes.find(n=>n.id===entry.rootId);const original=M.getNode(doc,n.parentId);const target=destinationSelect(original&&!original.archived?original.id:null);
    const error=h('p.iv-form-error',{role:'alert'});
    const submit=button('Восстановить',async()=>{submit.disabled=true;try{await change(d=>M.recover(d,entry.id,target.value));close();say(n.archived?'Восстановлено в архив':'Объект восстановлен');}catch(e){error.textContent=e.message;submit.disabled=false;}},'undo','primary');
    body.append(h('p',`${n.name} · ${entry.nodes.length} позиций`),field('Место хранения',target),error,h('div.iv-dialog-actions',button('Отмена',close,'close'),submit));
  });}
  function editNode(existing,defaults={}){
    if(existing?.automobileId)return automobile.carForm(carForNode(doc,existing));
    if(existing?.kind==='room')return editRoomIcon(existing);if(existing&&isSection(existing))return editStorageLayout(existing);
    openItemForm({getDoc:()=>doc,existing,defaults,currentPlaceId:currentPlace().id,lastCategory,change:fn=>change(fn,{retryable:false}),onSaved:({categoryId,parentId,kind,again,nodeId})=>{if(kind==='item'){lastCategory=categoryId;localStorage.setItem('iv:last-category',categoryId);}if(again)editNode(null,{parentId,categoryId,kind});else if(nodeId){detailId=nodeId;drawDetails();}say(existing?'Изменения сохранены':kind==='item'?'Вещь добавлена':'Место хранения добавлено');}});
  }
  function moveDialog(ids){modal('Переместить вещи',(body,close)=>{const excluded=new Set(ids.flatMap(i=>[i,...M.descendants(doc,i).map(n=>n.id)]));const destination=createLocationPicker({getDoc:()=>doc,value:'',excludeIds:[...excluded],required:true,label:'Новое место'}),error=h('p.iv-form-error',{role:'alert'});
    const submit=button('Переместить',async()=>{error.textContent='';if(!destination.checkValidity()){error.textContent='Выберите место хранения для выбранных вещей.';return;}submit.disabled=true;try{await change(d=>moveAutomobileItems(d,ids,destination.value),{action:'Перемещение выбранных вещей',retryable:false});close();say(`Перемещено: ${plural(ids.length,['вещь','вещи','вещей'])}`);}catch(e){error.textContent=e.message;submit.disabled=false;}},'folder','primary');
    body.append(h('p',`Выбрано: ${ids.length}. Контейнеры переместятся с содержимым.`),field('Новое место',destination),error,h('div.iv-actions',button('Отмена',close,'close'),submit));});}
  function archiveDialog(n){modal('В архив',(body,close)=>{const reason=select(['Продано','Подарено','Выброшено','Израсходовано','Другое'].map(v=>[v,v]),'Продано');const date=input(M.today(),{type:'date',required:true});const amount=input('',{inputmode:'decimal',placeholder:'Не указана'});const has=M.descendants(doc,n.id).length>0;const mode=select([['all','Архивировать вместе с содержимым'],['move','Переместить содержимое в другое место']],'all');const destination=destinationSelect(null,n.id);const extras=h('div');const refresh=()=>{amount.disabled=reason.value!=='Продано';destination.disabled=mode.value!=='move';};reason.addEventListener('change',refresh);mode.addEventListener('change',refresh);refresh();
      if(has)extras.append(field('Содержимое',mode),field('Куда переместить содержимое',destination));
      body.append(h('p',n.name),field('Причина',reason),field('Дата',date),field('Сумма продажи, ₽',amount),extras,button('Архивировать',async()=>{try{const saleCents=reason.value==='Продано'?M.parseMoney(amount.value):null;await change(d=>M.archive(d,n.id,{reason:reason.value,date:date.value,saleCents,together:!has||mode.value==='all',destination:destination.value}));close();}catch(e){say(e.message,true);}},'trash','primary'));
    });}
  function restoreDialog(n){modal('Вернуть из архива',(body,close)=>{const destination=destinationSelect(null,n.id);body.append(h('p',n.name),field('Место хранения',destination),button('Вернуть',async()=>{try{await change(d=>M.restore(d,n.id,destination.value));close();}catch{}},'undo','primary'));});}
  function configureCategories(){openCategoryWizard({getDoc:()=>doc,change,onSaved:({addedCategories,addedCollections})=>{go('categories');say(`Добавлено категорий: ${addedCategories}, подборок: ${addedCollections}`);}});}
  function categoryBadge(c,action){const a=categoryAppearance(doc,c.id);return h('button.iv-category-badge.iv-category-icon-button',{type:'button',onclick:action,'data-kind':a.kind,'data-glyph':a.glyph,'aria-label':'Изменить значок: '+index().categoryName(c.id),title:'Изменить значок категории'},icon(a.glyph,16));}
  function drawCategories(draft=null){
    let deleting=Boolean(draft?.deleting),draggedCategoryId=null;let folded;try{folded=new Set(JSON.parse(localStorage.getItem('iv:category-folded')||'[]'));}catch{folded=new Set();}const foldButtons=new Map(),addButtons=new Map();function rememberFolds(){try{localStorage.setItem('iv:category-folded',JSON.stringify([...folded]));}catch{}}const selectedCategories=new Set(),checks=new Map(),editRows=new Map(),handles=new Map(),iconButtons=new Map();
    const form=h('form.iv-category-editor'),list=h('div.iv-category-groups'),inputs=new Map(),branches=new Map(),parentLabels=new Map(),error=h('p.iv-form-error',{role:'alert'},draft?.error||''),needle=input(draft?.query||'',{type:'search',placeholder:'Найти категорию или подкатегорию…','aria-label':'Поиск категорий и подкатегорий'}),counter=h('span.iv-muted',{'aria-live':'polite'});
    const sorted=doc.categories.slice().sort((a,b)=>(a.order??Number.MAX_SAFE_INTEGER)-(b.order??Number.MAX_SAFE_INTEGER)||a.name.localeCompare(b.name,'ru'));
    function rows(parentId,depth=0){return sorted.filter(c=>(c.parentId||null)===parentId).map(c=>{
      const name=input(draft?.names?.get(c.id)??c.name,{required:true,maxlength:200,'aria-label':`Название категории: ${index().categoryName(c.id)}`});
      inputs.set(c.id,name);name.addEventListener('input',filter);
      const parentLabel=h('small.iv-category-parent');parentLabels.set(c.id,parentLabel);
      const check=h('input.iv-category-select',{type:'checkbox',hidden:true,'aria-label':`Выбрать категорию: ${index().categoryName(c.id)}`});checks.set(c.id,check);
      const toggle=()=>{check.checked?selectedCategories.add(c.id):selectedCategories.delete(c.id);paintSelection();};check.onchange=toggle;
      let draggedByPointer=false;
      const handle=button('',()=>{if(draggedByPointer){draggedByPointer=false;return;}chooseCategoryParent(c);},'more','iv-category-drag-handle');handle.draggable=false;handle.title='Перетащите за край для изменения порядка или вложенности. Нажмите для выбора родителя.';handle.setAttribute('aria-label','Переместить категорию: '+index().categoryName(c.id));handles.set(c.id,handle);
      handle.addEventListener('pointerdown',event=>{
        if(deleting||busy||event.button!==0)return;
        const startX=event.clientX,startY=event.clientY,pointerId=event.pointerId;let dragging=false,targetId=null,position='inside';
        handle.setPointerCapture(pointerId);
        const clear=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);form.querySelectorAll('.iv-category-drop-target,.iv-category-dragging,.iv-category-drop-before,.iv-category-drop-after').forEach(el=>el.classList.remove('iv-category-drop-target','iv-category-dragging','iv-category-drop-before','iv-category-drop-after'));dragHint.textContent='Перетащите категорию за точки в другую категорию. Нажмите на значок, чтобы изменить его.';};
        const move=e=>{
          if(e.pointerId!==pointerId)return;
          if(!dragging&&Math.hypot(e.clientX-startX,e.clientY-startY)<6)return;
          dragging=true;draggedByPointer=true;editRows.get(c.id).classList.add('iv-category-dragging');
          form.querySelectorAll('.iv-category-drop-target,.iv-category-drop-before,.iv-category-drop-after').forEach(el=>el.classList.remove('iv-category-drop-target','iv-category-drop-before','iv-category-drop-after'));
          const hit=document.elementFromPoint(e.clientX,e.clientY),root=hit?.closest('.iv-category-root-drop'),row=hit?.closest('.iv-category-edit-row');
          targetId=root?null:row?.dataset.categoryId??null;position='inside';
          if(row&&!root){const bounds=row.getBoundingClientRect(),fraction=(e.clientY-bounds.top)/bounds.height;position=fraction<.28?'before':fraction>.72?'after':'inside';}
          if(!root&&!row||targetId===c.id){targetId=undefined;return;}
          try{planCategoryMove(doc,c.id,position==='inside'?targetId:doc.categories.find(x=>x.id===targetId)?.parentId||null);(root||row).classList.add('iv-category-drop-target');if(position!=='inside')(root||row).classList.add(position==='before'?'iv-category-drop-before':'iv-category-drop-after');dragHint.textContent=root?'Перенести на верхний уровень':position==='inside'?'Вложить в «'+inputs.get(targetId).value+'»':'Поставить '+(position==='before'?'перед':'после')+' «'+inputs.get(targetId).value+'»';}
          catch{targetId=undefined;dragHint.textContent='Нельзя перенести категорию в себя или свою подкатегорию.';}
        };
        const finish=e=>{if(e.pointerId!==pointerId)return;const valid=dragging&&targetId!==undefined;clear();if(valid)performCategoryPlacement(c.id,targetId,position);};
        const cancel=e=>{if(e.pointerId===pointerId)clear();};
        handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',cancel);
      });
      handle.addEventListener('dragstart',e=>{if(deleting||busy){e.preventDefault();return;}e.stopPropagation();draggedCategoryId=c.id;e.dataTransfer.setData('application/x-inventory-category',c.id);e.dataTransfer.effectAllowed='move';editRows.get(c.id).classList.add('iv-category-dragging');});
      handle.addEventListener('dragend',clearCategoryDrag);
      const badge=categoryBadge(c,()=>chooseCategoryIcon(c));iconButtons.set(c.id,badge);
      const add=button('',()=>chooseSubcategory(c),'plus','iv-category-add-child');add.title='Добавить подкатегорию';add.setAttribute('aria-label','Добавить подкатегорию: '+index().categoryName(c.id));addButtons.set(c.id,add);
      const row=h('div.iv-category-edit-row.has-category-add',{'data-category-id':c.id,vars:{'--category-indent':depth*16+'px'}},check,handle,badge,name,parentLabel,add);editRows.set(c.id,row);categoryDropTarget(row,c.id);
      row.addEventListener('click',e=>{if(deleting){if(e.target!==check&&!e.target.closest('button')){check.checked=!check.checked;toggle();}}else if(categoriesMode==='grid'&&e.target!==name&&!e.target.closest('button'))name.focus();});
      const branch=h('div.iv-category-branch',row,...rows(c.id,depth+1));branches.set(c.id,branch);if(sorted.some(x=>x.parentId===c.id)){const fold=button('',()=>{folded.has(c.id)?folded.delete(c.id):folded.add(c.id);rememberFolds();filter();},'down','iv-category-fold');foldButtons.set(c.id,fold);row.append(fold);row.classList.add('has-category-fold');}return branch;
    });}
    list.append(...rows(null));const noResults=h('p.iv-muted',{hidden:true},'Ничего не найдено. Попробуйте другое название.');
    function filter(){for(const [id,b]of foldButtons){const collapsed=folded.has(id)&&!needle.value.trim();branches.get(id).classList.toggle('is-collapsed',collapsed);b.setAttribute('aria-expanded',String(!collapsed));b.setAttribute('aria-label',(collapsed?'Развернуть':'Свернуть')+' категорию: '+inputs.get(id).value);}const words=needle.value.trim().toLocaleLowerCase('ru').split(/\s+/).filter(Boolean);let matched=0;const matches=new Map();for(const c of sorted){const path=[];for(let n=c;n;n=sorted.find(x=>x.id===n.parentId))path.push(inputs.get(n.id).value);const parentLabel=parentLabels.get(c.id);parentLabel.textContent=c.parentId?path.slice(1).reverse().join(' / '):'';parentLabel.title=parentLabel.textContent;const ok=words.every(w=>path.join(' ').toLocaleLowerCase('ru').includes(w));matches.set(c.id,ok);if(ok)matched++;}function show(c){const own=matches.get(c.id),nested=sorted.filter(x=>x.parentId===c.id).map(show).some(Boolean);branches.get(c.id).hidden=!own&&!nested;return own||nested;}sorted.filter(c=>!c.parentId).forEach(show);counter.textContent=words.length?`Найдено ${matched} из ${sorted.length}`:`Всего ${sorted.length}`;noResults.hidden=matched>0;}
    needle.oninput=filter;
    const name=input(draft?.name||'',{maxlength:200,placeholder:'Название новой категории','aria-label':'Новая категория'}),parent=select([['','Основная категория'],...sorted.map(c=>[c.id,index().categoryName(c.id)])],sorted.some(c=>c.id===draft?.parentId)?draft.parentId:'',{'aria-label':'Родительская категория'}),save=h('button.iv-btn.primary',{type:'submit'},'Сохранить изменения');
    const modes=h('div.iv-actions.iv-category-modes',{'role':'group','aria-label':'Вид категорий'});
    for(const [value,label,glyph] of [['list','Список','list'],['grid','Плитки','box']]){
      const b=button(label,()=>{categoriesMode=value;localStorage.setItem('iv:categories-mode',value);paintMode();},glyph);
      b.dataset.mode=value;modes.append(b);
    }
    function paintMode(){list.classList.toggle('is-category-tiles',categoriesMode==='grid');for(const b of modes.querySelectorAll('button')){const active=b.dataset.mode===categoriesMode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}}
    paintMode();
    const parentField=field('Родительская категория',parent),createFields=h('div.iv-category-add',{hidden:!draft?.createOpen},field('Название',name),parentField);parentField.hidden=true;parent.value='';
    const chooseCreation=()=>{createFields.hidden=false;parent.value='';name.focus();};
    const foldAll=button('Свернуть / развернуть всё',()=>{const ids=[...foldButtons.keys()],collapse=ids.some(id=>!folded.has(id));ids.forEach(id=>collapse?folded.add(id):folded.delete(id));rememberFolds();filter();},'down');
    const addRoot=button('Добавить категорию',chooseCreation,'plus');
    const deleteMode=button('Удалить',()=>{deleting=true;paintSelection();},'trash','danger'),selectedCount=h('span',{'aria-live':'polite'}),removeSelected=button('Удалить выбранные',confirmRemoval,'trash','danger');
    const deleteBar=h('div.iv-category-delete-bar',selectedCount,removeSelected,button('Отмена',()=>{deleting=false;selectedCategories.clear();for(const el of checks.values())el.checked=false;paintSelection();},'close'));
    const saveBar=h('div.iv-category-save',save);
    const dragHint=h('p.iv-category-drag-hint',{'role':'status','aria-live':'polite'},'Перетащите категорию за точки в другую категорию. Нажмите на значок, чтобы изменить его.');
    const rootDrop=h('div.iv-category-root-drop',{'aria-label':'Основные категории: перенос на верхний уровень'},icon('folder',17),h('span','Основные категории — перетащите сюда для возврата на верхний уровень'));categoryDropTarget(rootDrop,null);
    function pendingCategoryDraft(){return {names:new Map([...inputs].map(([id,el])=>[id,el.value])),name:name.value,parentId:parent.value,query:needle.value,createOpen:!createFields.hidden,sub:!parentField.hidden};}
    function chooseSubcategory(c){
      if(deleting||busy)return;
      const pending=pendingCategoryDraft(),parentName=inputs.get(c.id).value.trim()||c.name;
      modal('Добавить подкатегорию',(body,close)=>{
        const childName=input('',{required:true,autofocus:true,maxlength:200,placeholder:'Название подкатегории','aria-label':'Название подкатегории'}),failure=h('p.iv-form-error',{role:'alert'}),submit=h('button.iv-btn.primary',{type:'submit'},icon('plus',16),'Добавить');
        const create=h('form',h('p.iv-muted','В категории «'+parentName+'»'),field('Название',childName),failure,h('div.iv-actions',button('Отмена',close,'close'),submit));
        create.onsubmit=async e=>{e.preventDefault();const value=childName.value.trim();if(!value){failure.textContent='Введите название подкатегории';childName.focus();return;}submit.disabled=true;try{await change(d=>{d.categories.push({id:M.id(),name:value,parentId:c.id,kind:'default'});},{retryable:false,action:'Добавление подкатегории: '+value,actionSection:'categories'});folded.delete(c.id);rememberFolds();close();drawCategories(pending);say('Подкатегория добавлена');}catch(e){failure.textContent=e.message;submit.disabled=false;}};
        body.append(create);childName.focus();
      });
    }
    function clearCategoryDrag(){draggedCategoryId=null;form.querySelectorAll('.iv-category-drop-target,.iv-category-dragging').forEach(el=>el.classList.remove('iv-category-drop-target','iv-category-dragging'));dragHint.textContent='Перетащите категорию за точки в другую категорию. Нажмите на значок, чтобы изменить его.';}
    function categoryDropTarget(el,parentId){
      el.addEventListener('dragover',e=>{
        if(!draggedCategoryId||deleting||busy)return;e.stopPropagation();
        try{const plan=planCategoryMove(doc,draggedCategoryId,parentId);if(!plan.changed)return;e.preventDefault();e.dataTransfer.dropEffect='move';el.classList.add('iv-category-drop-target');const text=parentId?'Сделать подкатегорией: '+inputs.get(parentId).value:'Перенести на верхний уровень';if(dragHint.textContent!==text)dragHint.textContent=text;}
        catch{e.dataTransfer.dropEffect='none';el.classList.remove('iv-category-drop-target');dragHint.textContent='Нельзя перенести категорию в себя или свою подкатегорию.';}
      });
      el.addEventListener('dragleave',e=>{if(!el.contains(e.relatedTarget))el.classList.remove('iv-category-drop-target');});
      el.addEventListener('drop',e=>{if(!draggedCategoryId||deleting||busy)return;e.preventDefault();e.stopPropagation();const categoryId=draggedCategoryId,transferred=e.dataTransfer.getData('application/x-inventory-category');clearCategoryDrag();if(transferred!==categoryId)return;performCategoryMove(categoryId,parentId);});
    }
    async function performCategoryMove(categoryId,parentId){
      const pending=pendingCategoryDraft();error.textContent='';
      try{const plan=planCategoryMove(doc,categoryId,parentId);if(!plan.changed)return;await change(d=>moveCategory(d,categoryId,parentId),{retryable:false,action:'Перемещение категории: '+index().categoryName(categoryId)});drawCategories(pending);say(parentId?'Категория перенесена вместе с подкатегориями':'Категория перенесена на верхний уровень');return true;}
      catch(e){drawCategories({...pending,error:e.message});return false;}
    }
    async function performCategoryPlacement(categoryId,targetId,position){
      const pending=pendingCategoryDraft();error.textContent='';
      try{await change(d=>placeCategory(d,categoryId,targetId,position),{retryable:false,action:'Перестановка категории: '+index().categoryName(categoryId),actionSection:'categories'});drawCategories(pending);say('Категория перемещена');}
      catch(e){drawCategories({...pending,error:e.message});}
    }
    function chooseCategoryParent(c){
      if(deleting||busy)return;
      modal('Переместить категорию',(body,close)=>{
        const destinations=[['','Основные категории'],...sorted.filter(target=>{try{planCategoryMove(doc,c.id,target.id);return true;}catch{return false;}}).map(target=>[target.id,index().categoryName(target.id)])];
        const target=select(destinations,c.parentId||'',{'aria-label':'Куда перенести категорию'}),failure=h('p.iv-form-error',{role:'alert'}),submit=button('Переместить',async()=>{submit.disabled=true;try{await change(d=>moveCategory(d,c.id,target.value||null),{retryable:false,action:'Перемещение категории: '+index().categoryName(c.id)});close();drawCategories(pending);say('Категория перенесена');}catch(e){failure.textContent=e.message;submit.disabled=false;}},'folder','primary');
        const pending=pendingCategoryDraft();body.append(h('p',index().categoryName(c.id)),field('Новый родитель',target),h('p.iv-muted','Категория переместится вместе со всеми вложенными подкатегориями.'),failure,h('div.iv-actions',button('Отмена',close,'close'),submit));
      });
    }
    function chooseCategoryIcon(c){
      if(deleting||busy)return;
      const pending=pendingCategoryDraft();
      modal('Значок категории',(body,close)=>{
        let chosen=c.icon||null;const preview=h('div.iv-category-icon-preview'),choices=h('div.iv-category-icon-grid',{'role':'group','aria-label':'Значки категорий'}),failure=h('p.iv-form-error',{role:'alert'});
        const options=[[null,'Автоматически'],...CATEGORY_ICONS];
        const render=()=>{
          const previewDoc={...doc,categories:doc.categories.map(x=>{if(x.id!==c.id)return x;const next={...x};if(chosen)next.icon=chosen;else delete next.icon;return next;})},appearance=categoryAppearance(previewDoc,c.id);
          preview.replaceChildren(icon(appearance.glyph,34),h('span',h('strong',inputs.get(c.id).value||c.name),h('small',chosen?CATEGORY_ICONS.find(([id])=>id===chosen)?.[1]||'Текущий значок':'По категории или родителю')));
          choices.replaceChildren(...options.map(([glyph,label])=>{const b=button(label,()=>{chosen=glyph;render();choices.querySelector(`[data-icon-choice="${glyph||'auto'}"]`)?.focus();},glyph||categoryAppearance({...previewDoc,categories:previewDoc.categories.map(x=>{if(x.id!==c.id)return x;const next={...x};delete next.icon;return next;})},c.id).glyph);b.dataset.iconChoice=glyph||'auto';b.setAttribute('aria-pressed',String(chosen===glyph));return b;}));
        };
        const submit=button('Сохранить значок',async()=>{submit.disabled=true;try{await change(d=>setCategoryIcon(d,c.id,chosen),{retryable:false,action:'Значок категории: '+index().categoryName(c.id)});close();drawCategories(pending);say('Значок категории сохранён');}catch(e){failure.textContent=e.message;submit.disabled=false;}},'check','primary');
        body.append(preview,h('p.iv-muted','Значок используется у категории и её вещей. Подкатегории без собственного значка наследуют его.'),choices,failure,h('div.iv-actions',button('Отмена',close,'close'),submit));render();
      });
    }
    function paintSelection(){
      deleteMode.hidden=deleting;deleteMode.disabled=!sorted.length;deleteBar.hidden=!deleting;saveBar.hidden=deleting;
      addRoot.disabled=deleting;for(const b of addButtons.values())b.hidden=deleting;name.disabled=parent.disabled=deleting;
      selectedCount.textContent=`Выбрано: ${selectedCategories.size}`;removeSelected.disabled=!selectedCategories.size;
      rootDrop.hidden=dragHint.hidden=deleting;
      for(const [id,check]of checks){check.hidden=!deleting;inputs.get(id).readOnly=deleting;handles.get(id).hidden=deleting;handles.get(id).draggable=!deleting;iconButtons.get(id).disabled=deleting;editRows.get(id).classList.toggle('is-selecting',deleting);}
    }
    function confirmRemoval(){
      const ids=[...selectedCategories];let removal;
      try{removal=planCategoryRemoval(doc,ids);}catch(e){error.textContent=e.message;return;}
      modal('Удалить выбранные категории?',(body,close)=>{
        const failure=h('p.iv-form-error',{role:'alert'}),submit=button('Удалить категории',async()=>{
          submit.disabled=true;
          const pending={names:new Map([...inputs].map(([id,el])=>[id,el.value])),name:name.value,parentId:parent.value,query:needle.value,createOpen:!createFields.hidden,sub:!parentField.hidden};
          try{await change(d=>removeCategories(d,ids),{retryable:false,action:'Удаление категорий',actionSection:'categories'});close();drawCategories(pending);say('Категории удалены. Вещи сохранены.');}catch(e){failure.textContent=e.message;submit.disabled=false;}
        },'trash','danger');
        body.append(h('p',`Будут удалены категории: ${ids.length}. Их назначения исчезнут из карточек: ${removal.cleared}. Сами вещи сохранятся.`),h('ul.iv-category-delete-list',...ids.map(id=>h('li',inputs.get(id).value||index().categoryName(id)))),removal.parents.size?h('p.iv-muted','Невыбранные подкатегории сохранятся и перейдут к ближайшей оставшейся родительской категории или в основной список.'):h('p.iv-muted','Действие можно отменить кнопкой «Отменить».'),failure,h('div.iv-actions',button('Отмена',close,'close'),submit));
      });
    }
    form.append(modes,h('div.iv-category-search',needle,counter),h('div.iv-actions',addRoot,foldAll,deleteMode),deleteBar,createFields,dragHint,rootDrop,list,noResults,error,saveBar);paintSelection();
    form.onsubmit=async e=>{e.preventDefault();if(deleting){if(selectedCategories.size)confirmRemoval();return;}error.textContent='';save.disabled=true;try{const names=[...inputs].map(([id,el])=>[id,el.value.trim()]);if(names.some(([,value])=>!value))throw Error('Название категории не может быть пустым');await change(d=>{for(const [id,value]of names)d.categories.find(c=>c.id===id).name=value;if(name.value.trim())d.categories.push({id:M.id(),name:name.value.trim(),parentId:parent.value||null,kind:'default'});},{retryable:false});say('Категории сохранены');}catch(e){error.textContent=e.message;save.disabled=false;}};
    content.replaceChildren(h('div.iv-category-back',button('К вещам',()=>go('catalog'),'back')),title('Категории','Готовые наборы, категории и подборки по занятиям'),h('section.iv-category-tools',h('div',h('strong','Настройте каталог под себя'),h('p','Быт, работа и увлечения — выберите готовые наборы и проверьте категории перед добавлением.')),button('Настроить категории',()=>{if(name.value.trim()||[...inputs].some(([id,el])=>el.value!==doc.categories.find(c=>c.id===id).name)){say('Сначала сохраните изменения категорий.',true);return;}configureCategories();},'sparkles','primary')),form,collectionSection());filter();
  }
  function collectionSection(){
    const section=h('section.iv-collection-section',h('h2','Подборки по занятиям'),h('p.iv-muted','Одна вещь может входить в несколько подборок. Выберите их в карточке вещи.'));
    const list=h('div.iv-collection-list');
    for(const c of (doc.collections||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'ru'))){
      const count=M.catalogItems(doc,'',false,index()).filter(n=>(n.collectionIds||[]).includes(c.id)).length;
      list.append(h('div.iv-actions',button(`${c.name} · ${count}`,()=>{go('catalog');collection=c.id;category='';query='';searchInput.value='';roomFilter='';condition='';draw();},'folder'),button('Переименовать',()=>modal('Название подборки',(body,close)=>{
        const name=input(c.name,{maxlength:200,'aria-label':'Название подборки'}),error=h('p.iv-form-error',{role:'alert'}),save=button('Сохранить',async()=>{save.disabled=true;try{const value=name.value.trim();if(!value)throw Error('Введите название подборки');await change(d=>{if((d.collections||[]).some(x=>x.id!==c.id&&x.name.toLocaleLowerCase('ru')===value.toLocaleLowerCase('ru')))throw Error('Подборка с таким названием уже есть');d.collections.find(x=>x.id===c.id).name=value;},{retryable:false});close();say('Название подборки сохранено');}catch(e){error.textContent=e.message;save.disabled=false;}},'check','primary');body.append(field('Название',name),error,save);
      }),'sliders')));
    }
    if(!(doc.collections||[]).length)list.append(h('p.iv-muted','Пока нет подборок. Выберите увлечения в мастере или создайте свою.'));
    const create=h('form.iv-category-add'),name=input('',{maxlength:200,placeholder:'Например, Поездка на Алтай','aria-label':'Новая подборка'}),error=h('p.iv-form-error',{role:'alert'}),submit=h('button.iv-btn',{type:'submit'},'Добавить подборку');
    create.append(field('Своя подборка',name),submit);create.onsubmit=async e=>{e.preventDefault();const value=name.value.trim();if(!value){error.textContent='Введите название подборки';return;}submit.disabled=true;try{await change(d=>{d.collections??=[];if(d.collections.some(c=>c.name.toLocaleLowerCase('ru')===value.toLocaleLowerCase('ru')))throw Error('Подборка с таким названием уже есть');d.collections.push({id:M.id(),name:value});},{retryable:false});say('Подборка добавлена');}catch(e){error.textContent=e.message;submit.disabled=false;}};
    section.append(list,h('details.iv-category-create',h('summary','Создать свою подборку'),create,error));return section;
  }
  async function openEditor(placeNodeId=null){
    if(editor||busy)return;if(placeNodeId)followSpace(M.getNode(doc,placeNodeId));toast.className='iv-toast';clearWorld();window.__inventoryPlan=structuredClone(activePlan());
    const editorData=()=>({furniture:structuredClone(doc.nodes.filter(n=>n.kind==='furniture'&&!n.archived&&(!index().space(n)||index().space(n).id===activeSpaceId))),placeNodeId});window.__inventoryEditorData=editorData();
    window.__inventoryClearEditor=pendingPlan=>new Promise(resolve=>{const dialog=modal('Удалить всё с карты?',(body,close)=>{const error=h('p.iv-form-error',{role:'alert'}),submit=button('Очистить карту',async()=>{submit.disabled=true;try{await change(d=>{M.syncPlan(d,pendingPlan,{spaceId:activeSpaceId});M.clearApartment(d,{spaceId:activeSpaceId});},{action:'Очистка карты пространства'});focusId=null;focusTrail=[];selectedSection=null;place=null;sceneMemory=null;window.__inventoryPlan=structuredClone(activePlan());window.__inventoryEditorData=editorData();resolve(structuredClone(activePlan()));close();say('Карта очищена. Вещи перенесены в «Без места».');}catch(e){error.textContent=e.message;submit.disabled=false;}},'trash','danger');body.append(h('p','Все комнаты, мебель, свет, кондиционеры, двери и окна будут убраны. Карта станет полностью пустой.'),h('p','Сохранятся только вещи: они перейдут в «Без места». Мебель и отсеки попадут в корзину.'),h('p.iv-muted','Очистку можно отменить через «Отменить» после закрытия редактора.'),error,h('div.iv-actions',button('Отмена',close,'close'),submit));});dialog.addEventListener('close',()=>resolve(null),{once:true});});
    window.__inventorySavePlan=async plan=>{normalize(plan);await change(d=>M.syncPlan(d,plan,{spaceId:activeSpaceId}),{action:'Сохранение плана пространства'});window.__inventoryPlan=structuredClone(activePlan());window.__inventoryEditorData=editorData();say('План сохранён');};
    window.__inventoryDeleteFromEditor=async(nodeId,{plan:pendingPlan,furnitureId}={})=>{
      const preview=structuredClone(doc);if(pendingPlan)M.syncPlan(preview,pendingPlan,{spaceId:activeSpaceId});
      const target=M.getNode(preview,nodeId)||preview.nodes.find(n=>n.furnitureId===furnitureId);if(!target)throw Error('Мебель не найдена');
      return new Promise(resolve=>{const dialog=modal('Удалить в корзину',(body,close)=>{const nested=M.descendants(preview,target.id),options=deleteOptions(preview,target);const error=h('p.iv-form-error',{role:'alert'}),submit=button('Удалить в корзину',async()=>{submit.disabled=true;try{await change(d=>{if(pendingPlan){Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,structuredClone(preview));}const n=M.getNode(d,nodeId)||d.nodes.find(x=>x.furnitureId===furnitureId);M.remove(d,n.id,{...options.value()});},{action:'Удаление из редактора: '+target.name});window.__inventoryPlan=structuredClone(activePlan());window.__inventoryEditorData=editorData();resolve(structuredClone(activePlan()));close();}catch(e){error.textContent=e.message;submit.disabled=false;}},'trash','danger');body.append(h('p',`«${target.name}» исчезнет с плана и из каталога. Восстановление доступно в корзине.`),h('p.iv-muted','Текущие изменения плана будут сохранены вместе с удалением.'),...(nested.length?[options.element]:[]),error,h('div.iv-actions',button('Отмена',close,'close'),submit));});dialog.addEventListener('close',()=>resolve(null),{once:true});});
    };
    window.__inventoryCloseEditor=()=>{editor?.contentWindow?.house?.disposeEditor?.();editor?.remove();editor=null;sceneMemory=null;updateHistoryControls();draw();};editor=h('iframe.iv-editor',{src:'./index.html?inventoryEditor=1',title:'Редактор пространства'});document.body.append(editor);updateHistoryControls();
  }
  function setupHome(){modal('Начать свою квартиру',(body,close)=>{const mode=select([['empty','Пустая квартира — одна комната'],['plan','Текущий план с мебелью, без демо-вещей']],'empty',{'aria-label':'Начало своей квартиры'});const error=h('p.iv-form-error',{role:'alert'}),start=button('Сохранить копию и начать',async()=>{start.disabled=true;try{const result=await exportBackup();if(result===false){start.disabled=false;return;}const next=M.createHome(doc,{mode:mode.value});await change(d=>{Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,next);},{restore:true});detailId=null;place=null;sectionState.clear();close();go('space');say('Своя квартира создана. Предыдущие данные сохранены в копии.');}catch(e){error.textContent=e.message;start.disabled=false;}},'home','primary');body.append(h('p','Сначала сохраним резервную копию текущих данных. В новой квартире не будет демо-вещей, цен и истории.'),field('С чего начать',mode),error,start);});}
  function translateNames(){const translationSpace=M.PRIMARY_SPACE_ID,candidates=translationCandidates(doc.plan);modal('Перевод стандартных названий',(body,close)=>{const selected=new Set(candidates.map(c=>c.key));body.append(h('p.iv-muted','Проверьте список. Снимите отметку с названий, которые хотите сохранить. Пользовательские названия вне списка не меняются.'),...candidates.map(c=>{const box=h('input',{type:'checkbox'});box.checked=true;box.onchange=()=>box.checked?selected.add(c.key):selected.delete(c.key);return h('label.iv-translation-row',box,h('span',`${c.from} → ${c.to}`,h('small',c.label)));}),...(!candidates.length?[empty('Известных английских стандартных названий нет')]:[]),button('Перевести выбранные',async()=>{try{await change(d=>{translatePlan(d.plan,[...selected]);M.syncPlan(d,d.plan,{spaceId:translationSpace});});close();say('Выбранные названия переведены');}catch(e){say(e.message,true);}},'check','primary'));});}
  function drawSettings(){
    const note=text=>h('p.iv-muted',text);
    const actions=(...items)=>h('div.iv-actions',...items);
    const card=(name,...children)=>h('section.iv-card.iv-settings-card',h('h2',name),...children);
    const toggle=(label,checked,description,onchange,disabled=false)=>{
      const control=h('input',{type:'checkbox','aria-label':label,disabled});control.checked=checked;
      control.onchange=async()=>{const next=control.checked;control.disabled=true;try{await onchange(next);}catch(e){control.checked=!next;say(e.message,true);}finally{control.disabled=disabled;}};
      return h('label.iv-setting-row',h('span',h('strong',label),h('small',description)),control);
    };
    const nativeAction=(label,command,glyph,enabled=true,after)=>{
      const control=button(label,async()=>{control.disabled=true;try{
        nativeSettings={...nativeSettings,...await call(command)};await after?.();draw(true);
      }catch(e){say(e.message,true);}finally{control.disabled=!enabled;}},glyph);
      control.disabled=!enabled;return control;
    };
    const motion=select([['system','Как в системе'],['on','Плавная анимация'],['off','Без анимации']],doc.settings.motion||'system',{
      'aria-label':'Анимации интерфейса и камеры',onchange:e=>run(d=>d.settings.motion=e.target.value)});
    const appearanceCard=appearance.settings();
    appearanceCard.append(h('div.iv-settings-divider'),
      toggle('Компактное боковое меню',appearance.prefs.collapsed,'Только значки. На телефоне меню открывается отдельной кнопкой.',value=>appearance.set({collapsed:value})),
      field('Анимации интерфейса и камеры',motion),note('Режим анимаций общий для базы. «Как в системе» учитывает настройку уменьшения движения.'));

    const days=input(reminderDraft??doc.settings.reminderDays,{type:'number',min:0,max:365,step:1,required:true,'aria-label':'За сколько дней напоминать',oninput:e=>{reminderDraft=e.target.value;}});
    const saveDays=button('Сохранить',null,'check','primary');saveDays.type='submit';
    const reminderForm=h('form.iv-reminder-form',{onsubmit:async e=>{
      e.preventDefault();if(!days.reportValidity())return;
      saveDays.disabled=true;const previous=reminderDraft;reminderDraft=null;
      try{await change(d=>d.settings.reminderDays=Number(days.value));say('Интервал напоминаний сохранён');}
      catch{reminderDraft=previous;}finally{saveDays.disabled=false;}
    }},h('div.iv-settings-inline',field('За сколько дней до срока напоминать',days),saveDays),
      note('От 0 до 365 дней. 0 — напомнить в день окончания срока. Применяется к срокам годности и гарантии во всех пространствах.'));
    const notifications=isNative?toggle('Уведомления macOS',Boolean(doc.settings.notifications),
      nativeSettings.notificationAuthorization==='denied'?'Разрешите уведомления Life Assistant в системных настройках macOS.':'Напоминания вне приложения, когда подходит важная дата.',async enabled=>{
        if(enabled){const result=await call('inventoryNotifications');if(!result.allowed)throw Error('Разрешите уведомления Life Assistant в системных настройках macOS');}
        await change(d=>d.settings.notifications=enabled);
      }):note(isLAN?'Уведомления настраиваются в приложении Life Assistant на Mac. Интервал выше общий для всех устройств.':'Системные уведомления доступны в приложении Life Assistant на Mac. В браузере важные даты видны в общей сводке.');
    const remindersCard=card('Сроки и напоминания',reminderForm,h('div.iv-settings-divider'),notifications);

    const exports=card('Скачать данные',note(isLAN?'Общая база хранится на Mac. Скачанные файлы останутся на этом устройстве.':isNative?'База хранится на этом Mac. Сохраняйте копию в другом месте, чтобы её можно было восстановить.':'В этом просмотре база хранится в браузере. Скачайте резервную копию перед очисткой данных браузера.'),
      h('div.iv-setting-action',h('div',h('h3','Полная резервная копия'),note('Все пространства, вещи, фотографии и история. Подходит для восстановления базы.')),button('Скачать копию',exportBackup,'download')),
      h('div.iv-setting-action',h('div',h('h3','Таблица вещей'),note('Excel для просмотра и работы с перечнем имущества. Не заменяет резервную копию.')),button('Все вещи в Excel',exportExcel,'download')));
    const backups=isNative?card('Автоматические копии',
      note('Одна копия в день, пока приложение запущено. Хранятся последние 5, фотографии включены.'),
      h('dl.iv-settings-facts',h('dt','Последняя копия'),h('dd',nativeSettings.lastBackupAt?new Date(nativeSettings.lastBackupAt).toLocaleString('ru-RU'):'Ещё не создана'),
        h('dt','Сохранено копий'),h('dd',String(nativeSettings.backupCount||0)),h('dt','Папка'),h('dd',nativeSettings.backupFolder||'Не выбрана')),
      nativeSettings.lastBackupError?h('p.iv-form-error',{role:'alert'},nativeSettings.lastBackupError):null,
      actions(nativeAction(nativeSettings.backupFolder?'Изменить папку':'Выбрать папку','inventoryBackupFolder','folder'),
        nativeAction('Создать копию сейчас','inventoryBackupNow','copy',Boolean(nativeSettings.backupFolder),()=>change(()=>{},{undoable:false,retryable:false}))),
      !nativeSettings.backupFolder?note('Сначала выберите папку для автоматических копий.'):null):null;
    const restore=isLAN?null:card('Восстановление',note('Заменяет текущую базу данными из выбранной копии. Перед заменой сохраняется защитная копия.'),
      button('Выбрать резервную копию…',importBackup,'undo'));
    const dataCards=[exports,backups,restore,...(!isNative?[card('Автоматическое сохранение копий',note('Настраивается в приложении Life Assistant на Mac. Здесь можно скачать копию вручную.'))]:[])].filter(Boolean);

    const phone=phoneAccessCard({native:isNative,remote:isLAN,status:nativeSettings.phoneAccess,call,error:text=>say(text,true)});
    const appCards=[card('Демо-режим',note('10 карточек с объяснениями, затем живая демо-квартира, автомобиль и заполненные разделы. Примеры исчезают при завершении и не попадают в вашу базу.'),
      isShowcase?note('Сейчас открыта демонстрация. Чтобы вернуться к своей базе, нажмите «Завершить демо» вверху.'):
        actions(button('Включить демо-режим',()=>demoTour.open(),'book'),button('Посмотреть демо-квартиру и разделы',()=>startShowcase(),'home'))),
      card('Life Assistant',h('p.iv-settings-version',`Версия ${APP_VERSION}`),
      actions(button('Что нового',showWhatsNew,'sparkles'),isNative?nativeAction('Проверить обновления…','inventoryCheckUpdates','download',Boolean(nativeSettings.updatesConfigured)):null),
      isNative?toggle('Проверять обновления автоматически',Boolean(nativeSettings.automaticUpdateChecks),
        nativeSettings.updatesConfigured?'Установка — после вашего подтверждения. Данные сохраняются.':'В этой сборке канал обновлений ещё не настроен.',
        async on=>{nativeSettings={...nativeSettings,...await call('inventoryAutomaticUpdates',{on})};},!nativeSettings.updatesConfigured):
        note('Обновления и запуск при входе настраиваются в приложении Life Assistant на Mac.'))];
    if(isNative)appCards.push(card('Запуск приложения',toggle('Открывать при входе в macOS',nativeSettings.login==='on',
      nativeSettings.login==='needsApproval'?'Разрешите запуск Life Assistant при входе в системных настройках macOS.':'После закрытия окна приложение продолжает работать. Полный выход — через меню приложения.',async on=>{
        nativeSettings={...nativeSettings,...await call('inventoryLogin',{on})};draw(true);
      })));
    if(!isLAN)appCards.push(card('Значок приложения',appIconPicker()),card('Стандартные названия',
      note('Просмотрите перевод стандартных названий комнат и мебели перед применением.'),button('Перевести названия…',translateNames,'list')));

    const groups=[
      ['appearance','Внешний вид','palette',[appearanceCard]],
      ['reminders','Напоминания','clock',[remindersCard]],
      ['data','Данные и копии','shield',dataCards],
      ['phone','Доступ с телефона','phone',[phone]],
      ['app','Приложение','gear',appCards],
    ];
    const tabs=h('div.iv-settings-tabs',{role:'tablist','aria-label':'Разделы настроек','aria-orientation':'horizontal'});
    const panels=h('div.iv-settings-panels');
    const activate=id=>{
      settingsSection=id;
      for(const tab of tabs.children){const active=tab.id===`settings-tab-${id}`;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
      for(const panel of panels.children)panel.hidden=panel.id!==`settings-panel-${id}`;
    };
    for(const [id,label,glyph,cards] of groups){
      const tab=h('button.iv-btn.iv-settings-tab',{type:'button',role:'tab',id:`settings-tab-${id}`,'aria-controls':`settings-panel-${id}`,onclick:()=>activate(id)},icon(glyph,17),label);
      tab.onkeydown=e=>{const current=groups.findIndex(([key])=>key===id);let next;
        if(e.key==='ArrowRight')next=(current+1)%groups.length;else if(e.key==='ArrowLeft')next=(current-1+groups.length)%groups.length;
        else if(e.key==='Home')next=0;else if(e.key==='End')next=groups.length-1;else return;
        e.preventDefault();activate(groups[next][0]);tabs.children[next].focus();
      };
      tabs.append(tab);panels.append(h('section.iv-settings-panel',{id:`settings-panel-${id}`,role:'tabpanel','aria-labelledby':tab.id,tabindex:0},...cards));
    }
    content.replaceChildren(title('Настройки','Оформление, напоминания и ваши данные'),h('div.iv-settings-page',tabs,panels));activate(settingsSection);
  }
  function appIconPicker(){
    const selected=nativeSettings.appIcon||localStorage.getItem('iv:app-icon')||'aurora';
    return h('section.iv-icon-settings',h('h3','Иконка Life Assistant в Dock'),h('div.iv-app-icons',...APP_ICONS.map(item=>{
      const b=button('',async()=>{b.disabled=true;try{if(isNative){nativeSettings={...nativeSettings,...await call('inventoryAppIcon',{icon:item.id})};}else localStorage.setItem('iv:app-icon',item.id);drawSettings();say(isNative?'Иконка Dock изменена':'Вариант выбран для предпросмотра. Иконка Dock меняется в Mac-приложении.');}catch(e){b.disabled=false;say(e.message,true);}});
      b.setAttribute('aria-label',item.name);b.setAttribute('aria-pressed',String(selected===item.id));b.replaceChildren(h('img',{src:appIconPath(item.id),alt:'',width:72,height:72}),h('span',item.name));if(selected===item.id)b.append(icon('check',14));return b;
    })),h('p.iv-muted',isNative?'Значок в Dock меняется сразу. Выбор сохраняется после перезапуска и обновлений. В Finder остаётся основная иконка.':'Здесь можно посмотреть варианты. Смена значка Dock доступна в приложении macOS.'));
  }
  function importExcel(){
    const dialog=modal('Импорт вещей из Excel',(body,close)=>{
      const file=h('input',{type:'file',accept:'.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','aria-label':'Файл Excel с вещами'});
      const message=h('p.iv-muted',{'role':'status','aria-live':'polite'}),error=h('p.iv-form-error',{role:'alert'});
      const previewBox=h('div.iv-import-preview'),duplicateBox=h('div.iv-import-duplicates');
      const duplicateMode=select([['skip','Пропустить совпадения'],['add','Добавить все как отдельные вещи']],'skip',{'aria-label':'Что делать с дубликатами'});
      const submit=button('Импортировать',async()=>{
        if(!rows)return;
        submit.disabled=true;file.disabled=true;duplicateMode.disabled=true;error.textContent='';message.textContent='Добавляем вещи…';
        try{
          let count=0;await change(d=>{count=importInventoryRows(d,rows,{duplicateMode:duplicateMode.value}).length;},{action:'Импорт вещей из Excel',retryable:false});
          close();go('unplaced');say(count?`В «Без места» добавлено: ${plural(count,['вещь','вещи','вещей'])}`:'Новых вещей не найдено');
        }catch(e){message.textContent='';error.textContent=e.message;submit.disabled=false;file.disabled=false;duplicateMode.disabled=false;}
      },'check','primary');
      let rows=null;
      submit.disabled=true;previewBox.hidden=true;duplicateBox.hidden=true;
      duplicateMode.addEventListener('change',()=>{
        if(!rows)return;
        const preview=previewInventoryImport(doc,rows);
        submit.disabled=duplicateMode.value==='skip'&&!preview.newItems.length;
        submit.textContent=duplicateMode.value==='skip'?`Импортировать ${preview.newItems.length}`:`Импортировать ${preview.items.length}`;
      });
      body.append(h('p','Выберите .xlsx, проверьте найденные вещи и подтвердите импорт в «Без места».'),
        h('ol',h('li','Название'),h('li','Категория — необязательно'),h('li','Подкатегория — необязательно, с категорией во втором столбце'),h('li','Вес в граммах — необязательно'),h('li','Цена в рублях — необязательно')),
        h('p.iv-muted','Можно заполнить только название. Новые категории создадутся автоматически. Читается первый лист. Заголовки необязательны, пустые строки пропускаются. До 5 000 вещей и 10 МБ за раз.'),
        field('Файл Excel .xlsx',file),message,previewBox,duplicateBox,error,
        h('p.iv-muted','Импорт можно целиком отменить кнопкой «Отменить».'),h('div.iv-actions',button('Отмена',close,'close'),submit));
      file.addEventListener('change',async()=>{
        const selected=file.files?.[0];if(!selected)return;
        rows=null;previewBox.hidden=true;duplicateBox.hidden=true;submit.disabled=true;
        file.disabled=true;error.textContent='';message.textContent='Читаем и проверяем файл…';
        try{
          rows=await readInventoryExcel(selected);if(!dialog.isConnected)return;
          const preview=previewInventoryImport(doc,rows),duplicates=preview.existingDuplicates.length+preview.fileDuplicates.length;
          message.textContent=`Файл «${selected.name}» проверен. Пока ничего не добавлено.`;
          previewBox.hidden=false;previewBox.replaceChildren(h('strong',`Всего: ${preview.items.length} · новых: ${preview.newItems.length}`));
          duplicateBox.hidden=!duplicates;
          if(duplicates){
            const examples=[...preview.existingDuplicates,...preview.fileDuplicates].slice(0,5);
            duplicateBox.replaceChildren(h('p.iv-import-warning',`Внимание: совпадений с уже внесёнными вещами — ${preview.existingDuplicates.length}; повторов внутри файла — ${preview.fileDuplicates.length}.`),
              h('p.iv-muted','Совпадения определяются по названию без учёта регистра и лишних пробелов. Выберите, что делать с дубликатами:'),
              field('Дубликаты',duplicateMode),h('p.iv-muted',`Примеры: ${examples.map(item=>item.name).join(', ')}${duplicates>examples.length?'…':''}.`));
          }
          duplicateMode.value='skip';duplicateMode.dispatchEvent(new Event('change'));
        }catch(e){rows=null;message.textContent='';error.textContent=e.message;}
        finally{file.disabled=false;}
      });
    });
  }
  async function exportExcel(){
    try{const bytes=createInventoryWorkbook(doc),filename='Life-Assistant-'+M.today()+'.xlsx';
      if(isNative){const result=await call('inventoryExportExcel',{base64:bytesBase64(bytes)});if(result.cancelled)return;}
      else {const url=URL.createObjectURL(new Blob([bytes],{type:EXCEL_MIME})),link=h('a',{href:url,download:filename});link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
      say('Excel: все вещи и отдельный лист архива выгружены');
    }catch(e){say('Не удалось экспортировать в Excel: '+e.message,true);}
  }
  async function exportBackup(){try{if(isNative){const result=await call('inventoryExport');return !result.cancelled;}const a=h('a',{href:URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'})),download:`Life-Assistant-${M.today()}.json`});a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return true;}catch(e){say(e.message,true);return false;}}
  async function importBackup(){
    const apply=async raw=>{try{M.migrate(raw);M.validate(raw);M.listSpaces(raw).forEach(s=>normalize(s.plan));if(!confirm(`Восстановить «${raw.plan.name||'Квартира'}»? В копии ${M.totals(raw).items} вещей, пространств: ${M.listSpaces(raw).length}. Текущие данные будут сохранены в защитную копию.`))return;
      if(!isNative&&!isLAN)localStorage.setItem(storageKey+':before-restore',JSON.stringify(doc));
      await change(d=>{Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,structuredClone(raw));},{restore:true});place=null;say('Копия восстановлена');draw();}catch(e){say('Восстановление: '+e.message,true);}};
    try{if(isNative){const r=await call('inventoryImport');if(r.document)await apply(r.document);}else{const file=h('input',{type:'file',accept:'application/json,.json'});file.addEventListener('change',async()=>{try{if(!file.files[0])return;if(file.files[0].size>100*1024*1024)throw Error('Размер копии больше 100 МБ');await apply(JSON.parse(await file.files[0].text()));}catch(e){say(e.message,true);}});file.click();}}catch(e){say(e.message,true);}
  }
  window.__inventoryFocusSearch=()=>{searchInput.focus();searchInput.select();};
  incoming.shown=()=>{world?.setRunning(true);sceneUI?.weatherFx.setRunning(true);refreshSceneWeather();};incoming.hidden=()=>{world?.setRunning(false);sceneUI?.weatherFx.setRunning(false);};
  incoming.inventorySettings=next=>{nativeSettings={...nativeSettings,...next};refreshAwards();if(view==='settings')draw(true);};
  incoming.backupError=text=>{nativeSettings.lastBackupError=text;alertBar.hidden=false;alertBar.replaceChildren(h('span','Резервная копия: '+text),button('Открыть настройки',()=>go('settings'),'settings'));};
  function routeHistory(redo=false){
    if(document.querySelector('dialog[open]')){
      if(editingText(document.activeElement))document.execCommand(redo?'redo':'undo');
      return;
    }
    const frame=editor?.contentWindow;
    if(frame){frame.house?.[redo?'inventoryRedo':'inventoryUndo']?.();return;}
    if(editingText(document.activeElement))document.execCommand(redo?'redo':'undo');else undo(redo);
  }
  incoming.inventoryUndo=()=>routeHistory();
  incoming.inventoryRedo=()=>routeHistory(true);
  incoming.inventoryOpenNode=id=>{const n=M.getNode(doc,id);if(n)details(n);else say('Вещь из уведомления больше не найдена',true);};
  function offerSharedUpdate(){
    sharedNotice='remote';alertBar.hidden=false;
    alertBar.replaceChildren(h('span','Данные изменились на другом устройстве. Обновите их перед следующей правкой.'),button('Обновить данные',()=>refreshSharedDocument(true),'rotate'));
    const form=document.querySelector('dialog[open] .if-form-scroll');
    if(form&&!form.querySelector('.iv-shared-reload'))form.append(button('Обновить данные',()=>refreshSharedDocument(true),'rotate','iv-shared-reload'));
  }
  async function refreshSharedDocument(force=false){
    if((!lan&&!isNative)||busy||sharedRefreshing)return;
    const dialogs=[...document.querySelectorAll('dialog[open]')];
    const unsafe=Boolean(editor)||dialogs.length>0||editingText(document.activeElement)&&document.activeElement!==searchInput||view==='categories'||view==='settings';
    if(force&&editor){say('Закройте редактор пространства перед обновлением данных',true);return;}
    if(force&&unsafe){
      if(!confirm('Обновить данные с Mac? Несохранённые изменения в открытых формах будут потеряны.'))return;
      for(const dialog of dialogs)dialog.close();document.activeElement?.blur();
    }
    if(remotePending&&unsafe&&!force){offerSharedUpdate();return;}
    sharedRefreshing=true;
    try{
      const result=lan?await lan.state(doc.revision||0):await call('inventorySnapshot');
      if(busy)return;
      if(!result.document||(result.document.revision||0)<=(doc.revision||0)){
        if(sharedNotice==='network'){alertBar.hidden=true;sharedNotice=null;status.textContent='Связь с Mac восстановлена';}
        remotePending=false;return;
      }
      if(unsafe&&!force){remotePending=true;offerSharedUpdate();return;}
      const next=result.document,original=structuredClone(next);M.migrate(next);M.validate(next);M.listSpaces(next).forEach(s=>normalize(s.plan));
      clearWorld();doc=next;readIndex=null;history.clear();failedAction=null;remotePending=false;sharedNotice=null;
      migrationPending=!sameValue(original,next);originalDocument=migrationPending?original:null;
      if(!M.getSpace(doc,activeSpaceId))activeSpaceId=M.PRIMARY_SPACE_ID;
      if(place&&!M.getNode(doc,place))place=null;if(detailId&&!M.getNode(doc,detailId))detailId=null;
      focusId=null;focusTrail=[];selectedSection=null;sceneMemory=null;selected.clear();sectionState.clear();
      if(category&&!doc.categories.some(c=>c.id===category))category='';
      alertBar.hidden=true;status.textContent='Данные обновлены с Mac';updateHistoryControls();draw(true);
    }catch(error){
      if(lan){sharedNotice='network';status.textContent='Нет связи с Mac';alertBar.hidden=false;alertBar.replaceChildren(h('span',error.message),button('Проверить связь',()=>refreshSharedDocument(),'rotate'));}
      else if(force)say(error.message,true);
    }finally{sharedRefreshing=false;}
  }
  incoming.inventoryRemoteChanged=()=>{remotePending=true;refreshSharedDocument();};
  function scheduleSharedRefresh(){
    clearTimeout(sharedTimer);if(!lan)return;
    sharedTimer=setTimeout(async()=>{if(!document.hidden)await refreshSharedDocument();scheduleSharedRefresh();},3000);
  }
  window.addEventListener('pagehide',()=>clearTimeout(sharedTimer));
  window.addEventListener('pageshow',()=>{if(lan){refreshSharedDocument();scheduleSharedRefresh();}});
  document.addEventListener('visibilitychange',()=>{if(lan&&!document.hidden){refreshSharedDocument();scheduleSharedRefresh();}});
  window.addEventListener('keydown',e=>{if(editor)return;const editing=editingText(e.target),command=historyShortcut(e);if(command&&!editing&&!document.querySelector('dialog[open]')){e.preventDefault();undo(command==='redo');return;}if(e.key==='Escape'&&focusId&&view==='space'&&!editing&&!document.querySelector('dialog[open]')){e.preventDefault();leaveStorage();return;}if(e.key==='Escape'&&detailId&&!document.querySelector('dialog[open]')){detailId=null;drawDetails();}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(view==='monitoring')monitoring.focusSearch();else if(view==='automobile')automobile.focusSearch();else if(view==='travel')travel.focusSearch();else{searchInput.focus();searchInput.select();}}if(e.metaKey&&e.key===','){e.preventDefault();go('settings');}});
  window.addEventListener('keydown',e=>{if(e.key==='Escape')setMobileMenu(false);});
  document.addEventListener('visibilitychange',()=>{monitoring.setRunning(!document.hidden);automobile.setRunning(!document.hidden);travel.setRunning(!document.hidden);world?.setRunning(!document.hidden);sceneUI?.weatherFx.setRunning(!document.hidden);if(!document.hidden)refreshSceneWeather();});
  window.addEventListener('focus',()=>{world?.setRunning(!document.hidden);monitoring.setRunning(!document.hidden);automobile.setRunning(!document.hidden);travel.setRunning(!document.hidden);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)recordAwardVisit();});
  window.addEventListener('focus',recordAwardVisit);
  root.addEventListener('pointerdown',recordAwardVisit,{passive:true});
  root.addEventListener('keydown',recordAwardVisit);
  window.addEventListener('pagehide',()=>{itemMaster.stop();monitoring.dispose();automobile.dispose();travel.dispose();});
  incoming.monitoringOpenApartment=id=>{monitoring.openApartment(id);go('monitoring');};
  // Explicit inspection surface for local UI checks; no network or external API.
  window.__inventory={get document(){return structuredClone(doc);},go,open:nId=>open(M.getNode(doc,nId)),get world(){return view==='travel'?travel.world:view==='automobile'?automobile.world:view==='monitoring'?monitoring.world:world;}};
  if(isShowcase){
    // Used only by the surrounding guide; it never has access to a personal document.
    window.__inventory.showcaseGo=({section,selector,tab})=>{
      if(editor)window.__inventoryCloseEditor();
      for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
      if(section==='editor'){openEditor();return;}
      go(section);
      if(selector&&tab){const control=[...content.querySelectorAll(`${selector} button`)].find(b=>b.textContent.trim()===tab);if(!control)throw Error('Вкладка не найдена: '+tab);control.click();}
    };
  }
  if(!window.__HOUSE_BOOT__?.inventory && isNative)await persist(doc);
  updateHistoryControls();draw();post('ready');if(isNative)call('inventorySystemStatus').then(next=>{nativeSettings={...nativeSettings,...next};refreshAwards();if(view==='settings')draw(true);}).catch(()=>{});if(awardsAtBoot)await change(()=>{},{undoable:false,retryable:false}).catch(()=>{});
  if(isShowcase)window.parent.postMessage({type:'life-assistant-showcase-ready'},'*');
  else if(demoTour.shouldResumeShowcase)startShowcase(true);
  else if(demoTour.shouldAutoStart)demoTour.open({automatic:true});else finishFirstLaunch();
  scheduleSharedRefresh();
}
