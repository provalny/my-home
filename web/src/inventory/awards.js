// Optional, rebuildable rewards. No business operation depends on this module succeeding.
export const AWARDS = [
  ['first-item','Начало порядка','Внесите первую собственную вещь',1,'box','items'],
  ['items-10','Всё под рукой','Учтите 10 вещей',10,'box','items'],
  ['items-50','Домашний каталог','Учтите 50 вещей',50,'book','items'],
  ['items-100','Хранитель дома','Учтите 100 вещей',100,'trophy','items'],
  ['first-room','Первая комната','Разместите вещь в комнате',1,'home','rooms'],
  ['rooms-3','Осваиваем квартиру','Разместите вещи в трёх комнатах',3,'map','rooms'],
  ['storage-5','По полочкам','Используйте пять мест хранения с вещами',5,'folder','storage'],
  ['storage-depth-3','Матрёшка','Уберите вещь в три вложенных места хранения',3,'box','depth'],
  ['all-placed','Всё на своих местах','Разместите все вещи, минимум 10, вне «Без места»',10,'check','placed'],
  ['categories-5','По разрядам','Используйте пять основных категорий вещей',5,'list','categories'],
  ['photos-10','Узнаю с первого взгляда','Добавьте фото к 10 вещам',10,'camera','photos'],
  ['prices-10','Знаю цену','Укажите цену или оценку у 10 вещей',10,'activity','prices'],
  ['attributes-10','Всё в деталях','Заполните характеристики у 10 вещей',10,'sliders','attributes'],
  ['rooms-fill','Вижу заполненность','Укажите заполненность всех комнат',1,'home','fill'],
  ['expiry-3','Свежесть под контролем','Укажите срок годности у трёх вещей',3,'food','expiry'],
  ['warranty-3','Гарантия под рукой','Укажите срок гарантии у трёх вещей',3,'shield','warranty'],
  ['first-move','Новое место','Переместите вещь в другое место',1,'map','move'],
  ['first-backup','Запасной ключ','Успешно сохраните резервную копию',1,'key','backup'],
].map(([id,name,description,target,glyph,metric])=>({id,name,description,target,glyph,metric}));

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value+'T12:00:00Z');
  return Number.isFinite(+d) && d.toISOString().slice(0,10) === value;
};
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
function grants(doc) {
  return Object.fromEntries(Object.entries(object(object(doc.awards).earned)).filter(([,v])=>v && typeof v === 'object' && (v.earnedAt === null || timestamp(v.earnedAt))));
}
export function calculateAwards(doc, context={}) {
  const nodes = Array.isArray(doc.nodes) ? doc.nodes : [], categories = Array.isArray(doc.categories) ? doc.categories : [];
  const byId = new Map(nodes.map(n=>[n.id,n])), cats = new Map(categories.map(c=>[c.id,c]));
  const active = nodes.filter(n=>!n.archived), things = active.filter(n=>!n.demo && ['item','furniture'].includes(n.kind));
  const rooms = active.filter(n=>n.kind==='room'&&!n.virtual);
  const usedRooms=new Set(), usedStorage=new Set(), usedCategories=new Set();
  let depth=0, unplaced=0;
  for (const n of things) {
    let p=byId.get(n.parentId), level=0, foundRoom=false;
    const seen = new Set([n.id]);
    while(p&&!seen.has(p.id)) {
      seen.add(p.id);
      if(p.kind==='room') { if(!p.virtual&&!p.archived) {usedRooms.add(p.id);foundRoom=true;} break; }
      if(!p.archived) {usedStorage.add(p.id);level++;}
      p=byId.get(p.parentId);
    }
    if(!foundRoom) unplaced++;
    depth=Math.max(depth,level);
    let c=cats.get(n.categoryId);const seenCats=new Set();
    while(c?.parentId&&!seenCats.has(c.id)){seenCats.add(c.id);c=cats.get(c.parentId);}
    if(c)usedCategories.add(c.id);
  }
  const metrics={
    items:things.length, rooms:usedRooms.size, storage:usedStorage.size, depth,
    placed:unplaced?0:things.length, categories:usedCategories.size,
    photos:things.filter(n=>typeof n.photo==='string'&&n.photo).length,
    prices:things.filter(n=>[n.purchaseCents,n.currentCents].some(v=>Number.isSafeInteger(v)&&v>=0)).length,
    attributes:things.filter(n=>Object.values(object(n.fields)).some(v=>String(v??'').trim())).length,
    fill:rooms.filter(n=>typeof n.fill==='number'&&Number.isFinite(n.fill)&&n.fill>=0&&n.fill<=100).length,
    expiry:things.filter(n=>validDate(n.expiry)).length, warranty:things.filter(n=>validDate(n.warranty)).length,
    move:(doc.events||[]).some(e=>e.type==='move'&&!e.demo&&timestamp(e.date))?1:0,
    backup:timestamp(context.lastBackupAt)||timestamp(object(doc.awards).backupAt)?1:0,
  };
  const earned=grants(doc);
  return AWARDS.map(a=>{
    const target=a.metric==='fill'?Math.max(1,rooms.length):a.target, value=Math.min(target,metrics[a.metric]);
    const met=value>=target, previous=earned[a.id];
    return {...a,target,value,met,earned:Boolean(previous)||met,earnedAt:previous?.earnedAt||null};
  });
}

/** Returns false on reward-only corruption; the caller can always save inventory. */
export function syncAwards(doc, context={}, {now=null, previous=null}={}) {
  try {
    const before=JSON.stringify(doc.awards), old=object(doc.awards);
    const earned={...grants(previous||{}),...grants(doc)};
    doc.awards={...old,version:1,earned};
    if(timestamp(context.lastBackupAt))doc.awards.backupAt=context.lastBackupAt;
    for(const a of calculateAwards(doc,context))if(a.met&&!earned[a.id])earned[a.id]={earnedAt:timestamp(now)?now:null};
    return JSON.stringify(doc.awards)!==before;
  } catch { return false; }
}
