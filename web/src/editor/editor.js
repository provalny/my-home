import { randomID } from '../uuid.js';
// Home editor (a window on the Mac, full screen on the iPhone): a top-down plan you can drag
// things around on, an inspector for the selected item, a live 3D preview and the links to
// real devices. On a phone the same pieces are laid out for a finger: the plan fills the
// screen, the inspector is a sheet from the bottom, pinch zooms and drag pans.
import './editor.css';
import { roomPoints, roomContains, roomInteriorPoint } from '../geometry/room.js';
import { roomContourForm } from './room-contour.js';
import { normalize, loadRawConfig, LIGHT_KINDS, LIGHT_INTENSITY_DEFAULTS, FLOOR_KINDS, isLinked } from '../config.js';
import { createWorld } from '../three/world.js';
import { updateWallAttachments } from '../three/wall-attachment.js';
import { updateSurfaceAttachments, SURFACE_ITEMS } from '../three/surface-attachment.js';
import { FURNITURE_TYPES, footprint } from '../three/furniture.js';
import { EQUIPMENT_FIELDS } from '../inventory/equipment.js';
import { EXTRA_MODEL_INFO, extraDimensions } from '../three/furniture-info.js';
import { h, clamp } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { isNative, isPhone, call, post, haptic, incoming } from '../bridge.js';
import { createConnections } from './connections.js';
import { FURNITURE_NAMES } from '../inventory/model.js';
import { openObjectCatalog } from './catalog.js';
import { OBJECT_SECTIONS, objectSection } from './object-sections.js';
import { roomGlyph } from '../inventory/room-icons.js';
import { FURNITURE_GLYPHS } from '../inventory/appearance.js';
import { roomPresentationForm } from '../inventory/room-form.js';
import { IKEA_STORAGE } from '../inventory/ikea-storage.js';
import { historyShortcut, editingText } from '../inventory/action-history.js';

const SVG = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  el.append(...kids.filter((k) => k != null));
  return el;
};

const KEYS = { room: 'rooms', light: 'lights', ac: 'acs', furniture: 'furniture', opening: 'openings', scene: 'scenes' };
const TITLES = { room: 'Комнаты', light: 'Свет', ac: 'Кондиционеры', furniture: 'Мебель', opening: 'Двери и окна', scene: 'Сцены' };
const FLOOR_FILL = { oak: '#4a3d2e', walnut: '#3c2f28', tile: '#39424b', stone: '#30353c', carpetWhite: '#eeece7', carpetGrey: '#95979b', laminateLightOak: '#d7c4a0' };
const WALLS = ['north', 'east', 'south', 'west'];
const WALL_NAMES = { north: 'Северная', east: 'Восточная', south: 'Южная', west: 'Западная' };
const LIGHT_NAMES = { ceiling: 'Потолочный', pendant: 'Подвесной', spots: 'Споты', floor: 'Торшер', table: 'Настольный', strip: 'Светодиодная лента' };
const SCENE_ICONS = ['sun', 'sofa', 'film', 'moon', 'door', 'table', 'bed', 'tv', 'sparkles'];
const REGIONS = [
  ['eu', 'Центральная Европа'], ['eu-w', 'Западная Европа'], ['us', 'Западная Америка'], ['us-e', 'Восточная Америка'],
  ['cn', 'Китай'], ['in', 'Индия'], ['sg', 'Сингапур'],
];

const round = (v, step = 0.05) => Math.round(v / step) * step;
const fix = (v) => Math.round(v * 1000) / 1000;
const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';

export async function bootEditor(root, options = {}) {
  const inventory = Boolean(options.inventory);
  const inventoryData = () => inventory ? (window.parent.__inventoryEditorData || { furniture: [] }) : { furniture: [] };
  const inventoryNode = (item) => (inventoryData().furniture || []).find(n => n.id === item.inventoryNodeId) || (inventoryData().furniture || []).find(n => n.furnitureId === item.id);
  let doc = structuredClone(options.config || await loadRawConfig());
  for (const key of Object.values(KEYS)) doc[key] ||= [];
  const rememberCardLinks = () => { if (inventory) for (const item of doc.furniture) { const node = inventoryNode(item); if (node) item.inventoryNodeId = node.id; } };
  rememberCardLinks();

  // "connections", "service:smartlife|homeassistant|hue|homekit": where the editor opens
  // (HOUSE_OPEN_EDITOR, or the Mac's Settings window through incoming.openSection).
  const sectionSel = (at) => (at === 'connections' ? { kind: 'connections' }
    : at.startsWith('service:') ? { kind: 'service', service: at.slice(8) }
      : at === 'tuya' ? { kind: 'service', service: 'smartlife' } : { kind: 'home' });
  let sel = sectionSel(window.__HOUSE_BOOT__?.section || new URLSearchParams(location.search).get('section') || '');
  let dirty = false;
  let world = null,previewResize = null;
  const layoutObservers=[];
  function disposePreview(){clearTimeout(previewTimer);previewTimer=0;previewResize?.disconnect();previewResize=null;world?.dispose();world=null;}
  let phone = null; // the iPhone's layout and gestures, set up by buildPhoneLayout()
  let previewLights = true;
  let deletingFurniture = false;
  let saving = false;
  let layout = { side: 220, right: 300, sideClosed: false, rightClosed: false, previewClosed: false };
  try { Object.assign(layout, JSON.parse(localStorage.getItem('myhome:editor-layout') || '{}')); } catch { /* defaults */ }
  let narrowPanel=null;
  const compactPanels=()=>!isPhone&&innerWidth<=700;
  const panelClosed=key=>compactPanels()?narrowPanel!==key:layout[key];
  const undo = [];
  const redo = [];
  let savedDocument = JSON.stringify(doc);
  const tuya = {
    info: window.__HOUSE_BOOT__?.tuya || { configured: false, accessId: '', region: 'eu' },
    account: window.__HOUSE_BOOT__?.smartLife || { connected: false, userCode: '', account: '' },
    devices: null, busy: false, error: null, qr: null,
    get linked() { return this.account.connected || this.info.configured; },
  };
  const links = createConnections({
    rerender: () => {
      renderSidebar();
      if (['connections', 'service', 'light', 'ac'].includes(sel.kind)) renderInspector();
    },
    toast,
    usedBy: () => links.usedMap(doc),
    // On the iPhone the connection screens are native ones, shown over the editor.
    onOpen: (service) => (isPhone && service ? post('openConnection', { service })
      : select(service ? { kind: 'service', service } : { kind: 'connections' })),
  });
  // Smart Life signed in or out on its own screen: the overview and the pickers follow.
  const smartLifeChanged = () => links.refreshInfo().then(() => links.load({ quiet: true }));

  /* ---------- layout ---------- */

  const nameInput = h('input.title-input', { value: doc.name || 'Квартира', spellcheck: 'false', 'aria-label': inventory?'Название пространства':'Название квартиры' });
  nameInput.addEventListener('input', () => { snapshot('name'); doc.name = nameInput.value; touch({ inspector: sel.kind === 'home' }); });
  const status = h('div.status');
  const saveBtn = h('button.btn.primary', { onclick: save }, icon('check', 15, 2.4), 'Сохранить план');
  const undoBtn = h('button.btn.icon-btn', { title: 'Отменить правку в редакторе (⌘Z)', 'aria-label': 'Отменить', disabled: true, onclick: () => stepHistory(undo, redo) }, icon('undo', 16));
  const redoBtn = h('button.btn.icon-btn', { title: 'Повторить правку в редакторе (⇧⌘Z)', 'aria-label': 'Повторить', disabled: true, onclick: () => stepHistory(redo, undo) }, icon('redo', 16));
  const hint = h('div.hint', isPhone ? 'Нажмите для выбора · перетащите выбранное · разведите пальцы для масштаба'
    : 'Перетаскивайте комнаты и мебель · угол комнаты меняет размер · шаг сетки 5 см');
  const toastEl = h('div.toast');

  const sidebar = h('aside.side');
  const collapsedGroups=new Set(JSON.parse(localStorage.getItem('iv:editor-collapsed-groups')||'[]'));
  function saveGroups(){localStorage.setItem('iv:editor-collapsed-groups',JSON.stringify([...collapsedGroups]));renderSidebar();}
  const plan = sv('svg', { class: 'plan', tabindex: 0 });
  const inspector = h('div.inspector');
  const previewHost = h('div.preview');
  const previewToggle = h('button.chip', { onclick: () => { previewLights = !previewLights; schedulePreview(0); } });
  const sideToggle = h('button.btn.panel-toggle', { 'aria-label': 'Свернуть список объектов', onclick: () => setLayout('sideClosed', !panelClosed('sideClosed')) }, 'Объекты');
  const inspectorToggle = h('button.btn.panel-toggle', { 'aria-label': 'Свернуть свойства', onclick: () => setLayout('rightClosed', !panelClosed('rightClosed')) }, 'Свойства');
  const previewCollapse = h('button.btn', { onclick: () => setLayout('previewClosed', !layout.previewClosed) });
  const sidebarRestore = h('button.panel-restore', { onclick: () => setLayout('sideClosed', false), 'aria-label': 'Развернуть список объектов' }, icon('list', 18));
  const rightRestore = h('button.panel-restore', { onclick: () => setLayout('rightClosed', false), 'aria-label': 'Развернуть свойства' }, icon('settings', 18));

  if (isPhone) buildPhoneLayout();
  else root.replaceChildren(h(`div.editor${inventory ? '.inventory-editor' : ''}`,
    h('header.bar',
      h('div.bar-title', icon('home', 17), nameInput,inventory?h('button.btn.danger',{onclick:clearAll},icon('trash',15),'Удалить всё'):null),
      h('div.bar-actions',
        inventory?h('button.btn',{onclick:searchInventory,title:'Поиск по всем пространствам. Текущие изменения плана сохранятся.'},icon('search',15),'Найти вещь'):null,sideToggle, inspectorToggle,
        undoBtn, redoBtn,
        h('button.btn', { onclick: importPlan }, 'Импорт…'),
        h('button.btn', { onclick: exportPlan }, 'Экспорт…'),
        saveBtn,
        inventory ? h('button.btn', { onclick: () => { if (!dirty || confirm('Выйти без сохранения изменений плана?')) options.onClose?.(); } }, 'Закрыть редактор') : null)),
    h('div.side-shell', sidebar, sidebarRestore),
    h('main.canvas', plan, hint, resizeHandle('side'), resizeHandle('right')),
    h('aside.right', h('div.panel-heading', previewCollapse), h('div.preview-wrap', previewHost, previewToggle), inspector, rightRestore),
    h('footer.foot', status),
    toastEl));

  function setLayout(key, value) {
    if(compactPanels()&&['sideClosed','rightClosed'].includes(key)){
      narrowPanel=value?null:key;applyLayout();schedulePreview(0);return;
    }
    layout[key] = value;
    try { localStorage.setItem('myhome:editor-layout', JSON.stringify(layout)); } catch { /* no persistence */ }
    applyLayout();
    if (key === 'previewClosed' || key === 'rightClosed') schedulePreview(0);
  }
  function applyLayout() {
    if (isPhone) return;
    const shell = root.querySelector('.editor');
    if (!shell) return;
    const available = Math.max(680, root.clientWidth || innerWidth);
    const sideSize = layout.sideClosed ? 38 : clamp(Number(layout.side) || 220, 170, Math.max(170, available - (layout.rightClosed ? 38 : 260) - 300));
    const rightSize = layout.rightClosed ? 38 : clamp(Number(layout.right) || 300, 260, Math.max(260, available - sideSize - 300));
    shell.style.setProperty('--side-width', `${sideSize}px`);
    shell.style.setProperty('--right-width', `${rightSize}px`);
    shell.classList.toggle('side-closed', panelClosed('sideClosed'));
    shell.classList.toggle('right-closed', panelClosed('rightClosed'));
    shell.classList.toggle('preview-closed', layout.previewClosed);
    sideToggle.setAttribute('aria-expanded', String(!panelClosed('sideClosed')));
    sideToggle.setAttribute('aria-label', panelClosed('sideClosed') ? 'Развернуть список объектов' : 'Свернуть список объектов');
    inspectorToggle.setAttribute('aria-expanded', String(!panelClosed('rightClosed')));
    inspectorToggle.setAttribute('aria-label', panelClosed('rightClosed') ? 'Развернуть свойства' : 'Свернуть свойства');
    previewCollapse.textContent = layout.previewClosed ? 'Показать 3D-предпросмотр' : 'Свернуть 3D-предпросмотр';
    previewCollapse.setAttribute('aria-expanded', String(!layout.previewClosed));
    world?.resize();
  }
  function resizeHandle(which) {
    const handle = h(`div.panel-resize.${which}`, { role: 'separator', tabindex: 0, 'aria-orientation': 'vertical', 'aria-label': which === 'side' ? 'Ширина списка объектов' : 'Ширина свойств' });
    let start = null;
    handle.addEventListener('pointerdown', e => { const current = parseFloat(root.querySelector('.editor')?.style.getPropertyValue(`--${which}-width`)); start = { x: e.clientX, width: current || Number(layout[which]) || (which === 'side' ? 220 : 300) }; handle.setPointerCapture(e.pointerId); e.preventDefault(); });
    handle.addEventListener('pointermove', e => { if (!start) return; layout[`${which}Closed`] = false; layout[which] = clamp(start.width + (e.clientX - start.x) * (which === 'side' ? 1 : -1), which === 'side' ? 170 : 260, 520); applyLayout(); });
    const end = () => { if (!start) return; start = null; setLayout(which, layout[which]); };
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
    handle.addEventListener('keydown', e => { if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return; e.preventDefault(); layout[`${which}Closed`] = false; setLayout(which, clamp((Number(layout[which]) || 260) + (e.key === 'ArrowRight' ? 20 : -20) * (which === 'side' ? 1 : -1), which === 'side' ? 170 : 260, 520)); });
    return handle;
  }
  if (!isPhone) {const observer=new ResizeObserver(()=>{
    const closed=root.querySelector('.editor')?.classList.contains('right-closed');applyLayout();
    if(closed!==root.querySelector('.editor')?.classList.contains('right-closed'))schedulePreview(0);
  });observer.observe(root);layoutObservers.push(observer);}
  applyLayout();

  /* ---------- history ---------- */

  let lastSnapshotKey = null;
  function snapshot(key = null) {
    if (key && key === lastSnapshotKey) return; // coalesce a drag or a burst of typing into one step
    lastSnapshotKey = key;
    undo.push(JSON.stringify(doc));
    if (undo.length > 100) undo.shift();
    redo.length = 0;
  }

  function stepHistory(from, to) {
    if (!from.length || saving || deletingFurniture || document.querySelector('dialog[open]')) return;
    to.push(JSON.stringify(doc));
    doc = JSON.parse(from.pop());
    lastSnapshotKey = null;
    if (sel.index != null && !doc[KEYS[sel.kind]]?.[sel.index]) sel = { kind: 'home' };
    nameInput.value = doc.name || '';
    touch();
  }

  function touch({ inspector: redrawInspector = true, preview = true } = {}) {
    updateWallAttachments(doc.furniture,doc.rooms,{movingId:sel.kind==='furniture'?doc.furniture[sel.index]?.id:null});
    updateSurfaceAttachments(doc.furniture,{movingId:sel.kind==='furniture'?doc.furniture[sel.index]?.id:null});
    const active=sel.kind==='furniture'?doc.furniture[sel.index]:null;
    if(!redrawInspector&&active&&SURFACE_ITEMS.has(active.type)){
      const height=inspector.querySelector('[data-surface-height]'),note=inspector.querySelector('.surface-note');
      if(height)height.value=active.y||0;if(note)note.textContent=surfaceNote(active);
    }
    dirty = JSON.stringify(doc) !== savedDocument;
    renderSidebar();
    renderPlan();
    if (redrawInspector) renderInspector();
    validate();
    if(preview)schedulePreview();
  }

  function select(next) {
    sel = next;
    lastSnapshotKey = null;
    renderSidebar();
    renderPlan();
    renderInspector();
    if (isPhone) phone.selected(next);
    else if(compactPanels()&&narrowPanel==='sideClosed')setLayout('rightClosed',false);
  }

  function toast(text, bad = false) {
    toastEl.textContent = text;
    toastEl.className = `toast show${bad ? ' bad' : ''}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { toastEl.className = 'toast'; }, 2600);
  }

  /* ---------- validation + preview ---------- */

  let valid = null;
  function validate() {
    try {
      if (inventory) {
        const outside = doc.furniture.find(f => !doc.rooms.some(r => roomContains(r,f.pos)));
        if (outside) throw Error(`«${outside.name || FURNITURE_NAMES[outside.type] || 'Мебель'}» находится вне комнат. Переместите её в комнату или уберите с плана.`);
      }
      valid = normalize(structuredClone(doc));
      const linked = [...doc.lights, ...doc.acs].filter(isLinked).length;
      status.className = 'status';
      status.replaceChildren(h('span.ok', '●'), inventory ? ` ${doc.rooms.length} комнат · ${doc.furniture.length} предметов мебели` : ` ${doc.rooms.length} rooms · ${linked} linked`, dirty ? h('span.dirty', ' · есть несохранённые изменения') : '');
    } catch (e) {
      valid = null;
      status.className = 'status bad';
      status.textContent = `⚠ ${e.message}`;
    }
    saveBtn.disabled = !valid || saving;
    undoBtn.disabled = saving || deletingFurniture || !undo.length;
    redoBtn.disabled = saving || deletingFurniture || !redo.length;
    if (isPhone) phone.refresh();
  }

  function previewStore(cfg) {
    const state = { lights: {}, acs: {} };
    for (const l of cfg.lights) state.lights[l.id] = { on: previewLights, brightness: 0.85, temp: 3200, color: l.color || null };
    for (const a of cfg.acs) state.acs[a.id] = { on: inventory ? false : previewLights, mode: 'cool', fan: 'auto', swing: 'swing', sleep: false, target: 23 };
    return { state, on: () => () => {} };
  }

  let previewTimer = 0;
  function schedulePreview(delay = 350) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(buildPreview, delay);
  }

  function buildPreview() {
    previewToggle.replaceChildren(icon(previewLights ? 'bright' : 'moon', 14), previewLights ? 'Свет включён' : 'Свет выключен');
    if (!valid) {disposePreview();previewHost.replaceChildren();return;}
    if (!isPhone && (layout.previewClosed || panelClosed('rightClosed'))) { disposePreview(); previewHost.replaceChildren(); return; }
    if (isPhone && !phone.show3D) { disposePreview(); previewHost.replaceChildren(); return; }
    disposePreview();
    const canvas = h('canvas');
    previewHost.replaceChildren(canvas);
    try {
      world = createWorld(canvas, valid, previewStore(valid), {
        onHover() {},
        onPick(t) {
          if (!t) return;
          const index = doc[KEYS[t.kind]].findIndex((x) => x.id === t.id);
          if (index >= 0) select({ kind: t.kind, index });
        },
      });
      world.setInsets(isPhone ? 20 : 6, isPhone ? 20 : 6);
      world.setRunning(true);
      const w = world;
      previewResize=new ResizeObserver(() => { if (world === w) w.resize(); });previewResize.observe(canvas);
    } catch (e) {
      disposePreview();
      previewHost.replaceChildren(h('div.preview-error', String(e.message || e)));
    }
  }

  /* ---------- sidebar ---------- */

  function rowLabel(kind, item) {
    if (kind === 'room') return [item.name || item.id, `${fix(item.rect[2])} × ${fix(item.rect[3])} м`];
    if (kind === 'light') return [item.name || item.id, `${roomName(item.room)} · ${LIGHT_NAMES[item.type] || item.type}`];
    if (kind === 'ac') return [item.name || item.id, `${roomName(item.room)} · ${WALL_NAMES[item.wall] || item.wall}`];
    if (kind === 'furniture') return [item.name || inventoryNode(item)?.name || FURNITURE_NAMES[item.type] || item.type, roomName(roomAt(item.pos)?.id) || '—'];
    if (kind === 'opening') return [{door:'Дверь',open:'Проход',window:'Окно'}[item.type] || 'Дверь', `${fix(Math.hypot(item.to[0] - item.from[0], item.to[1] - item.from[1]))} м`];
    return [item.name || item.id, `${Object.keys(item.lights || {}).length} rules`];
  }

  const roomName = (id) => doc.rooms.find((r) => r.id === id)?.name || id || '';
  const roomAt = ([x, z]) => doc.rooms.find(r => roomContains(r,[x,z]));

  function renderSidebar() {
    const nodes = [h(`button.row.home-row${sel.kind === 'home' ? '.active' : ''}`, { onclick: () => select({ kind: 'home' }) },
      icon('home', 15), h('span.row-name', inventory?'Настройки пространства':'Настройки квартиры')),
    inventory ? null : links.sidebarRow(sel.kind === 'connections' || sel.kind === 'service', () => select({ kind: 'connections' }))];
    const groups=Object.keys(KEYS).flatMap(k=>k==='furniture'?Object.keys(OBJECT_SECTIONS):[k]);
    const kinds=groups.filter(k=>!inventory||k!=='scene'),allClosed=kinds.every(k=>collapsedGroups.has(k));
    nodes.push(h('button.group-all',{onclick:()=>{for(const k of kinds)allClosed?collapsedGroups.delete(k):collapsedGroups.add(k);saveGroups();}},icon(allClosed?'plus':'minus',13),allClosed?'Развернуть всё':'Свернуть всё'));
    for (const group of groups) {
      const kind=OBJECT_SECTIONS[group]?'furniture':group;
      const title=OBJECT_SECTIONS[group]||TITLES[kind];
      if (inventory && kind === 'scene') continue;
      const items = doc[KEYS[kind]].map((item,index)=>({item,index})).filter(({item})=>kind!=='furniture'||objectSection(item.type)===group);
      nodes.push(h('div.group',
        h('button.group-toggle',{'aria-expanded':String(!collapsedGroups.has(group)),'aria-label':`${collapsedGroups.has(group)?'Развернуть':'Свернуть'}: ${title}`,onclick:()=>{collapsedGroups.has(group)?collapsedGroups.delete(group):collapsedGroups.add(group);saveGroups();}},icon(collapsedGroups.has(group)?'next':'down',13),h('span',`${title}`)), h('span.n', items.length),
        h('button.add', { title: `Добавить: ${title.toLowerCase()}`, 'aria-label': `Добавить: ${title.toLowerCase()}`, onclick: () => OBJECT_SECTIONS[group]?showCatalog(group):add(kind) }, icon('plus', 14, 2.4))));
      if(collapsedGroups.has(group))continue;
      items.forEach(({item, index}) => {
        const [name, sub] = rowLabel(kind, item);
        const active = sel.kind === kind && sel.index === index;
        nodes.push(h(`div.row${active ? '.active' : ''}`, { role: 'button', tabindex: 0, onclick: () => select({ kind, index }), onkeydown: e => { if (e.target === e.currentTarget && ['Enter', ' '].includes(e.key)) { e.preventDefault(); select({ kind, index }); } } },
          icon(kind==='room'?roomGlyph(item):kind==='furniture'?FURNITURE_GLYPHS[item.type]||'furniture':kind==='light'?item.type:kind==='ac'?'ac':'opening',14),h('span.row-name', name),
          !inventory && isLinked(item) ? h('span.linked', { title: 'Связано с реальным устройством' }, icon('link', 12, 2.2)) : null,
          h('span.row-sub', sub),
          h('button.del', { title: kind === 'room' ? 'Удалить комнату' : 'Убрать с плана', 'aria-label': `${kind === 'room' ? 'Удалить комнату' : 'Убрать с плана'}: ${name}`, onclick: (e) => { e.stopPropagation(); remove(kind, index); } }, icon('close', 13, 2.4))));
      });
    }
    const top = sidebar.scrollTop;
    sidebar.replaceChildren(...nodes.filter(Boolean));
    sidebar.scrollTop = top;
  }

  function uniqueId(base) {
    const ids = new Set([...doc.rooms, ...doc.lights, ...doc.acs, ...doc.scenes].map((x) => x.id));
    if (!ids.has(base)) return base;
    for (let i = 2; ; i++) if (!ids.has(`${base}${i}`)) return `${base}${i}`;
  }

  function add(kind) {
    collapsedGroups.delete(kind);localStorage.setItem('iv:editor-collapsed-groups',JSON.stringify([...collapsedGroups]));
    if (inventory && ['furniture', 'light', 'ac'].includes(kind)) return showCatalog(kind);
    snapshot();
    const room = (sel.kind === 'room' && doc.rooms[sel.index]) || doc.rooms.find((r) => r.id === doc[KEYS[sel.kind]]?.[sel.index]?.room) || doc.rooms[0];
    const center = room ? roomInteriorPoint(room).map(fix) : [1, 1];
    const list = doc[KEYS[kind]];
    if (kind === 'room') {
      const maxX = Math.max(0, ...doc.rooms.map((r) => r.rect[0] + r.rect[2]));
      const minZ = Math.min(...doc.rooms.map((r) => r.rect[1]), 0);
      list.push({ id: uniqueId('room'), name: 'Комната', roomType:'other', customName:'Комната', rect: [fix(maxX), fix(doc.rooms.length ? minZ : 0), 3, 3], floor: 'oak' });
    } else if (kind === 'light') {
      if (!room) return toast('Сначала добавьте комнату', true);
      list.push({ id: uniqueId(`${room.id}.light`), name: 'Новый светильник', room: room.id, type: 'ceiling', pos: freeSpot(room, center), capabilities: [] });
    } else if (kind === 'ac') {
      if (!room) return toast('Сначала добавьте комнату', true);
      list.push({ id: uniqueId(`${room.id}.ac`), name: `${room.name} — кондиционер`, room: room.id, wall: 'north', pos: [center[0], room.rect[1]], y: 2.2 });
    } else if (kind === 'furniture') {
      list.push({ id: randomID(), type: 'sofa', pos: center, rot: 0 });
    } else if (kind === 'opening') {
      if (!room) return toast('Сначала добавьте комнату', true);
      const z = room.rect[1] + room.rect[3];
      list.push({ type: 'door', from: [fix(center[0] - 0.45), fix(z)], to: [fix(center[0] + 0.45), fix(z)] });
    } else if (kind === 'scene') {
      list.push({ id: uniqueId('scene'), name: 'Новая сцена', icon: 'sparkles', lights: { '*': { on: false } } });
    }
    sel = { kind, index: list.length - 1 };
    touch();
  }

  function availableInventoryFurniture(current = null) {
    return (inventoryData().furniture || []).filter(n => !doc.furniture.some(f => f !== current && (f.inventoryNodeId === n.id || f.id === n.furnitureId)));
  }
  function showCatalog(kind = 'furniture', nodeId = null) {
    if (!doc.rooms.length) return toast('Сначала добавьте комнату', true);
    const selected = doc[KEYS[sel.kind]]?.[sel.index];
    const targetRoom = sel.kind === 'room' ? doc.rooms[sel.index] : doc.rooms.find(r => r.id === selected?.room) || (selected?.pos ? roomAt(selected.pos) : null) || doc.rooms[0];
    const linkedType = nodeId ? inventoryData().furniture.find(n => n.id === nodeId)?.modelType : null;
    if (linkedType) kind = objectSection(linkedType);
    openObjectCatalog({ kind, existing: availableInventoryFurniture(), placeNodeId: nodeId, rooms: doc.rooms, roomId: targetRoom?.id, onChoose: choice => {
      const room = doc.rooms.find(r => r.id === choice.roomId);
      if (!room) return;
      snapshot();
      const center = roomInteriorPoint(room).map(fix);
      let entry;
      if (choice.kind === 'furniture') {
        const node = (inventoryData().furniture || []).find(n => n.id === choice.nodeId);
        entry = { id: node?.furnitureId || randomID(), type: choice.type, name: node?.name || choice.name, pos: center, rot: 0 };
        if (EXTRA_MODEL_INFO[choice.type]?.defaultY) entry.y = EXTRA_MODEL_INFO[choice.type].defaultY;
        if (choice.type === 'tireStack' && choice.layout) entry.layout = choice.layout;
        if (node) entry.inventoryNodeId = node.id;
      } else if (choice.kind === 'light') entry = { id: uniqueId(`${room.id}.light`), name: choice.name, room: room.id, type: choice.type, pos: freeSpot(room, center), capabilities: [] };
      else entry = { id: uniqueId(`${room.id}.ac`), name: `${room.name} — кондиционер`, room: room.id, wall: 'north', pos: [center[0], room.rect[1]], y: 2.2 };
      doc[KEYS[choice.kind]].push(entry);
      collapsedGroups.delete(choice.kind==='furniture'?objectSection(choice.type):choice.kind);localStorage.setItem('iv:editor-collapsed-groups',JSON.stringify([...collapsedGroups]));
      sel = { kind: choice.kind, index: doc[KEYS[choice.kind]].length - 1 };
      touch();
    }});
  }

  // The middle of the room, or the nearest place around it no other lamp stands on.
  function freeSpot(room, center) {
    const [x, z, w, d] = room.rect;
    const taken = (p) => doc.lights.some((l) => Math.hypot(l.pos[0] - p[0], l.pos[1] - p[1]) < 0.45);
    for (let ring = 0; ring < 4; ring++) {
      for (let k = 0; k < Math.max(1, ring * 6); k++) {
        const a = (k / Math.max(1, ring * 6)) * Math.PI * 2;
        const p = [fix(round(center[0] + Math.cos(a) * ring * 0.6)), fix(round(center[1] + Math.sin(a) * ring * 0.6))];
        if (roomContains(room,p) && p[0] > x + 0.2 && p[0] < x + w - 0.2 && p[1] > z + 0.2 && p[1] < z + d - 0.2 && !taken(p)) return p;
      }
    }
    return center;
  }

  function remove(kind, index) {
    const item = doc[KEYS[kind]]?.[index];
    if (!item) return;
    if (kind === 'room' && doc.rooms.length === 1) return toast('Добавьте другую комнату, прежде чем удалить последнюю', true);
    if (inventory && kind === 'room' && !confirm(`Удалить комнату «${item.name || item.id}»? Её вещи и мебель останутся в разделе «Без места». Объекты оформления этой комнаты будут убраны с плана после сохранения.`)) return;
    const roomFurniture = inventory && kind === 'room' ? new Set(doc.furniture.filter(f => roomAt(f.pos)?.id === item.id).map(f => f.id)) : null;
    snapshot();
    const [gone] = doc[KEYS[kind]].splice(index, 1);
    if (kind === 'room') {
      if (inventory) {
        doc.furniture = doc.furniture.filter(f => !roomFurniture.has(f.id));
      }
      // Devices cannot outlive their room.
      doc.lights = doc.lights.filter((l) => l.room !== gone.id);
      doc.acs = doc.acs.filter((a) => a.room !== gone.id);
    }
    if (kind === 'light' || kind === 'ac' || kind === 'room') {
      const ids = new Set([...doc.lights, ...doc.acs].map((d) => d.id));
      for (const sc of doc.scenes) {
        for (const map of [sc.lights, sc.acs]) for (const id of Object.keys(map || {})) if (id !== '*' && !ids.has(id)) delete map[id];
      }
    }
    sel = { kind: 'home' };
    touch();
  }

  async function trashFurniture(item) {
    const node = inventoryNode(item);
    if (!window.parent.__inventoryDeleteFromEditor) return toast('Удаление в корзину сейчас недоступно', true);
    if (deletingFurniture) return;
    try {
      if (!valid) throw Error('Сначала исправьте ошибки в плане');
      deletingFurniture = true;
      // The parent previews the draft, asks how to handle contents, then saves
      // the plan and deletion together. Cancel leaves this draft untouched.
      const plan = await window.parent.__inventoryDeleteFromEditor(node?.id || null, { plan: structuredClone(doc), furnitureId: item.id });
      if (!plan) return;
      doc = structuredClone(plan);
      nameInput.value = doc.name || 'Моя квартира';
      for (const key of Object.values(KEYS)) doc[key] ||= [];
      rememberCardLinks();
      undo.length = 0; redo.length = 0; lastSnapshotKey = null;
      savedDocument = JSON.stringify(doc);
      sel = { kind: 'home' };
      touch(); dirty = false; validate();
      toast('Мебель перемещена в корзину');
    } catch (e) { validate(); toast(e.message, true); }
    finally { deletingFurniture = false; validate(); }
  }

  /* ---------- plan (SVG) ---------- */

  function bounds() {
    const rs = doc.rooms.length ? doc.rooms : [{ rect: [0, 0, 6, 4] }];
    const minX = Math.min(...rs.map((r) => r.rect[0]));
    const minZ = Math.min(...rs.map((r) => r.rect[1]));
    const maxX = Math.max(...rs.map((r) => r.rect[0] + r.rect[2]));
    const maxZ = Math.max(...rs.map((r) => r.rect[1] + r.rect[3]));
    return { minX, minZ, maxX, maxZ };
  }

  const isSel = (kind, index) => sel.kind === kind && sel.index === index;

  function renderPlan() {
    const b = bounds();
    const m = 1.4;
    if (isPhone) phone.applyView();
    else plan.setAttribute('viewBox', `${b.minX - m} ${b.minZ - m} ${b.maxX - b.minX + m * 2} ${b.maxZ - b.minZ + m * 2}`);
    // Fingers are bigger than a mouse pointer: on a phone small things get a wider target.
    const big = isPhone;
    const kids = [
      sv('defs', {}, sv('pattern', { id: 'grid', width: 1, height: 1, patternUnits: 'userSpaceOnUse' },
        sv('path', { d: 'M1 0H0V1', fill: 'none', stroke: 'rgba(255,255,255,0.07)', 'stroke-width': 0.015 }),
        sv('path', { d: 'M0.5 0V1M0 0.5H1', fill: 'none', stroke: 'rgba(255,255,255,0.03)', 'stroke-width': 0.01 }))),
      sv('rect', { x: b.minX - 20, y: b.minZ - 20, width: 60, height: 60, fill: 'url(#grid)', 'data-kind': 'none' }),
    ];

    doc.rooms.forEach((r, i) => {
      const [x, z, w, d] = r.rect;
      const g = sv('g', { class: `p-room${isSel('room', i) ? ' sel' : ''}`, 'data-kind': 'room', 'data-index': i },
        sv('polygon', { points:roomPoints(r).map(p=>p.join(',')).join(' '), fill: FLOOR_FILL[r.floor] || FLOOR_FILL.oak }),
        sv('text', { x: x + w / 2, y: z + d / 2 - 0.02, class: 'p-label' }, document.createTextNode(r.name || r.id)),
        sv('text', { x: x + w / 2, y: z + d / 2 + 0.3, class: 'p-dim' }, document.createTextNode(`${fix(w)} × ${fix(d)}`)));
      kids.push(g);
    });

    doc.furniture.forEach((f, i) => {
      if (!Array.isArray(f.pos)) return;
      const [w, d] = footprint(f);
      kids.push(sv('g', {
        class: `p-furn${isSel('furniture', i) ? ' sel' : ''}`, 'data-kind': 'furniture', 'data-index': i,
        transform: `translate(${f.pos[0]} ${f.pos[1]}) rotate(${-(f.rot || 0)})`,
      },
        sv('rect', { x: -w / 2, y: -d / 2, width: w, height: d, rx: 0.06 }),
        // a tick marks the front of the piece
        sv('path', { d: `M${-w / 4} ${d / 2}H${w / 4}`, class: 'front' })));
    });

    doc.openings.forEach((o, i) => {
      if (big) kids.push(sv('line', { class: 'p-hit', 'data-kind': 'opening', 'data-index': i, x1: o.from[0], y1: o.from[1], x2: o.to[0], y2: o.to[1] }));
      kids.push(sv('line', {
        class: `p-open ${o.type || 'door'}${isSel('opening', i) ? ' sel' : ''}`, 'data-kind': 'opening', 'data-index': i,
        x1: o.from[0], y1: o.from[1], x2: o.to[0], y2: o.to[1],
      }));
    });

    doc.acs.forEach((a, i) => {
      const rot = { north: 0, east: 90, south: 180, west: 270 }[a.wall] || 0;
      kids.push(sv('g', {
        class: `p-ac${isSel('ac', i) ? ' sel' : ''}`, 'data-kind': 'ac', 'data-index': i,
        transform: `translate(${a.pos[0]} ${a.pos[1]}) rotate(${rot})`,
      }, big ? sv('rect', { x: -0.62, y: -0.12, width: 1.24, height: 0.74, class: 'hit' }) : null,
        sv('rect', { x: -0.47, y: 0.08, width: 0.94, height: 0.24, rx: 0.07 }),
        sv('path', { d: 'M-0.3 0.42v0.22M0 0.42v0.3M0.3 0.42v0.22', class: 'flow' })));
    });

    doc.lights.forEach((l, i) => {
      const g = sv('g', {
        class: `p-light ${l.type}${isSel('light', i) ? ' sel' : ''}${isLinked(l) ? ' linked' : ''}`, 'data-kind': 'light', 'data-index': i,
        transform: `translate(${l.pos[0]} ${l.pos[1]}) rotate(${-(l.rot || 0)})`,
      });
      if (big) g.append(sv('circle', { r: 0.58, class: 'hit' }));
      if (l.type === 'strip') {
        const len = l.length || 1;
        g.append(sv('rect', { x: -len / 2, y: -0.07, width: len, height: 0.14, rx: 0.07 }));
      } else {
        g.append(sv('circle', { r: 0.34, class: 'halo' }), sv('circle', { r: l.type === 'table' ? 0.13 : 0.19 }));
      }
      kids.push(g);
    });

    if (sel.kind === 'room' && doc.rooms[sel.index]) {
      const [x, z, w, d] = doc.rooms[sel.index].rect;
      if (big) kids.push(sv('circle', { cx: x + w, cy: z + d, r: 0.55, class: 'hit', 'data-kind': 'resize', 'data-index': sel.index }));
      kids.push(sv('circle', { cx: x + w, cy: z + d, r: big ? 0.24 : 0.16, class: 'p-handle', 'data-kind': 'resize', 'data-index': sel.index }));
    }
    plan.replaceChildren(...kids);
  }

  function planPoint(ev) {
    const pt = plan.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const p = pt.matrixTransform(plan.getScreenCTM().inverse());
    return [p.x, p.y];
  }

  // Puts an AC on the nearest wall of the room under (or nearest to) the pointer.
  function snapAC(ac, [x, z]) {
    const room = roomAt([x, z]) || doc.rooms.find((r) => r.id === ac.room);
    if (!room) return;
    const [rx, rz, rw, rd] = room.rect;
    const options = [
      ['north', Math.abs(z - rz)], ['south', Math.abs(z - (rz + rd))],
      ['west', Math.abs(x - rx)], ['east', Math.abs(x - (rx + rw))],
    ].sort((p, q) => p[1] - q[1]);
    const wall = options[0][0];
    ac.room = room.id;
    ac.wall = wall;
    const cx = fix(clamp(round(x), rx + 0.6, rx + rw - 0.6));
    const cz = fix(clamp(round(z), rz + 0.6, rz + rd - 0.6));
    ac.pos = wall === 'north' ? [cx, rz] : wall === 'south' ? [cx, fix(rz + rd)] : wall === 'west' ? [rx, cz] : [fix(rx + rw), cz];
  }

  let drag = null;
  plan.addEventListener('pointerdown', (ev) => {
    if (isPhone) return;
    const el = ev.target.closest('[data-kind]');
    const kind = el?.dataset.kind;
    if (!kind || kind === 'none') { select({ kind: 'home' }); return; }
    plan.setPointerCapture(ev.pointerId);
    startDrag(kind, Number(el.dataset.index), ev);
  });

  // Picks up an item (or a room's resize handle) under the pointer.
  function startDrag(kind, index, ev) {
    const start = planPoint(ev);
    if (kind === 'resize') {
      drag = { kind, index, start, rect: [...doc.rooms[index].rect] };
      return;
    }
    if (!isSel(kind, index)) select({ kind, index });
    const item = doc[KEYS[kind]][index];
    drag = { kind, index, start, moved: false };
    if (kind === 'room') {
      const [x, z, w, d] = item.rect;
      const inside = p => roomContains(item,p);
      drag.rect = [...item.rect];
      // Everything standing in the room travels with it.
      drag.riders = [
        ...doc.lights.filter((l) => l.room === item.id).map((o) => ({ o, pos: [...o.pos] })),
        ...doc.acs.filter((a) => a.room === item.id).map((o) => ({ o, pos: [...o.pos] })),
        ...doc.furniture.filter((f) => Array.isArray(f.pos) && inside(f.pos)).map((o) => ({ o, pos: [...o.pos] })),
      ];
      drag.openings = doc.openings.filter((o) => inside(o.from) && inside(o.to)).map((o) => ({ o, from: [...o.from], to: [...o.to] }));
    } else if (kind === 'opening') {
      drag.from = [...item.from];
      drag.to = [...item.to];
    } else {
      drag.pos = [...item.pos];
    }
  }

  plan.addEventListener('pointermove', (ev) => { if (!isPhone) moveDrag(ev); });

  function moveDrag(ev) {
    if (!drag) return;
    const [px, pz] = planPoint(ev);
    const dx = round(px - drag.start[0]);
    const dz = round(pz - drag.start[1]);
    if (!drag.moved && !dx && !dz) return;
    if (!drag.moved) { drag.moved = true; snapshot(); haptic('tick'); }
    const item = drag.kind === 'resize' ? doc.rooms[drag.index] : doc[KEYS[drag.kind]][drag.index];

    if (drag.kind === 'resize') {
      item.rect[2] = fix(Math.max(1, round(drag.rect[2] + px - drag.start[0], 0.1)));
      item.rect[3] = fix(Math.max(1, round(drag.rect[3] + pz - drag.start[1], 0.1)));
    } else if (drag.kind === 'room') {
      const mx = round(px - drag.start[0], 0.1);
      const mz = round(pz - drag.start[1], 0.1);
      item.rect[0] = fix(drag.rect[0] + mx);
      item.rect[1] = fix(drag.rect[1] + mz);
      for (const r of drag.riders) r.o.pos = [fix(r.pos[0] + mx), fix(r.pos[1] + mz)];
      for (const r of drag.openings) {
        r.o.from = [fix(r.from[0] + mx), fix(r.from[1] + mz)];
        r.o.to = [fix(r.to[0] + mx), fix(r.to[1] + mz)];
      }
    } else if (drag.kind === 'opening') {
      item.from = [fix(drag.from[0] + dx), fix(drag.from[1] + dz)];
      item.to = [fix(drag.to[0] + dx), fix(drag.to[1] + dz)];
    } else if (drag.kind === 'ac') {
      snapAC(item, [px, pz]);
    } else {
      item.pos = [fix(drag.pos[0] + dx), fix(drag.pos[1] + dz)];
      if (drag.kind === 'light') {
        const room = roomAt(item.pos);
        if (room) item.room = room.id;
      }
    }
    touch();
  }

  const endDrag = () => { drag = null; lastSnapshotKey = null; };
  plan.addEventListener('pointerup', () => { if (!isPhone) endDrag(); });
  plan.addEventListener('pointercancel', () => { if (!isPhone) endDrag(); });

  /* ---------- inspector ---------- */

  // A labelled input bound to a getter/setter; edits redraw everything except the form itself.
  function bind(label, input, { get, set, parse = (v) => v, event = 'input', livePreview = null }) {
    const v = get();
    if (input.type === 'checkbox') input.checked = Boolean(v);
    else input.value = v ?? '';
    input.addEventListener(event, () => {
      const raw = input.type === 'checkbox' ? input.checked : input.value;
      const next = parse(raw);
      if (next === undefined) return;
      snapshot(label + sel.kind + sel.index);
      set(next);
      // Pickers and checkboxes can change which fields exist; typing must keep its focus.
      const updatedLive=previewTimer===0&&livePreview?.();
      touch({ inspector: event === 'change', preview: !updatedLive });
    });
    return h('label.field', h('span', label), input);
  }

  function lightIntensityControl(item){
    const base=LIGHT_INTENSITY_DEFAULTS[item.type],percent=Math.round((item.intensity??base)/base*100);
    const slider=h('input',{type:'range',min:0,max:Math.max(300,percent),step:1,value:percent,'aria-label':'Интенсивность света, ползунок'});
    const value=h('input',{type:'number',min:0,max:Math.max(300,percent),step:1,value:percent,'aria-label':'Интенсивность света, %'});
    const set=source=>{if(source.value==='')return;const parsed=Number(source.value);if(!Number.isFinite(parsed))return;const next=clamp(parsed,0,Number(value.max));snapshot('light-intensity:'+item.id);item.intensity=Number((base*next/100).toFixed(6));slider.value=next;value.value=next;touch({inspector:false});};
    slider.oninput=()=>set(slider);value.oninput=()=>set(value);
    return h('div',h('label.field',h('span','Интенсивность, %'),slider),h('label.field',h('span','Точное значение, %'),value),h('p.note','100% — обычная интенсивность этого типа лампы. 0% гасит свет, до 300% усиливает его. Изменение сразу видно в 3D.'));
  }

  function surfaceNote(item){
    if(item.surfaceSnap===false)return 'Высоту можно задать вручную.';
    const support=doc.furniture.find(f=>f.id===item.surfaceAttachment?.supportId);
    return support?'На поверхности: '+(support.name||FURNITURE_NAMES[support.type]||'мебель')+'. Предмет перемещается и поворачивается вместе с ней.':'Перетащите предмет на стол или тумбу — он автоматически встанет на поверхность. Вне мебели он располагается на полу.';
  }
  const number = (step = 0.05) => h('input', { type: 'number', step, inputmode: 'decimal' });
  const parseNum = (v) => (v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));
  const text = () => h('input', { type: 'text', spellcheck: 'false' });
  const choice = (options) => h('select', options.map((o) => (Array.isArray(o) ? h('option', { value: o[0] }, o[1]) : h('option', { value: o }, o))));

  const prop = (obj, key, fallback) => ({ get: () => obj[key] ?? fallback, set: (v) => { obj[key] = v; } });
  const at = (obj, key, i) => ({ get: () => obj[key][i], set: (v) => { obj[key][i] = v; } });
  const optional = (obj, key) => ({
    get: () => obj[key] ?? '',
    set: (v) => { if (v === '' || v == null) delete obj[key]; else obj[key] = v; },
  });
  const optNum = (v) => (v === '' ? '' : Number.isNaN(Number(v)) ? undefined : Number(v));

  const row = (...fields) => h('div.fields', fields);
  const section = (title, ...nodes) => h('section.block', h('h3', title), nodes);

  // Linking to a real device: links.deviceSection / links.sensorSection (connections.js).
  const linkHooks = { snapshot: () => snapshot(), changed: (note) => { touch(); if (note) toast(note); } };

  function renderInspector() {
    const kind = sel.kind;
    const item = sel.index != null ? doc[KEYS[kind]]?.[sel.index] : null;
    const nodes = [];
    const head = (title, sub) => nodes.push(isPhone
      ? h('div.insp-head', h('div.insp-titles', h('h2', title), sub ? h('span', sub) : null), phone.headActions())
      : h('div.insp-head', h('h2', title), sub ? h('span', sub) : null));

    if (kind === 'home') {
      head(inventory?'Пространство':'Квартира', 'Общие настройки планировки');
      doc.camera ||= { azimuth: 34, elevation: 47 };
      if (isPhone) nodes.push(section('Реальные устройства', links.sidebarRow(false, () => select({ kind: 'connections' }))));
      nodes.push(section('Помещение',
        row(bind('Высота стен, м', number(0.1), { ...prop(doc, 'wallHeight', 2.6), parse: parseNum }),
          bind('Высота показа внутренних стен, м', number(0.05), { ...prop(doc, 'interiorWallHeight', 1.25), parse: parseNum })),
        inventory ? null : bind('Температура снаружи, °C', number(1), { ...prop(doc, 'outdoorTemp', 27), parse: parseNum })),
      section('Камера',
        row(bind('Поворот, °', number(1), { ...prop(doc.camera, 'azimuth', 34), parse: parseNum }),
          bind('Наклон, °', number(1), { ...prop(doc.camera, 'elevation', 47), parse: parseNum })),
        h('p.note', inventory?'Ближние к камере стены скрыты. Поворот камеры определяет открытые стороны пространства.':'Ближние к камере стены скрыты. Поворот камеры определяет открытые стороны квартиры.')),
      section('Как пользоваться',
        h('p.note', isPhone
          ? 'Выберите объект на плане или в списке. Сохранение записывает план на iPhone и отправляет его на связанный Mac. Координаты в метрах: X — вправо, Z — вниз.'
          : 'Выберите объект на плане или в списке. Сохраните план, затем закройте редактор. Координаты в метрах. Удаление мебели с плана сохраняет её карточку и содержимое в каталоге.')));
    } else if (kind === 'connections') {
      head('Подключения', 'Настройка реальных светильников и кондиционеров');
      if (isPhone) nodes.push(h('button.back-link', { onclick: () => select({ kind: 'home' }) }, icon('back', 14, 2.2), 'Квартира'));
      nodes.push(...links.overview());
    } else if (kind === 'service') {
      nodes.push(h('button.back-link', { onclick: () => { links.stopPairing(); select({ kind: 'connections' }); } }, icon('back', 14, 2.2), 'Подключения'));
      nodes.push(h('div.insp-head.svc-head', links.tile(sel.service, 40),
        h('div', h('h2', links.title(sel.service)), h('span', links.blurb(sel.service)))));
      nodes.push(...[links.detail(sel.service, tuyaPanel)].flat());
    } else if (!item) {
      head('Ничего не выбрано');
      if (isPhone) nodes.push(h('p.note', 'Выберите комнату, светильник или другой объект на плане.'));
    } else if (kind === 'room') {
      head(item.name || 'Комната', 'Название и оформление комнаты');
      const roomForm=roomPresentationForm(item);
      nodes.push(section('Комната',roomForm.element,h('button.btn',{onclick:()=>{try{const copy=structuredClone(item);roomForm.apply(copy);snapshot();Object.keys(item).forEach(k=>delete item[k]);Object.assign(item,copy);touch();toast('Название и оформление обновлены');}catch(e){toast(e.message,true);}}},'Применить название и оформление'),
        bind('Покрытие пола', choice(FLOOR_KINDS.map(floor => [floor, {oak:'Дуб',walnut:'Орех',tile:'Плитка',stone:'Камень',carpetWhite:'Ковролин — белый',carpetGrey:'Ковролин — серый',laminateLightOak:'Ламинат — светлый дуб'}[floor] || floor])), { ...prop(item, 'floor', 'oak'), event: 'change' })),
      section('Положение и размеры, м',
        row(bind('X', number(0.1), { ...at(item, 'rect', 0), parse: parseNum }), bind('Z', number(0.1), { ...at(item, 'rect', 1), parse: parseNum })),
        row(bind('Ширина', number(0.1), { ...at(item, 'rect', 2), parse: parseNum }), bind('Глубина', number(0.1), { ...at(item, 'rect', 3), parse: parseNum })),
        h('p.note', 'Между соседними комнатами стена создаётся автоматически. Для соединения добавьте дверь или открытый проём.')),
      section('Форма комнаты: углы и выступы',roomContourForm(item,points=>{snapshot();item.contour=points;touch();toast('Форма комнаты обновлена');})));
    } else if (kind === 'light') {
      head(item.name || item.id, `ID: ${item.id}`);
      item.capabilities ||= [];
      const cap = (name) => ({
        get: () => item.capabilities.includes(name),
        set: (on) => { item.capabilities = item.capabilities.filter((c) => c !== name); if (on) item.capabilities.push(name); },
      });
      nodes.push(section('Светильник',
        bind('Название', text(), prop(item, 'name', '')),
        row(bind('Комната', choice(doc.rooms.map((r) => [r.id, r.name || r.id])), { ...prop(item, 'room'), event: 'change' }),
          bind('Тип светильника', choice(LIGHT_KINDS.map(type => [type, LIGHT_NAMES[type]])), { ...prop(item, 'type'), event: 'change' }))),
      section('Интенсивность света',lightIntensityControl(item)),
      section('Положение, м',
        row(bind('X', number(), { ...at(item, 'pos', 0), parse: parseNum }), bind('Z', number(), { ...at(item, 'pos', 1), parse: parseNum })),
        row(bind('Высота, м (пусто — автоматически)', number(), { ...optional(item, 'y'), parse: optNum }),
          bind('Поворот, °', number(15), { ...prop(item, 'rot', 0), parse: parseNum })),
        item.type === 'strip' ? bind('Длина ленты, м', number(0.1), { ...prop(item, 'length', 1), parse: parseNum }) : null),
      inventory ? section('Оформление',
        bind('Цвет света (необязательно)', text(), optional(item, 'color')),
        h('p.note', 'Декоративный светильник. На основном плане он не открывает управление.')) : section('Возможности',
        h('div.checks',
          bind('Регулировка яркости', h('input', { type: 'checkbox' }), { ...cap('brightness'), event: 'change' }),
          bind('Температура белого света', h('input', { type: 'checkbox' }), { ...cap('temp'), event: 'change' }),
          bind('Цвет', h('input', { type: 'checkbox' }), { ...cap('color'), event: 'change' })),
        h('p.note', 'Для лампы в обычной умной розетке отключите все три возможности: останется только включение и выключение.')),
      inventory ? null : links.deviceSection(item, 'light', linkHooks));
    } else if (kind === 'ac') {
      head(item.name || item.id, `ID: ${item.id}`);
      nodes.push(section('Кондиционер',
        bind('Название', text(), prop(item, 'name', '')),
        row(bind('Комната', choice(doc.rooms.map((r) => [r.id, r.name || r.id])), { ...prop(item, 'room'), event: 'change' }),
          bind('Стена крепления', choice(WALLS.map(wall => [wall, WALL_NAMES[wall]])), { ...prop(item, 'wall', 'north'), event: 'change' }))),
      section('Положение, м',
        row(bind('X', number(), { ...at(item, 'pos', 0), parse: parseNum }), bind('Z', number(), { ...at(item, 'pos', 1), parse: parseNum })),
        row(bind('Высота, м', number(), { ...prop(item, 'y', 2.2), parse: parseNum }),
          inventory ? null : bind('Минимум / максимум, °C', text(), {
            get: () => `${item.min ?? 16}-${item.max ?? 30}`,
            set: ([a, b]) => { item.min = a; item.max = b; },
            parse: (v) => { const m = /^(\d+)\s*-\s*(\d+)$/.exec(v.trim()); return m && +m[1] < +m[2] ? [+m[1], +m[2]] : undefined; },
          })),
        h('p.note', 'При перетаскивании кондиционер привязывается к ближайшей стене комнаты.'),
        inventory ? h('p.note', 'Декоративный объект. На основном плане он не открывает управление.') : null),
      inventory ? null : links.deviceSection(item, 'ac', linkHooks),
      inventory ? null : links.sensorSection(item, linkHooks));
    } else if (kind === 'furniture') {
      const linkedNode = inventoryNode(item);
      const dimension=(key,axis)=>({...optional(item,key),get:()=>EXTRA_MODEL_INFO[item.type]?extraDimensions(item)[axis]:item[key]??IKEA_STORAGE[item.type]?.size[axis]??''});
      head(item.name || linkedNode?.name || FURNITURE_NAMES[item.type] || item.type, OBJECT_SECTIONS[objectSection(item.type)]);
      nodes.push(section(OBJECT_SECTIONS[objectSection(item.type)],
        bind('Название', text(), { get: () => item.name || linkedNode?.name || FURNITURE_NAMES[item.type] || '', set: value => { item.name = value; } }),
        bind('Тип', choice(FURNITURE_TYPES.filter(t => objectSection(t) === objectSection(item.type)).map(t => [t, FURNITURE_NAMES[t] || t])), { ...prop(item, 'type'), event: 'change' }),
        row(bind('X', number(), { ...at(item, 'pos', 0), parse: parseNum }), bind('Z', number(), { ...at(item, 'pos', 1), parse: parseNum })),
        row(bind('Поворот, °', h('input',{type:'number',step:15,disabled:item.type==='neonPorsche'&&item.wallSnap!==false}), { ...prop(item, 'rot', 0), parse: parseNum }),
          EXTRA_MODEL_INFO[item.type]?.fixedSize ? null : bind('Ширина, м', number(0.1), { ...dimension('width',0), parse: optNum })),
        !EXTRA_MODEL_INFO[item.type]?.fixedSize && (EXTRA_MODEL_INFO[item.type]||IKEA_STORAGE[item.type]) ? row(
          bind('Высота, м', number(0.1), { ...dimension('height',1), parse: optNum }),
          bind('Глубина, м', number(0.1), { ...dimension('depth',2), parse: optNum })) : null,
        bind('От пола, м', h('input',{type:'number',step:.01,'data-surface-height':'',disabled:SURFACE_ITEMS.has(item.type)&&item.surfaceSnap!==false}), { ...prop(item, 'y', 0), parse: parseNum }),
        SURFACE_ITEMS.has(item.type)?bind('Привязка к поверхности',h('input',{type:'checkbox'}),{...prop(item,'surfaceSnap',true),event:'change'}):null,
        SURFACE_ITEMS.has(item.type)?h('p.note.surface-note',surfaceNote(item)):null,
        item.type==='neonPorsche'?bind('Привязка к стене',h('input',{type:'checkbox'}),{...prop(item,'wallSnap',true),event:'change'}):null,
        item.type==='neonPorsche'?h('p.note','Вывеска встаёт на ближайшую стену и поворачивается светящейся стороной в комнату. Высота задаётся в поле «От пола».'):null,
        item.type === 'parrotCage' ? bind('Попугаи в клетке', choice([['1','Один попугай'],['2','Два попугая']]), {get:()=>Number(item.parrotCount)===2?'2':'1',set:value=>{item.parrotCount=Number(value);},event:'change'}) : null,
        item.type === 'parrotCage' ? h('p.note','Попугаи прыгают между жердочками. Иногда появляются ноты, изредка — %@?$.') : null,
        item.type === 'trailSuv' ? h('div',
          ...[['frontLeft','Передняя левая дверь'],['frontRight','Передняя правая дверь'],['tailgate','Багажник открыт'],['hood','Капот открыт']].map(([key,label])=>bind(label,h('input',{type:'checkbox'}),{get:()=>Boolean(item.vehicleOpen?.[key]),set:value=>{item.vehicleOpen={...item.vehicleOpen,[key]:value?1:0};},event:'change',livePreview:()=>world?.setVehicleState(item.id,{vehicleOpen:{[key]:item.vehicleOpen[key]}})})),
          bind('Фары',h('input',{type:'checkbox'}),{get:()=>item.headlights!==false,set:value=>{item.headlights=value;},event:'change',livePreview:()=>world?.setVehicleState(item.id,{headlights:item.headlights})}),
          bind('Грязь на кузове, %',h('input',{type:'number',min:0,max:100,step:5}),{get:()=>Math.round((item.dirt??.45)*100),set:value=>{item.dirt=Math.max(0,Math.min(100,value))/100;},parse:parseNum}),
          h('p.note','В карточке машины — отдельное хранение в салоне и багажнике. Багаж появляется при добавлении вещей; заполненность можно задать вручную.')) : null,
        item.type === 'tireStack' ? bind('Как хранить 4 шины', choice([['stack','Стопкой'],['row','В ряд']]), { ...prop(item,'layout','stack'), event:'change' }) : null,
        item.type === 'cornerSofa' ? bind('Угол дивана', choice([['right','Справа'],['left','Слева']]), { ...prop(item,'chaise','right'), event:'change' }) : null,
        EXTRA_MODEL_INFO[item.type]?.capacityLiters ? bind('Цвет ткани',h('input',{type:'color'}),{...prop(item,'color',EXTRA_MODEL_INFO[item.type].color),event:'input'}) : bind('Цвет (hex, необязательно)', text(), optional(item, 'color')),
        EXTRA_MODEL_INFO[item.type]?.capacityLiters ? h('p.note',`Объём: ${EXTRA_MODEL_INFO[item.type].capacityLiters} л. Размер этой модели фиксирован; цвет ткани можно выбрать любой.`) : null,
        h('p.note', 'Короткая линия отмечает фасад. При повороте 0° он направлен к нижнему краю плана.')));
      if(EQUIPMENT_FIELDS[item.type]){
        nodes.push(section('Характеристики',h('p.note',['simCockpit','simCockpitTriple'].includes(item.type)?'Комплектация сохраняется в карточке. Внешний вид кокпита не меняется. ПК приобретается и размещается отдельно.':item.type==='macBook'?'Один размер корпуса: 31 × 25 см, высота с открытым экраном 22 см. Характеристики не меняют модель.':'Стеклянная боковая стенка и внутренняя подсветка. Характеристики сохраняются в карточке.'),
          ...Object.entries(EQUIPMENT_FIELDS[item.type]).map(([key,options])=>{
            const listId='equipment-'+item.id+'-'+Object.keys(EQUIPMENT_FIELDS[item.type]).indexOf(key);
            const control=text();control.setAttribute('list',listId);control.placeholder='Выберите или введите своё';
            return h('div',bind(key,control,{get:()=>item.equipmentFields?.[key]??linkedNode?.fields?.[key]??'',set:value=>{item.equipmentFields={...item.equipmentFields,[key]:value};}}),h('datalist',{id:listId},options.map(value=>h('option',{value}))));
          })));
      }
      if (inventory) {
        const available = availableInventoryFurniture(item);
        const linkSelect = choice(linkedNode ? [[linkedNode.id, linkedNode.name]] : [['', 'Новая карточка после сохранения'], ...available.map(n => [n.id, n.name])]);
        linkSelect.disabled = Boolean(linkedNode);
        nodes.push(section('Карточка учёта',
          bind('Связь с мебелью в каталоге', linkSelect, {
            get: () => linkedNode?.id || '', event: 'change', set: nodeId => {
              const node = available.find(n => n.id === nodeId);
              if (node) { item.inventoryNodeId = node.id; item.name = node.name; }
              else delete item.inventoryNodeId;
            },
          }),
          h('p.note', linkedNode ? 'У этой мебели уже есть карточка. Цена и содержимое сохраняются; название обновится после сохранения плана.' : 'Можно выбрать существующую мебель без размещения на плане. Новая модель и выбранная карточка будут связаны после сохранения.')),
        section('Действия',
          h('button.btn.wide', { onclick: () => remove('furniture', sel.index) }, 'Убрать с плана'),
          h('p.note', 'Карточка, цена и содержимое останутся в каталоге.'),
          h('button.btn.wide.danger', { onclick: () => trashFurniture(item) }, 'Удалить в корзину'),
          h('p.note', 'Мебель и содержимое можно будет восстановить из корзины.')));
      }
    } else if (kind === 'opening') {
      head({door:'Дверь',open:'Открытый проход',window:'Окно'}[item.type] || 'Дверь', 'Проём в стене');
      nodes.push(section('Проём',
        bind('Тип', choice([['door', 'Дверь'], ['open', 'Открытый проход'], ['window', 'Окно']]), { ...prop(item, 'type', 'door'), event: 'change' }),
        row(bind('Начало X', number(), { ...at(item, 'from', 0), parse: parseNum }), bind('Начало Z', number(), { ...at(item, 'from', 1), parse: parseNum })),
        row(bind('Конец X', number(), { ...at(item, 'to', 0), parse: parseNum }), bind('Конец Z', number(), { ...at(item, 'to', 1), parse: parseNum })),
        item.type === 'window' ? row(bind('Подоконник, м', number(), { ...prop(item, 'sill', 0.85), parse: parseNum }),
          bind('Верх окна, м', number(), { ...prop(item, 'head', 2.1), parse: parseNum })) : null,
        h('p.note', 'Обе точки должны лежать на одной стене: совпадать по X или Z. Окна видны на дальних стенах; ближние к камере стены скрыты.')));
    } else if (kind === 'scene') {
      head(item.name || item.id, `ID: ${item.id}`);
      item.lights ||= {};
      const rule = (id) => ({
        get: () => (item.lights[id]?.on === true ? 'on' : item.lights[id]?.on === false ? 'off' : ''),
        set: (v) => {
          if (v === '') delete item.lights[id];
          else item.lights[id] = { ...(item.lights[id] || {}), on: v === 'on' };
        },
      });
      const tri = () => choice([['', 'Без изменений'], ['on', 'Включено'], ['off', 'Выключено']]);
      nodes.push(section('Сцена',
        row(bind('Название', text(), prop(item, 'name', '')), bind('Значок', choice(SCENE_ICONS), { ...prop(item, 'icon', 'sun'), event: 'change' }))),
      section('Светильники',
        bind('Все светильники по умолчанию', tri(), { ...rule('*'), event: 'change' }),
        doc.lights.map((l) => bind(`${l.name} · ${roomName(l.room)}`, tri(), { ...rule(l.id), event: 'change' })),
        h('p.note', 'Яркость, температура и цвет каждого светильника сохраняются из файла плана.')),
      section('Кондиционеры',
        bind('Все кондиционеры', choice([['', 'Без изменений'], ['off', 'Выключить'], ['on', 'Включить']]), {
          get: () => (item.acs?.['*']?.on === true ? 'on' : item.acs?.['*']?.on === false ? 'off' : ''),
          set: (v) => { item.acs ||= {}; if (v === '') delete item.acs['*']; else item.acs['*'] = { on: v === 'on' }; },
          event: 'change',
        })));
    }
    const key = `${sel.kind}:${sel.index ?? sel.service ?? ''}`;
    const same = key === inspector.dataset.key;
    const top = same ? inspector.scrollTop : 0;
    // A refresh of the same screen (devices arriving) keeps the field being typed in.
    const fields = () => [...inspector.querySelectorAll('input, select, textarea')];
    const focused = same ? fields().indexOf(document.activeElement) : -1;
    const caret = focused >= 0 ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    inspector.dataset.key = key;
    inspector.replaceChildren(...nodes.flat(2).filter(Boolean));
    inspector.scrollTop = top;
    if (focused >= 0) {
      const el = fields()[focused];
      el?.focus();
      try { if (caret?.[0] != null) el.setSelectionRange(caret[0], caret[1]); } catch { /* not a text field */ }
    }
  }

  /* ---------- Smart Life ---------- */

  let loginTimer = 0;
  function stopLoginPolling() { clearInterval(loginTimer); loginTimer = 0; }

  async function fetchDevices() {
    tuya.busy = true; tuya.error = null;
    if (sel.kind === 'service') renderInspector();
    try {
      tuya.devices = (await call('tuya.devices')).devices;
    } catch (e) {
      tuya.error = e.message;
      tuya.devices = null;
    }
    tuya.busy = false;
    renderSidebar();
    if (sel.kind === 'service') renderInspector();
  }

  function deviceList() {
    if (tuya.busy) return h('p.note', 'Подключение к Smart Life…');
    if (tuya.error) return h('p.note.bad', tuya.error);
    if (!tuya.devices) return null;
    if (!tuya.devices.length) return h('p.note.bad', 'Подключено, но в аккаунте пока нет устройств.');
    const used = new Map([...doc.lights, ...doc.acs].filter((d) => d.tuya?.deviceId).map((d) => [d.tuya.deviceId, d.name]));
    return h('div.devices-list', h('h3', `Устройств в аккаунте: ${tuya.devices.length}`), tuya.devices.map((d) => h('div.device',
      h(`span.dot${d.online ? '.on' : ''}`),
      h('div', h('b', d.name), h('span', `${d.product || d.category || 'устройство'} · ${d.codes.join(', ') || 'функции не указаны'}`)),
      used.has(d.id) ? h('span.pill.on', used.get(d.id)) : null)));
  }

  function tuyaPanel() {
    const nodes = [];
    if (!isNative) nodes.push(h('p.note.bad', 'Подключение доступно в приложении; сейчас открыт браузерный просмотр.'));

    if (tuya.account.connected) {
      nodes.push(section('Аккаунт Smart Life',
        h('div.device', h('span.dot.on'), h('div', h('b', tuya.account.account || 'Вход выполнен'), h('span', `Код пользователя ${tuya.account.userCode}`))),
        h('div.fields',
          h('button.btn', { onclick: fetchDevices }, 'Обновить устройства'),
          h('button.btn', { onclick: async () => {
            stopLoginPolling();
            tuya.account = await call('smartlife.signOut');
            tuya.devices = null; tuya.qr = null;
            renderSidebar(); renderInspector();
            smartLifeChanged();
          } }, 'Выйти')),
        h('p.note', 'Выберите светильник или кондиционер на плане, укажите устройство Smart Life и сохраните план.')),
      deviceList());
      if (!tuya.devices && !tuya.busy && !tuya.error && isNative) setTimeout(fetchDevices, 0);
    } else {
      const codeInput = text();
      codeInput.value = tuya.account.userCode || '';
      codeInput.placeholder = 'например aB12cD3';
      const message = h('p.note');
      const qrBox = h('div.qr');
      const start = async () => {
        stopLoginPolling();
        message.className = 'note';
        message.textContent = 'Запрашиваем код входа…';
        qrBox.replaceChildren();
        try {
          const userCode = codeInput.value.trim();
          const { token, qr } = await call('smartlife.begin', { userCode });
          qrBox.replaceChildren(h('img', { src: qr, alt: 'QR-код входа в Smart Life', width: 220, height: 220 }));
          message.textContent = 'Отсканируйте код в Smart Life на вкладке «Дом» и подтвердите вход. Ожидание…';
          let tries = 0;
          loginTimer = setInterval(async () => {
            if (++tries > 90) { stopLoginPolling(); message.className = 'note bad'; message.textContent = 'Срок действия кода истёк. Нажмите «Показать QR-код» ещё раз.'; return; }
            const r = await call('smartlife.poll', { token, userCode }).catch(() => null);
            if (!r?.connected) return;
            stopLoginPolling();
            tuya.account = r.info;
            renderSidebar();
            renderInspector();
            smartLifeChanged();
          }, 2000);
        } catch (e) {
          message.className = 'note bad';
          message.textContent = e.message;
        }
      };
      nodes.push(section('Вход через приложение Smart Life',
        h('ol.steps',
          h('li', 'В Smart Life откройте «Профиль» → «Настройки» → «Учётная запись и безопасность» и скопируйте код пользователя внизу.'),
          h('li', 'Введите его здесь и нажмите «Показать QR-код».'),
          h('li', 'Отсканируйте код в Smart Life и подтвердите вход.')),
        h('label.field', h('span', 'Код пользователя'), codeInput),
        h('button.btn.primary.wide', { onclick: start, disabled: !isNative }, 'Показать QR-код'),
        qrBox, message,
        h('p.note', 'Бесплатно, аккаунт разработчика Tuya не нужен. Данные входа хранятся только на этом Mac.')));
    }

    // The developer-project route stays available for those who already have one.
    const idInput = text();
    idInput.value = tuya.info.accessId || '';
    idInput.placeholder = 'Идентификатор клиента (Access ID)';
    const secretInput = h('input', { type: 'password', autocomplete: 'off' });
    secretInput.placeholder = tuya.info.hasSecret ? '•••••••• (сохранено; оставьте пустым, чтобы сохранить)' : 'Секрет клиента (Access Secret)';
    const region = choice(REGIONS.map(([id, label]) => [id, `${label} (${id})`]));
    region.value = tuya.info.region || 'eu';
    const saveCloud = async () => {
      try {
        tuya.info = await call('tuya.save', { accessId: idInput.value, accessSecret: secretInput.value, region: region.value });
        renderSidebar();
        smartLifeChanged();
        if (tuya.info.configured) await fetchDevices(); else renderInspector();
      } catch (e) { toast(e.message, true); }
    };
    nodes.push(h('details.advanced', h('summary', 'Дополнительно: проект Tuya Cloud'),
      h('p.note', 'Для существующего проекта на platform.tuya.com со связанным аккаунтом. Приоритет у входа по QR-коду.'),
      h('label.field', h('span', 'Идентификатор доступа'), idInput),
      h('label.field', h('span', 'Секрет доступа'), secretInput),
      h('label.field', h('span', 'Центр обработки данных'), region),
      h('button.btn.wide', { onclick: saveCloud, disabled: !isNative }, 'Сохранить и загрузить устройства'),
      tuya.account.connected ? null : deviceList()));
    return nodes;
  }

  /* ---------- file actions ---------- */

  async function clearAll(){if(saving||deletingFurniture)return;try{const next=await options.onClear?.(structuredClone(doc));if(!next)return;doc=structuredClone(next);undo.length=0;redo.length=0;lastSnapshotKey=null;savedDocument=JSON.stringify(doc);nameInput.value=doc.name||'';sel={kind:'home'};dirty=false;renderSidebar();renderPlan();renderInspector();validate();schedulePreview(0);toast('Карта очищена. Вещи сохранены в «Без места».');}catch(e){toast(e.message,true);}}

  async function searchInventory(){
    if(!inventory||saving||deletingFurniture)return;
    if(dirty){await save();if(dirty){toast('Сначала исправьте и сохраните изменения плана.',true);return;}}
    options.onClose?.();window.parent.__inventoryFocusSearch?.();
  }
  async function save() {
    if (!valid || saving || deletingFurniture) return;
    if (inventory) {
      saving = true;root.inert = true;validate();
      try {
        const selectedId = doc[KEYS[sel.kind]]?.[sel.index]?.id;
        await options.onSave(structuredClone(doc));
        // Sync can remove geometry outside rooms or add stable card links.
        // Continue editing the canonical saved plan rather than a stale draft.
        if (window.parent.__inventoryPlan) doc = structuredClone(window.parent.__inventoryPlan);
        for (const key of Object.values(KEYS)) doc[key] ||= [];
        rememberCardLinks();
        if (selectedId) { const index = doc[KEYS[sel.kind]]?.findIndex(item => item.id === selectedId); sel = index >= 0 ? { kind: sel.kind, index } : { kind: 'home' }; }
        if (sel.index != null && !doc[KEYS[sel.kind]]?.[sel.index]) sel = { kind: 'home' };
        savedDocument = JSON.stringify(doc);lastSnapshotKey = null;
        dirty = false; renderSidebar(); renderPlan(); renderInspector(); validate(); schedulePreview(0); toast('План сохранён');
      }
      catch (e) { toast(e.message, true); }
      finally { saving = false;root.inert = false;validate(); }
      return;
    }
    if (!isNative) {
      download();
      toast('План сохранён в файл для браузерного просмотра');
      return;
    }
    try {
      await call('savePlan', { config: doc });
      savedDocument = JSON.stringify(doc);lastSnapshotKey = null;
      dirty = false;
      validate();
      haptic('success');
      toast(isPhone ? 'Сохранено' : 'План сохранён');
    } catch (e) {
      toast(e.message, true);
    }
  }

  function download() {
    const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })), download: `${slug(doc.name)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function exportPlan() {
    if (!isNative) { download(); return; }
    try {
      const r = await call('exportPlan', { config: doc });
      if (r.ok) toast('План экспортирован');
    } catch (e) { toast(e.message, true); }
  }

  async function importPlan() {
    if (dirty && !confirm('Импорт заменит текущий план. Несохранённые изменения будут потеряны. Продолжить?')) return;
    const load = (json) => {
      try {
        normalize(structuredClone(json));
      } catch (e) {
        toast(`Не удалось открыть план: ${e.message}`, true);
        return;
      }
      snapshot();
      doc = json;
      for (const key of Object.values(KEYS)) doc[key] ||= [];
      nameInput.value = doc.name || 'Моя квартира';
      sel = { kind: 'home' };
      touch();
      toast('План импортирован. Проверьте его и нажмите «Сохранить план».');
    };
    if (isNative) {
      try {
        const r = await call('importPlan');
        if (r.config) load(r.config);
      } catch (e) { toast(e.message, true); }
      return;
    }
    const input = h('input', { type: 'file', accept: 'application/json,.json' });
    input.addEventListener('change', async () => {
      try { if (input.files[0]) load(JSON.parse(await input.files[0].text())); } catch (e) { toast(`Не удалось прочитать файл: ${e.message}`, true); }
    });
    input.click();
  }

  /* ---------- keyboard ---------- */

  function routeHistory(repeat = false) {
    if (saving || deletingFurniture) return;
    if (editingText(document.activeElement)) { document.execCommand(repeat ? 'redo' : 'undo'); return; }
    stepHistory(repeat ? redo : undo, repeat ? undo : redo);
  }
  incoming.inventoryUndo = () => routeHistory();
  incoming.inventoryRedo = () => routeHistory(true);

  window.addEventListener('keydown', (ev) => {
    if (saving || deletingFurniture || document.querySelector('dialog[open]')) return;
    const typing = editingText(document.activeElement), command = historyShortcut(ev);
    if(ev.key==='Escape'&&!typing&&compactPanels()&&narrowPanel){ev.preventDefault();setLayout(narrowPanel,true);return;}
    if (command && !typing) {
      ev.preventDefault();
      routeHistory(command === 'redo');
    } else if (inventory&&(ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();searchInventory();
    } else if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      save();
    } else if ((ev.key === 'Backspace' || ev.key === 'Delete') && !typing && sel.index != null) {
      ev.preventDefault();
      remove(sel.kind, sel.index);
    } else if (ev.key.startsWith('Arrow') && !typing && sel.index != null) {
      const item = doc[KEYS[sel.kind]][sel.index];
      const target = item.pos || item.rect;
      if (!target) return;
      ev.preventDefault();
      const stepSize = ev.shiftKey ? 0.5 : 0.05;
      snapshot(`nudge${sel.kind}${sel.index}`);
      if (ev.key === 'ArrowLeft') target[0] = fix(target[0] - stepSize);
      if (ev.key === 'ArrowRight') target[0] = fix(target[0] + stepSize);
      if (ev.key === 'ArrowUp') target[1] = fix(target[1] - stepSize);
      if (ev.key === 'ArrowDown') target[1] = fix(target[1] + stepSize);
      touch();
    }
  });

  /* ---------- iPhone ---------- */

  // The plan fills the screen; a bar on top (close, name, undo, save), tools at the bottom
  // (add, items, 3D, home) and the inspector as a sheet that rises when something is picked.
  function buildPhoneLayout() {
    const canvas = h('main.canvas');
    const sheet = h('section.p-sheet', { 'aria-label': 'Свойства' });
    const grip = h('div.p-grip', { role: 'button', 'aria-label': 'Изменить размер свойств' }, h('span'));
    const scrim = h('div.p-scrim');
    const listSheet = h('section.p-modal', { 'aria-label': 'Объекты' });
    const addSheet = h('section.p-modal.p-add', { 'aria-label': 'Добавить' });
    const confirmSheet = h('section.p-modal.p-confirm', { 'aria-label': 'Несохранённые изменения' });
    const undoBtn = h('button.p-icon', { 'aria-label': 'Отменить', onclick: () => { stepHistory(undo, redo); haptic('light'); } }, icon('undo', 19, 2.1));
    const redoBtn = h('button.p-icon', { 'aria-label': 'Повторить', onclick: () => { stepHistory(redo, undo); haptic('light'); } }, icon('redo', 19, 2.1));
    const doneBtn = h('button.p-save', { onclick: () => (dirty ? save() : close()) });
    const issue = h('div.p-issue');
    const fitBtn = h('button.p-float', { 'aria-label': 'Показать всю планировку', onclick: () => { ui.view = null; ui.applyView(); haptic('light'); } }, icon('fit', 18, 2));
    const tool = (name, label, onclick) => h('button.p-tool', { onclick }, icon(name, 22, 1.9), h('span', label));
    const view3d = tool('box', '3D', () => setShow3D(!ui.show3D));
    const tools = h('nav.p-tools',
      tool('plus', 'Добавить', () => openModal(addSheet)),
      tool('list', 'Объекты', () => openModal(listSheet)),
      view3d,
      tool('home', 'Квартира', () => { select({ kind: 'home' }); setSheet('full'); }));

    nameInput.setAttribute('enterkeyhint', 'done');
    nameInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') nameInput.blur(); });
    sidebar.classList.add('p-list');
    listSheet.append(h('div.p-modal-head', h('b', 'Объекты'), h('button.p-text', { onclick: closeModals }, 'Готово')), sidebar);
    const addables = [
      ['room', 'home', 'Комната'], ['light', 'bulb', 'Светильник'], ['ac', 'ac', 'Кондиционер'],
      ['opening', 'opening', 'Дверь или окно'], ['furniture', 'furniture', 'Мебель'], ['scene', 'sparkles', 'Сцена'],
    ];
    addSheet.append(h('div.p-modal-head', h('b', 'Добавить на план'), h('button.p-text', { onclick: closeModals }, 'Отмена')),
      h('div.p-add-grid', addables.map(([kind, name, label]) => h('button.p-add-item', {
        onclick: () => { closeModals(); add(kind); haptic('light'); ui.reveal(); },
      }, icon(name, 24, 1.8), h('span', label)))));
    confirmSheet.append(h('div.p-modal-head', h('b', 'Несохранённые изменения')),
      h('p.note', 'Сохранить изменения перед закрытием?'),
      h('div.p-confirm-actions',
        h('button.btn.primary.wide', { onclick: async () => { closeModals(); await save(); if (!dirty) close(); } }, 'Сохранить и закрыть'),
        h('button.btn.wide.danger', { onclick: () => { closeModals(); dirty = false; close(); } }, 'Отменить изменения'),
        h('button.btn.wide', { onclick: closeModals }, 'Продолжить редактирование')));

    sheet.append(grip, inspector);
    canvas.append(plan, h('div.p-preview', previewHost, previewToggle), issue, fitBtn, hint);
    const shell = h('div.editor.phone',
      h('header.p-bar', h('button.p-icon', { 'aria-label': 'Закрыть', onclick: requestClose }, icon('close', 20, 2.2)),
        nameInput, undoBtn, redoBtn, doneBtn),
      canvas, tools, scrim, sheet, listSheet, addSheet, confirmSheet, toastEl);
    root.replaceChildren(shell);

    /* sheet: closed, peek (the bottom part of the screen) or full */
    function setSheet(next) {
      ui.sheet = next;
      sheet.dataset.state = next;
      shell.dataset.sheet = next;
      sheet.style.height = '';
      document.activeElement?.blur?.();
    }
    let gripDrag = null;
    const startGrip = (ev) => {
      if (ev.target.closest('button, input, select, textarea, a')) return;
      gripDrag = { y: ev.clientY, h: sheet.getBoundingClientRect().height, id: ev.pointerId, moved: false };
    };
    grip.addEventListener('pointerdown', startGrip);
    inspector.addEventListener('pointerdown', (ev) => { if (ev.target.closest('.insp-head')) startGrip(ev); });
    window.addEventListener('pointermove', (ev) => {
      if (!gripDrag || ev.pointerId !== gripDrag.id) return;
      const dy = ev.clientY - gripDrag.y;
      if (!gripDrag.moved && Math.abs(dy) < 6) return;
      gripDrag.moved = true;
      sheet.classList.add('dragging');
      sheet.style.height = `${Math.max(80, gripDrag.h - dy)}px`;
    });
    const endGrip = (ev) => {
      if (!gripDrag || ev.pointerId !== gripDrag.id) return;
      const { moved, h: from } = gripDrag;
      gripDrag = null;
      sheet.classList.remove('dragging');
      if (!moved) { if (ev.target.closest('.p-grip')) setSheet(ui.sheet === 'full' ? 'peek' : 'full'); return; }
      const now = sheet.getBoundingClientRect().height;
      const screen = window.innerHeight;
      if (now < Math.min(from, screen * 0.42) * 0.7) closeSheet();
      else setSheet(now > screen * 0.62 ? 'full' : 'peek');
    };
    window.addEventListener('pointerup', endGrip);
    window.addEventListener('pointercancel', endGrip);

    function closeSheet() {
      setSheet('closed');
      if (sel.kind !== 'home') { sel = { kind: 'home' }; renderSidebar(); renderPlan(); renderInspector(); }
    }

    function openModal(el) {
      closeModals();
      if (el === listSheet) renderSidebar();
      el.classList.add('open');
      scrim.classList.add('open');
      haptic('light');
    }
    function closeModals() {
      for (const el of [listSheet, addSheet, confirmSheet]) el.classList.remove('open');
      scrim.classList.remove('open');
    }
    scrim.addEventListener('click', closeModals);

    function requestClose() {
      if (dirty) openModal(confirmSheet); else close();
    }
    function close() { post('close'); }

    function setShow3D(on) {
      ui.show3D = on;
      canvas.classList.toggle('show-3d', on);
      view3d.replaceChildren(icon(on ? 'map' : 'box', 22, 1.9), h('span', on ? 'План' : '3D'));
      schedulePreview(0);
      haptic('light');
    }

    /* the plan's view: a box in plan metres with the element's aspect, or null to fit */
    function fitBox() {
      const b = bounds();
      const rect = plan.getBoundingClientRect();
      const W = rect.width || 390;
      const H = rect.height || 600;
      // Clear of the fit button on top, a little air on the other sides.
      const pad = { top: 64, side: 18, bottom: 18 };
      const scale = Math.min((W - pad.side * 2) / (b.maxX - b.minX), (H - pad.top - pad.bottom) / (b.maxZ - b.minZ));
      const w = W / scale;
      const hh = H / scale;
      const midY = pad.top + (H - pad.top - pad.bottom) / 2;
      return { x: (b.minX + b.maxX) / 2 - w / 2, y: (b.minZ + b.maxZ) / 2 - midY / scale, w, h: hh };
    }
    const observer=new ResizeObserver(() => ui.applyView());observer.observe(plan);layoutObservers.push(observer);

    // One finger on what is selected drags it; anywhere else it pans, and a tap picks.
    // Two fingers pinch to zoom.
    const fingers = new Map();
    let gesture = null;
    const box = () => ui.view || fitBox();
    const spread = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const middle = () => { const [a, b] = [...fingers.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };

    plan.addEventListener('pointerdown', (ev) => {
      plan.setPointerCapture(ev.pointerId);
      fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (fingers.size === 2) {
        if (drag) endDrag();
        const rect = plan.getBoundingClientRect();
        const v = box();
        const mid = middle();
        gesture = { type: 'pinch', d0: spread(), v0: v, at: { x: v.x + (mid.x - rect.left) * v.w / rect.width, y: v.y + (mid.y - rect.top) * v.h / rect.height } };
        return;
      }
      if (fingers.size > 2) return;
      const el = ev.target.closest('[data-kind]');
      const kind = el?.dataset.kind;
      const index = Number(el?.dataset.index);
      // A selected room is grabbed anywhere inside it, even over its furniture and lamps.
      const room = sel.kind === 'room' && doc.rooms[sel.index];
      const [px, pz] = planPoint(ev);
      const inRoom = room && roomContains(room,[px,pz]);
      if (kind === 'resize' || (kind && kind !== 'none' && isSel(kind, index)) || (inRoom && kind !== 'light' && kind !== 'ac')) {
        const what = kind === 'resize' || isSel(kind, index) ? [kind, index] : ['room', sel.index];
        // The view holds still while something is dragged past the plan's edge.
        if (!ui.view) ui.view = fitBox();
        startDrag(what[0], what[1], ev);
        gesture = { type: 'drag' };
        return;
      }
      gesture = { type: 'pan', x: ev.clientX, y: ev.clientY, v0: box(), moved: false, kind, index };
    });

    plan.addEventListener('pointermove', (ev) => {
      if (!fingers.has(ev.pointerId)) return;
      fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (!gesture) return;
      if (gesture.type === 'drag') { moveDrag(ev); return; }
      const rect = plan.getBoundingClientRect();
      if (gesture.type === 'pinch' && fingers.size === 2) {
        const fit = fitBox();
        const w = clamp(gesture.v0.w * gesture.d0 / Math.max(1, spread()), 1.6, Math.max(fit.w * 2.5, 24));
        const hh = w * rect.height / rect.width;
        const mid = middle();
        ui.view = { x: gesture.at.x - (mid.x - rect.left) * w / rect.width, y: gesture.at.y - (mid.y - rect.top) * hh / rect.height, w, h: hh };
        ui.applyView();
      } else if (gesture.type === 'pan') {
        const dx = ev.clientX - gesture.x;
        const dy = ev.clientY - gesture.y;
        if (!gesture.moved && Math.hypot(dx, dy) < 8) return;
        gesture.moved = true;
        const v = gesture.v0;
        ui.view = { ...v, x: v.x - dx * v.w / rect.width, y: v.y - dy * v.h / rect.height };
        ui.applyView();
      }
    });

    const lift = (ev) => {
      if (!fingers.delete(ev.pointerId)) return;
      if (!gesture) return;
      if (gesture.type === 'drag') {
        // A tap on what is already selected (just added, say) brings up its details.
        const tapped = ev.type === 'pointerup' && drag && !drag.moved && drag.kind !== 'resize';
        endDrag();
        gesture = null;
        if (tapped && ui.sheet === 'closed') { haptic('light'); setSheet('peek'); }
        return;
      }
      if (gesture.type === 'pinch') {
        // One finger stays down: it carries on panning from here.
        const [rest] = [...fingers.values()];
        gesture = rest ? { type: 'pan', x: rest.x, y: rest.y, v0: box(), moved: true } : null;
        return;
      }
      if (gesture.type === 'pan' && !gesture.moved && ev.type === 'pointerup') {
        const { kind, index } = gesture;
        if (kind && kind !== 'none' && kind !== 'resize') { haptic('light'); select({ kind, index }); }
        else if (ui.sheet !== 'closed') closeSheet();
      }
      gesture = null;
    };
    plan.addEventListener('pointerup', lift);
    plan.addEventListener('pointercancel', lift);

    const ui = {
      view: null,
      sheet: 'closed',
      show3D: false,
      applyView() {
        if (ui.view) {
          // The plan's box changed shape (the sheet came up): keep the middle and the zoom.
          const rect = plan.getBoundingClientRect();
          const hh = rect.width ? ui.view.w * rect.height / rect.width : ui.view.h;
          ui.view = { ...ui.view, y: ui.view.y + (ui.view.h - hh) / 2, h: hh };
        }
        const v = ui.view || fitBox();
        plan.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
      },
      // Something was picked (on the plan, in the list, in 3D): its details come up.
      selected(next) {
        closeModals();
        if (next.kind === 'connections' || next.kind === 'service') setSheet('full');
        else if (next.kind !== 'home' && ui.sheet === 'closed') setSheet('peek');
      },
      // The item just added may lie outside what is shown: show everything again.
      reveal() { ui.view = null; ui.applyView(); },
      headActions() {
        const nodes = [];
        if (sel.index != null) {
          nodes.push(h('button.p-icon.danger', {
            'aria-label': 'Убрать с плана', onclick: () => { haptic('medium'); remove(sel.kind, sel.index); setSheet('closed'); },
          }, icon('trash', 18, 2)));
        }
        nodes.push(h('button.p-icon', { 'aria-label': 'Закрыть свойства', onclick: closeSheet }, icon('down', 20, 2.2)));
        return h('div.p-head-actions', nodes);
      },
      refresh() {
        doneBtn.textContent = dirty ? 'Сохранить' : 'Готово';
        doneBtn.classList.toggle('primary', dirty);
        doneBtn.disabled = dirty && !valid;
        undoBtn.disabled = saving || deletingFurniture || !undo.length;
        redoBtn.disabled = saving || deletingFurniture || !redo.length;
        issue.textContent = valid ? '' : status.textContent;
        issue.classList.toggle('show', !valid);
      },
    };
    setSheet(sel.kind === 'connections' || sel.kind === 'service' ? 'full' : 'closed');
    phone = ui;
  }

  renderSidebar();
  renderPlan();
  renderInspector();
  validate();
  dirty = false;
  validate();
  schedulePreview(0);
  if (inventory && inventoryData().placeNodeId) {
    const nodeId = inventoryData().placeNodeId;
    const index = doc.furniture.findIndex(f => inventoryNode(f)?.id === nodeId);
    if (index >= 0) select({ kind: 'furniture', index });
    else setTimeout(() => showCatalog('furniture', nodeId), 0);
  }
  const disposeEditor=()=>{disposePreview();for(const observer of layoutObservers)observer.disconnect();layoutObservers.length=0;stopLoginPolling();clearTimeout(toast.timer);};
  incoming.disposeEditor=disposeEditor;
  window.addEventListener('pagehide',disposeEditor);
  document.addEventListener('visibilitychange',()=>world?.setRunning(!document.hidden));
  incoming.openSection = (at) => select(sectionSel(at));
  // A plan saved on the other device (the Mac, or the paired iPhone) while this editor is open.
  incoming.planArrived = (config, from) => {
    if (dirty) {
      toast(`${from || 'Your other device'} saved a newer plan. Saving here replaces it.`, true);
      return;
    }
    doc = structuredClone(config);
    for (const key of Object.values(KEYS)) doc[key] ||= [];
    rememberCardLinks();savedDocument=JSON.stringify(doc);undo.length=0;redo.length=0;lastSnapshotKey=null;
    nameInput.value = doc.name || 'Квартира';
    if (sel.index != null && !doc[KEYS[sel.kind]]?.[sel.index]) sel = { kind: 'home' };
    touch();
    dirty = false;
    validate();
    toast(`Updated from ${from || 'your other device'}`);
  };

  window.__editor = { get doc() { return doc; }, select, tuya, links, phone };
  post('ready');
}
