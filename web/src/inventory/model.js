import { rememberCategoryIcons } from './appearance.js';
// Inventory is independent of Three.js and the native bridge. Money is integer kopecks.
export const FORMAT = 'my-home-inventory';
// A logical destination, never a room in the drawing or a 3D object.
export const UNPLACED_ID = 'room:unplaced';
export const KINDS = { room: 'Комната', furniture: 'Мебель / техника', shelf: 'Полка', drawer: 'Ящик', box: 'Контейнер', item: 'Вещь' };
export const CONDITIONS = ['Отличное', 'Хорошее', 'Требует внимания', 'На выброс'];
export const FURNITURE_NAMES = { sofa: 'Диван', armchair: 'Кресло', coffeeTable: 'Журнальный стол', tv: 'Телевизор', sideboard: 'Тумба', diningSet: 'Обеденный стол', island: 'Кухонный остров', kitchen: 'Кухонный гарнитур', fridge: 'Холодильник', bed: 'Кровать', nightstand: 'Прикроватная тумба', dresser: 'Комод', plant: 'Растение', vanity: 'Тумба с раковиной', bathtub: 'Ванна', toilet: 'Унитаз', desk: 'Рабочий стол', wardrobe: 'Шкаф', bookshelf: 'Стеллаж', rug: 'Ковёр' };
export const CATEGORY_FIELDS = {
  clothes: ['Бренд', 'Цвет', 'Размер'], electronics: ['Бренд', 'Модель', 'Мощность, Вт'],
  furniture: ['Бренд', 'Модель', 'Ширина, см', 'Высота, см', 'Глубина, см'],
  food: ['Производитель', 'Вес, г'], tools: ['Бренд', 'Модель', 'Размер'],
  books: ['Автор', 'Издательство'], dishes: ['Бренд', 'Объём, мл'],
  sport: ['Бренд', 'Модель', 'Размер'], medicine: ['Производитель', 'Дозировка'],
  default: ['Бренд', 'Модель', 'Цвет', 'Вес, г'],
};
export const id = () => crypto.randomUUID();
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
function validDate(value) {
  if (value == null || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value+'T12:00:00Z');
  return !Number.isNaN(+date) && date.toISOString().slice(0,10) === value;
}
export const money = n => n == null ? '—' : new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(n / 100);
export function parseMoney(s) {
  if (s == null || String(s).trim() === '') return null;
  const value = String(s).replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw Error('Цена: положительное число, не больше двух знаков после запятой');
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw Error('Слишком большая цена');
  return cents;
}
export const getNode = (d, nodeId) => d.nodes.find(n => n.id === nodeId);
// Rooms have equal weight. Missing percentages remain unknown, never assumed empty.
export function apartmentFill(d) {
  const rooms=d.nodes.filter(n=>n.kind==='room'&&!n.virtual&&!n.archived);
  const known=rooms.filter(n=>n.fill!=null);
  return {value:known.length?Math.round(known.reduce((sum,n)=>sum+n.fill,0)/known.length*10)/10:null,known:known.length,total:rooms.length};
}
export const children = (d, parentId, archived = false) => d.nodes.filter(n => n.parentId === parentId && Boolean(n.archived) === archived).sort((a,b) => a.order-b.order || a.name.localeCompare(b.name,'ru'));
export function descendants(d, nodeId) {
  const result = []; const seen = new Set([nodeId]); const queue = [nodeId];
  while (queue.length) { const p = queue.shift(); for (const n of d.nodes.filter(n => n.parentId === p)) { if (seen.has(n.id)) throw Error('Обнаружен цикл мест хранения'); seen.add(n.id); result.push(n); queue.push(n.id); } }
  return result;
}
export function address(d, n) {
  const parts = []; const seen = new Set();
  for (let p = n; p; p = getNode(d, p.parentId)) { if (seen.has(p.id)) throw Error('Цикл адресов'); seen.add(p.id); parts.unshift(p.name); }
  return parts.join(' → ');
}
export function categoryName(d, categoryId) {
  const parts = []; const seen = new Set();
  for (let c = d.categories.find(c => c.id === categoryId); c; c = d.categories.find(x => x.id === c.parentId)) { if (seen.has(c.id)) break; seen.add(c.id); parts.unshift(c.name); }
  return parts.join(' / ');
}
export function categoryKind(d, categoryId) {
  let c = d.categories.find(c => c.id === categoryId); const seen = new Set();
  while (c?.parentId && !seen.has(c.id)) { seen.add(c.id); c = d.categories.find(x => x.id === c.parentId); }
  return c?.kind || 'default';
}
export function search(d, query, archived = false) {
  const words = query.toLocaleLowerCase('ru').trim().split(/\s+/);
  return d.nodes.filter(n => n.kind !== 'room' && Boolean(n.archived) === archived).filter(n => {
    const haystack = [address(d,n), categoryName(d,n.categoryId), n.notes, ...Object.values(n.fields || {})].join(' ').toLocaleLowerCase('ru');
    return words.every(w => haystack.includes(w));
  });
}
export function totals(d, nodeId = null) {
  const nodes = (nodeId ? [getNode(d,nodeId), ...descendants(d,nodeId)] : d.nodes).filter(n => n && n.kind !== 'room' && !n.archived);
  // Furniture is both a physical thing and a place of storage. These counts
  // deliberately overlap; count retains the old number of inventory records.
  return { count: nodes.length, items: nodes.filter(n => ['item','furniture'].includes(n.kind)).length,
    storage: nodes.filter(n => ['furniture','shelf','drawer','box'].includes(n.kind)).length,
    purchase: nodes.reduce((s,n) => s + (n.purchaseCents ?? 0), 0), current: nodes.reduce((s,n) => s + (n.currentCents ?? 0), 0) };
}
export function destinations(d, movingId) {
  const exclude = movingId ? new Set([movingId, ...descendants(d,movingId).map(n => n.id)]) : new Set();
  return d.nodes.filter(n => n.kind !== 'item' && !n.archived && !exclude.has(n.id)).sort((a,b) => address(d,a).localeCompare(address(d,b),'ru'));
}
export function record(d, type, node, extra = {}) {
  d.events.push({ id: id(), type, date: new Date().toISOString(), nodeId: node.id, name: node.name, ...extra });
}
function placeGeometry(d, nodes, parentId) {
  let room = getNode(d,parentId);
  while (room && room.kind !== 'room') room = getNode(d,room.parentId);
  const rect = d.plan.rooms.find(r => r.id === room?.roomId)?.rect;
  if (!rect) {
    // A thing without a physical room must not linger on the old drawing.
    for (const n of nodes) if (n.furnitureId) detachFurniture(d,n.id);
    return;
  }
  if (rect) for (const x of nodes) {
    const f = d.plan.furniture.find(f => f.id === x.furnitureId);
    if (f && !(f.pos[0] >= rect[0] && f.pos[0] <= rect[0]+rect[2] && f.pos[1] >= rect[1] && f.pos[1] <= rect[1]+rect[3])) f.pos = [rect[0]+rect[2]/2,rect[1]+rect[3]/2];
  }
}
export function move(d, nodeId, parentId) {
  const n = getNode(d,nodeId); const p = getNode(d,parentId);
  if (!n || n.kind === 'room' || n.archived || !p || p.archived || p.kind === 'item') throw Error('Недопустимое место хранения');
  if (!destinations(d,nodeId).some(x => x.id === parentId)) throw Error('Нельзя поместить контейнер внутрь самого себя');
  if (n.parentId === parentId) return;
  const affected = [n,...descendants(d,nodeId)].filter(x => !x.archived);
  const before = new Map(affected.map(x => [x.id, address(d,x)]));
  n.parentId = parentId; n.order = children(d,parentId).length;
  placeGeometry(d,affected,parentId);
  for (const x of affected) record(d,'move',x,{ from: before.get(x.id), to: address(d,x) });
}
export function archive(d, nodeId, {reason, date, saleCents = null, together = true, destination = null}) {
  const n = getNode(d,nodeId);
  if (!n || n.kind === 'room' || n.archived) throw Error('Нельзя архивировать этот объект');
  if (!reason || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error('Укажите причину и дату');
  if (!together) {
    if (!destinations(d,nodeId).some(x => x.id === destination)) throw Error('Выберите новое место содержимого');
    for (const child of d.nodes.filter(x => x.parentId === nodeId)) {
      // Independently archived possessions retain their archive group/reason,
      // but still belong to the complete physical contents, at any depth.
      const affected = [child,...descendants(d,child.id)];
      const before = new Map(affected.map(x => [x.id,address(d,x)]));
      child.parentId = destination;
      child.order = children(d,destination,Boolean(child.archived)).length;
      placeGeometry(d,affected,destination);
      for (const x of affected) record(d,'move',x,{from:before.get(x.id),to:address(d,x)});
    }
  }
  const group = id(); const all = together ? [n,...descendants(d,nodeId)].filter(x => !x.archived) : [n];
  for (const x of all) {
    x.archived = { group, reason, date, saleCents: x === n && reason === 'Продано' ? saleCents : null, rootId: nodeId };
    record(d,'archive',x,{ reason, effectiveDate: date, saleCents: x.archived.saleCents, purchaseCents: x.purchaseCents });
  }
}
export function restore(d,nodeId,parentId) {
  const n = getNode(d,nodeId); if (!n?.archived) throw Error('Вещь не в архиве');
  const p = getNode(d,parentId); if (!p || p.archived || p.kind === 'item' || p.id === n.id || descendants(d,n.id).some(x => x.id === p.id)) throw Error('Выберите действующее место');
  const group = n.archived.group;
  n.parentId = parentId;
  const restored = [n,...descendants(d,nodeId)].filter(x => x.archived?.group === group);
  for (const x of restored) { x.archived = null; record(d,'restore',x); }
  placeGeometry(d,restored,parentId);
}
// Trash keeps complete snapshots so removal is reversible across restarts and backups.
export function remove(d,nodeId,{together=true,destination=null}={}) {
  const n=getNode(d,nodeId);
  if (!n || n.kind==='room') throw Error('Можно удалить вещь, мебель или отсек');
  const nested=descendants(d,nodeId);
  if (!together && nested.length) {
    if (!destinations(d,nodeId).some(p=>p.id===destination)) throw Error('Выберите новое место содержимого');
    for (const child of d.nodes.filter(x=>x.parentId===nodeId)) {
      if (!child.archived) move(d,child.id,destination);
      else {
        const affected=[child,...descendants(d,child.id)];
        const before=new Map(affected.map(x=>[x.id,address(d,x)]));
        child.parentId=destination;placeGeometry(d,affected,destination);
        for (const x of affected) record(d,'move',x,{from:before.get(x.id),to:address(d,x)});
      }
    }
  }
  const removed=[n,...descendants(d,nodeId)];
  const nodeIds=new Set(removed.map(x=>x.id));
  const furnitureIds=new Set(removed.map(x=>x.furnitureId).filter(Boolean));
  const entry={id:id(),rootId:nodeId,removedAt:new Date().toISOString(),
    nodes:structuredClone(removed),furniture:structuredClone(d.plan.furniture.filter(f=>furnitureIds.has(f.id)))};
  d.trash ||= [];d.trash.push(entry);
  d.nodes=d.nodes.filter(x=>!nodeIds.has(x.id));
  d.plan.furniture=d.plan.furniture.filter(f=>!furnitureIds.has(f.id));
  record(d,'delete',n,{count:removed.length});
  return entry;
}
export function recover(d,entryId,parentId) {
  const entry=d.trash?.find(x=>x.id===entryId);
  const parent=getNode(d,parentId);
  if (!entry) throw Error('Объект не найден в корзине');
  if (!parent || parent.archived || parent.kind==='item') throw Error('Выберите действующее место хранения');
  if (entry.nodes.some(n=>getNode(d,n.id)) || entry.furniture.some(f=>d.plan.furniture.some(x=>x.id===f.id))) throw Error('Объекты с такими идентификаторами уже существуют');
  const restored=structuredClone(entry.nodes);
  const root=restored.find(n=>n.id===entry.rootId);
  if (!root) throw Error('Некорректная запись корзины');
  root.parentId=parentId;root.order=children(d,parentId).length;
  d.nodes.push(...restored);d.plan.furniture.push(...structuredClone(entry.furniture));
  placeGeometry(d,restored,parentId);
  d.trash=d.trash.filter(x=>x.id!==entryId);
  record(d,'recover',root,{count:restored.length});
  return root;
}
export function reorder(d,nodeId,beforeId) {
  const n = getNode(d,nodeId); const b = getNode(d,beforeId);
  if (!n || !b || n.parentId !== b.parentId || n.kind === 'item' || b.kind === 'item') throw Error('Порядок меняется внутри одного места');
  const list = children(d,n.parentId).filter(x => x.id !== n.id); list.splice(list.findIndex(x => x.id === b.id),0,n);
  list.forEach((x,i) => x.order = i);
}
export function newNode(d, props) {
  const n = { id: id(), name: '', kind: 'item', parentId: null, categoryId: '', fields: {}, purchaseCents: null, currentCents: null, wear: null, fill: null, condition: 'Хорошее', photo: null, notes: '', acquisition:'existing', purchasedAt: '', expiry: '', warranty: '', quantity: 1, unit: 'шт.', order: d.nodes.length, archived: null, createdAt: new Date().toISOString(), ...props };
  checkAcquisition(n);
  d.nodes.push(n);
  if (n.kind !== 'room') record(d,n.acquisition === 'purchase' ? 'purchase' : 'addition',n,{ purchaseCents:n.purchaseCents, effectiveDate:n.acquisition === 'purchase' ? n.purchasedAt : today() });
  return n;
}
function checkAcquisition(n) {
  if (!['existing','purchase'].includes(n.acquisition)) throw Error('Выберите: уже было дома или новая покупка');
  if (!validDate(n.purchasedAt) || n.acquisition === 'purchase' && !n.purchasedAt) throw Error('Укажите дату новой покупки');
}
export function ensureUnplaced(d) {
  let n = getNode(d,UNPLACED_ID);
  if (!n) n = newNode(d,{id:UNPLACED_ID,name:'Без места',kind:'room',virtual:true});
  if (n.kind !== 'room' || n.roomId) throw Error('Зарезервированное место «Без места» занято');
  n.virtual = true;
  return n;
}
// Editing acquisition details corrects its original ledger entry, so changing
// a purchase date/amount cannot leave an expense in the previous month.
export function updateNode(d,nodeId,props) {
  const n = getNode(d,nodeId);
  if (!n) throw Error('Вещь не найдена');
  const updated = {...n,...props,id:n.id,createdAt:n.createdAt,acquisition:props.acquisition ?? n.acquisition ?? (n.purchasedAt ? 'purchase' : 'existing')};
  checkAcquisition(updated);
  if (updated.kind === 'room' && n.kind !== 'room' || n.kind === 'room' && updated.kind !== 'room') throw Error('Нельзя превратить вещь в комнату');
  const beforePurchase = n.purchaseCents, beforeCurrent = n.currentCents;
  if (updated.parentId !== n.parentId) move(d,n.id,updated.parentId);
  if (!Object.hasOwn(props,'order')) updated.order = n.order;
  if (n.furnitureId) updated.furnitureId = n.furnitureId;
  else delete updated.furnitureId;
  if (n.kind === 'furniture' && updated.kind !== 'furniture') {
    detachFurniture(d,n.id);
    delete updated.furnitureId;
  }
  Object.assign(n,updated);
  const shape = d.plan.furniture.find(f => f.id === n.furnitureId);
  if (shape) { shape.name = n.name; shape.inventoryNodeId = n.id; }
  if (n.kind !== 'room') {
    const entries = d.events.filter(e => e.nodeId === n.id && ['purchase','addition'].includes(e.type));
    const entry = entries[0];
    const type = n.acquisition === 'purchase' ? 'purchase' : 'addition';
    const effectiveDate = n.acquisition === 'purchase' ? n.purchasedAt : entry?.type === 'addition' ? entry.effectiveDate || today() : (n.createdAt || '').slice(0,10) || today();
    if (entry) {
      Object.assign(entry,{type,name:n.name,purchaseCents:n.purchaseCents,effectiveDate});
      const duplicateIds = new Set(entries.slice(1).map(e => e.id));
      d.events = d.events.filter(e => !duplicateIds.has(e.id));
    } else record(d,type,n,{purchaseCents:n.purchaseCents,effectiveDate});
    if (beforePurchase !== n.purchaseCents || beforeCurrent !== n.currentCents) record(d,'value',n,{beforePurchase,beforeCurrent,purchaseCents:n.purchaseCents,currentCents:n.currentCents});
  }
  return n;
}
export function detachFurniture(d,nodeId) {
  const n = getNode(d,nodeId);
  if (!n || n.kind !== 'furniture') throw Error('Выберите мебель или технику');
  d.plan.furniture = d.plan.furniture.filter(f => f.id !== n.furnitureId && f.inventoryNodeId !== n.id);
  delete n.furnitureId;
  return n;
}
function containsPoint(r,pos) {
  return Array.isArray(pos) && pos.length >= 2 && pos[0] >= r.rect[0] && pos[0] <= r.rect[0]+r.rect[2] && pos[1] >= r.rect[1] && pos[1] <= r.rect[1]+r.rect[3];
}
export function placeFurniture(d,nodeId,shape) {
  const n = getNode(d,nodeId);
  if (!n || n.kind !== 'furniture' || n.archived) throw Error('Выберите действующую карточку мебели или техники');
  if (!shape?.type || !d.plan.rooms.some(r => containsPoint(r,shape.pos))) throw Error('Разместите мебель внутри комнаты');
  const plan = structuredClone(d.plan);
  plan.furniture = plan.furniture.filter(f => f.id !== n.furnitureId && f.inventoryNodeId !== n.id);
  plan.furniture.push({...structuredClone(shape),id:shape.id || id(),name:n.name,inventoryNodeId:n.id});
  syncPlan(d,plan);
  return n;
}
// Merge geometry by stable IDs, or by an explicit link to an existing card.
// Removing a room displaces its entire inventory tree, including archived nodes.
export function syncPlan(d, raw) {
  const plan = structuredClone(raw);
  plan.furniture ||= [];
  const removedFurniture = new Set((d.trash || []).flatMap(entry => entry.furniture.map(f => f.id)));
  plan.furniture = plan.furniture.filter(f => !removedFurniture.has(f.id));
  if (!plan.rooms?.length) throw Error('В квартире нужна хотя бы одна комната');
  if (plan.rooms.some(r => r.id === 'unplaced')) throw Error('Имя комнаты «unplaced» зарезервировано');
  const removedRooms = d.nodes.filter(n => n.kind === 'room' && !n.virtual && !plan.rooms.some(r => r.id === n.roomId));
  const displaced = removedRooms.flatMap(n => descendants(d,n.id));
  const displacedFurniture = new Set(displaced.map(n => n.furnitureId).filter(Boolean));
  plan.furniture = plan.furniture.filter(f => !displacedFurniture.has(f.id));
  const ids = new Set(), links = new Set();
  for (const f of plan.furniture) {
    f.id ||= id();
    if (ids.has(f.id)) throw Error('Повторяющийся ID мебели');
    ids.add(f.id);
    if (f.inventoryNodeId) {
      const card = getNode(d,f.inventoryNodeId);
      if (!card || card.kind !== 'furniture' || card.archived && card.furnitureId !== f.id) throw Error('Выберите действующую карточку мебели');
      if (d.nodes.some(n => n.id !== card.id && n.furnitureId === f.id)) throw Error('У предмета уже есть карточка. Сначала уберите его с плана');
      if (links.has(card.id)) throw Error('У карточки уже есть предмет на плане');
      links.add(card.id);
    }
  }
  const roomIds = new Set(plan.rooms.map(r => r.id));
  for (const r of plan.rooms) {
    let n = d.nodes.find(x => x.roomId === r.id);
    if (!n) n = newNode(d,{ id:'room:'+r.id, kind:'room', name:r.name, roomId:r.id });
    n.name = r.name;
  }
  const noPlace = ensureUnplaced(d);
  const before = new Map(displaced.map(n => [n.id,address(d,n)]));
  for (const room of removedRooms) for (const n of d.nodes.filter(n => n.parentId === room.id)) {
    n.parentId = noPlace.id;
    n.order = children(d,noPlace.id).length;
  }
  for (const n of displaced) record(d,'move',n,{from:before.get(n.id),to:address(d,n)});
  d.nodes = d.nodes.filter(n => n.kind !== 'room' || n.virtual || roomIds.has(n.roomId));
  // The new geometry is authoritative; obsolete links cannot resurrect objects.
  for (const n of d.nodes) if (n.furnitureId && !plan.furniture.some(f => f.id === n.furnitureId)) delete n.furnitureId;
  d.plan = plan;
  const linked = new Set();
  for (const f of [...plan.furniture]) {
    let n = f.inventoryNodeId ? getNode(d,f.inventoryNodeId) : d.nodes.find(n => n.furnitureId === f.id);
    let ancestor = n; while (ancestor && ancestor.kind !== 'room') ancestor = getNode(d,ancestor.parentId);
    const room = plan.rooms.find(r => r.id === ancestor?.roomId && containsPoint(r,f.pos)) || plan.rooms.find(r => containsPoint(r,f.pos));
    if (!n) n = newNode(d,{ kind:'furniture', name:f.name || FURNITURE_NAMES[f.type] || f.type, parentId:room ? 'room:'+room.id : noPlace.id, categoryId:f.type === 'fridge' || f.type === 'tv' ? 'electronics' : 'furniture' });
    if (linked.has(n.id)) throw Error('У карточки уже есть предмет на плане');
    linked.add(n.id);
    n.furnitureId = f.id;
    if (typeof f.name === 'string' && f.name.trim()) n.name = f.name.trim();
    f.name = n.name;
    f.inventoryNodeId = n.id;
    if (!n.archived && (ancestor?.roomId !== room?.id || !room)) move(d,n.id,room ? 'room:'+room.id : noPlace.id);
    // Moving a new unplaced card is a no-op, so detach it explicitly as well.
    if (!room) { plan.furniture = plan.furniture.filter(x => x.id !== f.id); delete n.furnitureId; }
  }
}
// Version 1 backups remain compatible. Explicit legacy purchase dates survive;
// undated additions no longer count as purchases on the day of cataloguing.
export function migrate(d) {
  rememberCategoryIcons(d);
  const allNodes = [...d.nodes,...(d.trash || []).flatMap(e => e.nodes)];
  for (const n of allNodes) n.acquisition ??= n.purchasedAt ? 'purchase' : 'existing';
  for (const e of d.events) if (['purchase','addition'].includes(e.type)) {
    const n = allNodes.find(n => n.id === e.nodeId);
    if (!n || n.kind === 'room') continue;
    e.type = n.acquisition === 'purchase' ? 'purchase' : 'addition';
    if (e.type === 'purchase') { e.effectiveDate = n.purchasedAt; e.purchaseCents = n.purchaseCents; }
  }
  ensureUnplaced(d);
  for (const n of d.nodes.filter(n => n.furnitureId)) {
    const f = d.plan.furniture.find(f => f.id === n.furnitureId);
    if (!f) delete n.furnitureId;
    else { f.inventoryNodeId = n.id; f.name = n.name; }
  }
  return d;
}
export function createHome(d,{mode='empty'}={}) {
  if (!['empty','plan'].includes(mode)) throw Error('Выберите пустую квартиру или текущий план');
  const plan = mode === 'plan' ? structuredClone(d.plan) : {
    version:1,name:'Моя квартира',wallHeight:2.6,interiorWallHeight:1.25,
    rooms:[{id:'main',name:'Комната',rect:[0,0,6,4],floor:'oak'}],
    openings:[],furniture:[],lights:[],acs:[],scenes:[],
  };
  // Geometry stays in plan mode; demo prices, photos and contents do not.
  for (const f of plan.furniture) { delete f.inventoryNodeId; delete f.name; }
  const next = {format:FORMAT,version:1,revision:0,plan,nodes:[],categories:structuredClone(d.categories),events:[],trash:[],settings:structuredClone(d.settings)};
  next.settings.apartmentFill = null;
  syncPlan(next,plan);
  return validate(next);
}
export function validate(d) {
  if (!d || d.format !== FORMAT || d.version !== 1 || !Array.isArray(d.nodes) || !Array.isArray(d.categories) || !Array.isArray(d.events) || !d.settings || !d.plan?.rooms?.length || !Array.isArray(d.plan.furniture)) throw Error('Это не резервная копия «Мой дом» версии 1');
  if (d.nodes.length > 50000 || d.events.length > 1000000) throw Error('Слишком большая копия');
  const ids = new Set(); const cats = new Set();
  for (const c of d.categories) { if (!c || typeof c.id !== 'string' || !c.id || cats.has(c.id) || typeof c.name !== 'string') throw Error('Некорректные категории'); cats.add(c.id); }
  for (const c of d.categories) { const seen = new Set([c.id]); for (let p = c.parentId; p;) { if (!cats.has(p) || seen.has(p)) throw Error('Некорректная иерархия категорий'); seen.add(p); p = d.categories.find(x => x.id === p).parentId; } }
  for (const n of d.nodes) {
    if (!n || typeof n.id !== 'string' || !n.id || ids.has(n.id) || typeof n.name !== 'string' || !n.name.trim() || !(n.kind in KINDS)) throw Error('Некорректная карточка или повторяющийся ID');
    ids.add(n.id);
    for (const key of ['purchaseCents','currentCents']) if (n[key] != null && (!Number.isSafeInteger(n[key]) || n[key] < 0)) throw Error('Некорректная стоимость');
    for (const key of ['fill','wear']) if (n[key] != null && (!Number.isFinite(n[key]) || n[key] < 0 || n[key] > 100)) throw Error('Процент должен быть от 0 до 100');
    if (n.photo && (typeof n.photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(n.photo) || n.photo.length > 5000000)) throw Error('Некорректная фотография');
    if (!n.fields || typeof n.fields !== 'object' || Array.isArray(n.fields) || Object.values(n.fields).some(x => typeof x !== 'string')) throw Error('Некорректные характеристики');
    if (!Number.isFinite(n.quantity) || n.quantity <= 0) throw Error('Количество должно быть больше нуля');
    if (!['purchasedAt','expiry','warranty'].every(k => validDate(n[k]))) throw Error('Некорректная дата');
    if (n.acquisition != null) checkAcquisition(n);
    if (n.virtual && (n.id !== UNPLACED_ID || n.kind !== 'room' || n.roomId)) throw Error('Некорректное место «Без места»');
    if (typeof n.notes !== 'string' || typeof n.unit !== 'string' || !CONDITIONS.includes(n.condition) || !Number.isFinite(n.order)) throw Error('Некорректные поля карточки');
    if (n.archived && (!validDate(n.archived.date) || !n.archived.date || typeof n.archived.reason !== 'string' || typeof n.archived.group !== 'string' || n.archived.saleCents != null && (!Number.isSafeInteger(n.archived.saleCents) || n.archived.saleCents < 0))) throw Error('Некорректные данные архива');
    if (n.categoryId && !cats.has(n.categoryId)) throw Error('Категория не найдена');
  }
  for (const e of d.events) {
    if (!e || typeof e.id !== 'string' || typeof e.nodeId !== 'string' || typeof e.name !== 'string' || !['purchase','addition','move','archive','value','restore','delete','recover','undo'].includes(e.type) || typeof e.date !== 'string' || Number.isNaN(Date.parse(e.date)) || e.effectiveDate && !validDate(e.effectiveDate)) throw Error('Некорректная запись истории');
    for (const key of ['purchaseCents','currentCents','saleCents','beforePurchase','beforeCurrent']) if (e[key] != null && (!Number.isSafeInteger(e[key]) || e[key] < 0)) throw Error('Некорректная сумма в истории');
  }
  const furnitureIds = new Set(), linkedCards = new Set();
  for (const f of d.plan.furniture) {
    if (!f.id || furnitureIds.has(f.id)) throw Error('Повторяющийся ID мебели');
    furnitureIds.add(f.id);
    if (f.inventoryNodeId) {
      const n = getNode(d,f.inventoryNodeId);
      if (!n || n.kind !== 'furniture' || n.furnitureId !== f.id || linkedCards.has(n.id)) throw Error('Некорректная связь мебели с карточкой');
      linkedCards.add(n.id);
    }
  }
  const inventoryFurnitureLinks = new Set();
  for (const n of d.nodes) {
    if (n.furnitureId) {
      if (n.kind !== 'furniture' || inventoryFurnitureLinks.has(n.furnitureId)) throw Error('Мебель на плане связана с несколькими карточками');
      inventoryFurnitureLinks.add(n.furnitureId);
    }
    if (n.kind !== 'room' && (!ids.has(n.parentId) || getNode(d,n.parentId).kind === 'item')) throw Error('Место хранения не найдено');
    if (!n.archived && n.parentId && getNode(d,n.parentId)?.archived) throw Error('Действующая вещь внутри архива');
    address(d,n);
  }
  if (!Number.isInteger(d.settings.reminderDays) || d.settings.reminderDays < 0 || d.settings.reminderDays > 365) throw Error('Некорректный срок напоминаний');
  if (d.settings.apartmentFill != null && (!Number.isFinite(d.settings.apartmentFill) || d.settings.apartmentFill < 0 || d.settings.apartmentFill > 100)) throw Error('Заполненность квартиры должна быть от 0 до 100');
  if (d.trash != null && !Array.isArray(d.trash)) throw Error('Некорректная корзина');
  const trashIds=new Set(),allNodeIds=new Set(ids),allFurnitureIds=new Set(furnitureIds);
  const room=d.nodes.find(n=>n.kind==='room'&&!n.archived);
  for (const entry of d.trash||[]) {
    if (!entry || typeof entry.id!=='string' || trashIds.has(entry.id) || typeof entry.removedAt!=='string' || Number.isNaN(Date.parse(entry.removedAt)) || !Array.isArray(entry.nodes) || !entry.nodes.length || !Array.isArray(entry.furniture)) throw Error('Некорректная запись корзины');
    trashIds.add(entry.id);
    const ownIds=new Set(entry.nodes.map(n=>n.id));
    if (!ownIds.has(entry.rootId) || entry.nodes.some(n=>n.kind==='room' || allNodeIds.has(n.id) || n.id!==entry.rootId&&!ownIds.has(n.parentId))) throw Error('Некорректное содержимое корзины');
    for (const n of entry.nodes) allNodeIds.add(n.id);
    const ownFurniture=new Set(entry.nodes.map(n=>n.furnitureId).filter(Boolean));
    for (const f of entry.furniture) { if (allFurnitureIds.has(f.id) || !ownFurniture.has(f.id)) throw Error('Некорректная мебель в корзине');allFurnitureIds.add(f.id); }
    if (!room) throw Error('Для восстановления нужна комната');
    const nodes=structuredClone(entry.nodes);nodes.find(n=>n.id===entry.rootId).parentId=room.id;
    // Reuse the full card/tree validation, without recursively validating trash.
    validate({...d,trash:[],nodes:[...d.nodes,...nodes],plan:{...d.plan,furniture:[...d.plan.furniture,...entry.furniture]}});
  }
  return d;
}
export function dueItems(d, now = today()) {
  const base = new Date(now+'T00:00:00');
  return d.nodes.filter(n => !n.archived).flatMap(n => ['expiry','warranty'].filter(key => n[key]).map(key => ({ node:n, key, days: Math.round((new Date(n[key]+'T00:00:00')-base)/86400000) }))).filter(x => x.days <= d.settings.reminderDays).sort((a,b) => a.days-b.days);
}
export function demo(plan) {
  const labels = { living:'Гостиная', dining:'Столовая', bedroom:'Спальня', kitchen:'Кухня', bath:'Ванная', hall:'Прихожая', balcony:'Балкон', main:'Квартира' };
  plan = structuredClone(plan); plan.name = 'Моя квартира';
  for (const r of plan.rooms) r.name = labels[r.id] || r.name;
  if (!plan.furniture.some(f => f.type === 'wardrobe')) {
    const dresser = plan.furniture.find(f => f.type === 'dresser');
    if (dresser) { dresser.type = 'wardrobe'; dresser.width = 1.5; }
    else plan.furniture.push({type:'wardrobe',pos:[0.3,1.5],rot:90});
  }
  if (!plan.furniture.some(f => f.type === 'desk')) plan.furniture.push({type:'desk',pos:[5.8,4.55],rot:-90,width:1.4});
  const roots = [['furniture','Мебель'],['electronics','Электроника'],['clothes','Одежда'],['food','Продукты'],['dishes','Посуда'],['tools','Инструменты'],['sport','Спорт'],['books','Книги'],['medicine','Аптечка'],['decor','Декор'],['cleaning','Бытовая химия'],['cosmetics','Уход и косметика'],['linen','Домашний текстиль'],['documents','Документы'],['hobby','Хобби'],['pets','Товары для животных'],['outdoor','Туризм'],['accessories','Аксессуары'],['other','Другое']];
  const d = { format:FORMAT, version:1, revision:0, plan, nodes:[], categories:roots.map(([id,name]) => ({id,name,parentId:null,kind:id})), events:[], settings:{reminderDays:3,notifications:false} };
  for (const [parentId,names] of [['clothes',['Верхняя одежда','Футболки','Брюки','Обувь']],['food',['Крупы','Молочные продукты','Овощи']],['electronics',['Компьютеры','Периферия','Бытовая техника']]]) for (const name of names) d.categories.push({id:id(),name,parentId});
  syncPlan(d,plan);
  const wardrobe = d.nodes.find(n => d.plan.furniture.find(f => f.id === n.furnitureId)?.type === 'wardrobe') || d.nodes.find(n => n.kind === 'furniture');
  wardrobe.name = 'Шкаф в спальне'; wardrobe.purchaseCents = 4200000; wardrobe.currentCents=3500000; wardrobe.fill=65;
  d.plan.furniture.find(f => f.id === wardrobe.furnitureId).name = wardrobe.name;
  const shelf = newNode(d,{name:'Полка 1',kind:'shelf',parentId:wardrobe.id,fill:55});
  const drawer = newNode(d,{name:'Выдвижной ящик',kind:'drawer',parentId:wardrobe.id,fill:35});
  const box = newNode(d,{name:'Коробка с аксессуарами',kind:'box',parentId:drawer.id,purchaseCents:79000,fill:40,categoryId:'accessories'});
  newNode(d,{name:'Футболка Nike',parentId:shelf.id,categoryId:'clothes',purchaseCents:350000,currentCents:220000,wear:20,fields:{'Бренд':'Nike','Цвет':'Белый','Размер':'L'}});
  newNode(d,{name:'Худи',parentId:shelf.id,categoryId:'clothes',purchaseCents:690000,currentCents:450000,wear:15,fields:{'Цвет':'Серый','Размер':'L'}});
  newNode(d,{name:'Ремень',parentId:box.id,categoryId:'accessories',purchaseCents:180000,currentCents:120000});
  const desk = d.nodes.find(n => d.plan.furniture.find(f => f.id === n.furnitureId)?.type === 'desk') || wardrobe;
  newNode(d,{name:'MacBook',parentId:desk.id,categoryId:'electronics',purchaseCents:14999000,currentCents:11500000,fields:{'Бренд':'Apple','Модель':'MacBook'},notes:'Рабочий ноутбук'});
  const fridge = d.nodes.find(n => d.plan.furniture.find(f => f.id === n.furnitureId)?.type === 'fridge') || wardrobe;
  const exp = new Date(); exp.setDate(exp.getDate()+2); const localExp = `${exp.getFullYear()}-${String(exp.getMonth()+1).padStart(2,'0')}-${String(exp.getDate()).padStart(2,'0')}`;
  newNode(d,{name:'Молоко',parentId:fridge.id,categoryId:'food',purchaseCents:12900,quantity:1,unit:'л',expiry:localExp});
  newNode(d,{name:'Рис',parentId:fridge.parentId,categoryId:'food',purchaseCents:15900,quantity:0.9,unit:'кг'});
  for (const e of d.events.filter(e => ['purchase','addition'].includes(e.type))) e.purchaseCents = getNode(d,e.nodeId)?.purchaseCents ?? null;
  for (const n of d.nodes) n.demo = true;
  for (const e of d.events) e.demo = true;
  rememberCategoryIcons(d);
  return validate(d);
}
