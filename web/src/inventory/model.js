// Inventory is independent of Three.js and the native bridge. Money is integer kopecks.
export const FORMAT = 'my-home-inventory';
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
  return { count: nodes.length, purchase: nodes.reduce((s,n) => s + (n.purchaseCents ?? 0), 0), current: nodes.reduce((s,n) => s + (n.currentCents ?? 0), 0) };
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
    for (const child of children(d,nodeId)) move(d,child.id,destination);
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
export function reorder(d,nodeId,beforeId) {
  const n = getNode(d,nodeId); const b = getNode(d,beforeId);
  if (!n || !b || n.parentId !== b.parentId || n.kind === 'item' || b.kind === 'item') throw Error('Порядок меняется внутри одного места');
  const list = children(d,n.parentId).filter(x => x.id !== n.id); list.splice(list.findIndex(x => x.id === b.id),0,n);
  list.forEach((x,i) => x.order = i);
}
export function newNode(d, props) {
  const n = { id: id(), name: '', kind: 'item', parentId: null, categoryId: '', fields: {}, purchaseCents: null, currentCents: null, wear: null, fill: null, condition: 'Хорошее', photo: null, notes: '', purchasedAt: '', expiry: '', warranty: '', quantity: 1, unit: 'шт.', order: d.nodes.length, archived: null, createdAt: new Date().toISOString(), ...props };
  d.nodes.push(n); if (n.kind !== 'room') record(d,'purchase',n,{ purchaseCents: n.purchaseCents, effectiveDate: n.purchasedAt || today() }); return n;
}
// Merge geometry by stable IDs. Removing furniture from the plan preserves its inventory.
export function syncPlan(d, raw) {
  const plan = structuredClone(raw);
  plan.furniture ||= [];
  const first = plan.rooms[0]; if (!first) throw Error('В квартире нужна хотя бы одна комната');
  const roomIds = new Set(plan.rooms.map(r => r.id));
  for (const r of plan.rooms) {
    let n = d.nodes.find(x => x.roomId === r.id);
    if (!n) n = newNode(d,{ id: `room:${r.id}`, kind:'room', name:r.name, roomId:r.id });
    n.name = r.name;
  }
  for (const n of d.nodes.filter(n => n.kind === 'room' && !roomIds.has(n.roomId))) {
    for (const c of children(d,n.id)) move(d,c.id,`room:${first.id}`);
    for (const c of d.nodes.filter(x => x.parentId === n.id)) c.parentId = `room:${first.id}`;
  }
  d.nodes = d.nodes.filter(n => n.kind !== 'room' || roomIds.has(n.roomId));
  for (const f of plan.furniture) {
    f.id ||= id();
    const room = plan.rooms.find(r => f.pos[0] >= r.rect[0] && f.pos[0] <= r.rect[0]+r.rect[2] && f.pos[1] >= r.rect[1] && f.pos[1] <= r.rect[1]+r.rect[3]) || first;
    let n = d.nodes.find(n => n.furnitureId === f.id);
    if (!n) n = newNode(d,{ kind:'furniture', name:f.name || FURNITURE_NAMES[f.type] || f.type, parentId:`room:${room.id}`, furnitureId:f.id, categoryId: f.type === 'fridge' || f.type === 'tv' ? 'electronics' : 'furniture' });
    if (!n.archived) {
      let ancestor = n; while (ancestor && ancestor.kind !== 'room') ancestor = getNode(d,ancestor.parentId);
      if (ancestor?.roomId !== room.id) move(d,n.id,`room:${room.id}`);
    }
  }
  d.plan = plan;
}
export function validate(d) {
  if (!d || d.format !== FORMAT || d.version !== 1 || !Array.isArray(d.nodes) || !Array.isArray(d.categories) || !Array.isArray(d.events) || !d.settings || !d.plan?.rooms?.length) throw Error('Это не резервная копия «Мой дом» версии 1');
  if (d.nodes.length > 50000 || d.events.length > 1000000) throw Error('Слишком большая копия');
  const ids = new Set(); const cats = new Set();
  const validDate = value => {
    if (value == null || value === '') return true;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value+'T12:00:00Z'); return !Number.isNaN(+date) && date.toISOString().slice(0,10) === value;
  };
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
    if (typeof n.notes !== 'string' || typeof n.unit !== 'string' || !CONDITIONS.includes(n.condition) || !Number.isFinite(n.order)) throw Error('Некорректные поля карточки');
    if (n.archived && (!validDate(n.archived.date) || !n.archived.date || typeof n.archived.reason !== 'string' || typeof n.archived.group !== 'string' || n.archived.saleCents != null && (!Number.isSafeInteger(n.archived.saleCents) || n.archived.saleCents < 0))) throw Error('Некорректные данные архива');
    if (n.categoryId && !cats.has(n.categoryId)) throw Error('Категория не найдена');
  }
  for (const e of d.events) {
    if (!e || typeof e.id !== 'string' || typeof e.nodeId !== 'string' || typeof e.name !== 'string' || !['purchase','move','archive','value','restore'].includes(e.type) || typeof e.date !== 'string' || Number.isNaN(Date.parse(e.date)) || e.effectiveDate && !validDate(e.effectiveDate)) throw Error('Некорректная запись истории');
    for (const key of ['purchaseCents','currentCents','saleCents','beforePurchase','beforeCurrent']) if (e[key] != null && (!Number.isSafeInteger(e[key]) || e[key] < 0)) throw Error('Некорректная сумма в истории');
  }
  const furnitureIds = new Set();
  for (const f of d.plan.furniture || []) { if (!f.id || furnitureIds.has(f.id)) throw Error('Повторяющийся ID мебели'); furnitureIds.add(f.id); }
  for (const n of d.nodes) {
    if (n.kind !== 'room' && (!ids.has(n.parentId) || getNode(d,n.parentId).kind === 'item')) throw Error('Место хранения не найдено');
    if (!n.archived && n.parentId && getNode(d,n.parentId)?.archived) throw Error('Действующая вещь внутри архива');
    address(d,n);
  }
  if (!Number.isInteger(d.settings.reminderDays) || d.settings.reminderDays < 0 || d.settings.reminderDays > 365) throw Error('Некорректный срок напоминаний');
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
  for (const e of d.events.filter(e => e.type === 'purchase')) e.purchaseCents = getNode(d,e.nodeId)?.purchaseCents ?? null;
  return validate(d);
}
