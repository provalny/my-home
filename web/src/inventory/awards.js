import { RARITIES } from './rarity.js';
import { isSection } from './ikea-storage.js';
import { bagStats, storageExists } from '../travel/model.js';

// Optional, rebuildable achievements. Business operations never depend on them.
export const AWARD_GROUPS = [
  ['inventory','Каталог и хранение','box'], ['monitoring','Мониторинг квартиры','homeassistant'],
  ['automobile','Автомобиль','car'], ['travel','Походы и отпуска','outdoor'],
  ['metrics','Личные метрики','heart'], ['routine','Регулярность','trophy'],
].map(([id,name,glyph])=>({id,name,glyph}));
const definitions = (group,rows) => rows.map(([id,name,description,target,glyph,metric,rarity='common',hidden=false])=>({id,name,description,target,glyph,metric,rarity,hidden,group}));
export const AWARDS = [
  ...definitions('inventory',[
    ['first-item','Начало порядка','Внесите первую собственную вещь',1,'box','items','common'],
    ['items-10','Всё под рукой','Учтите 10 вещей',10,'box','items','uncommon'],
    ['items-50','Домашний каталог','Учтите 50 вещей',50,'book','items','rare'],
    ['items-100','Хранитель дома','Учтите 100 вещей',100,'shield','items','epic'],
    ['items-500','Личный музей','Учтите 500 вещей',500,'trophy','items','legendary'],
    ['first-room','Первая комната','Разместите вещь в комнате',1,'home','rooms','poor'],
    ['rooms-3','Осваиваем квартиру','Разместите вещи в трёх комнатах',3,'map','rooms','uncommon'],
    ['storage-5','По полочкам','Используйте пять мест хранения с вещами',5,'folder','storage','uncommon'],
    ['storage-depth-3','Матрёшка','Уберите вещь в три вложенных места хранения',3,'box','depth','rare',true],
    ['all-placed','Всё на своих местах','Разместите все вещи, минимум 10, в комнатах или автомобиле',10,'check','placed','rare'],
    ['categories-5','По разрядам','Используйте пять основных категорий вещей',5,'list','categories','uncommon'],
    ['photos-10','Узнаю с первого взгляда','Добавьте фото к 10 вещам',10,'camera','photos','uncommon'],
    ['photos-100','Фотоархив','Добавьте фото к 100 вещам',100,'camera','photos','epic'],
    ['prices-10','Знаю цену','Укажите цену или оценку у 10 вещей',10,'activity','prices','uncommon'],
    ['attributes-10','Всё в деталях','Заполните характеристики у 10 вещей',10,'sliders','attributes','uncommon'],
    ['rooms-fill','Вижу заполненность','Укажите заполненность всех комнат',1,'home','fill','common'],
    ['expiry-3','Свежесть под контролем','Укажите срок годности у трёх вещей',3,'food','expiry','common'],
    ['warranty-3','Гарантия под рукой','Укажите срок гарантии у трёх вещей',3,'shield','warranty','common'],
    ['first-move','Новое место','Переместите вещь в другое место',1,'map','move','poor'],
    ['first-backup','Запасной ключ','Успешно сохраните резервную копию',1,'key','backup','uncommon'],
    ['wear-10','Забота о вещах','Включите учёт износа у 10 вещей',10,'tools','wear','rare'],
    ['full-cards-50','Хранитель подробностей','У 50 вещей одновременно заполните фото, цену и характеристики',50,'book','completeCards','epic',true],
  ]),
  ...definitions('monitoring',[
    ['monitor-first','Пульс дома','Создайте свою квартиру в мониторинге',1,'homeassistant','apartments','poor'],
    ['readings-first','Первые показания','Внесите показания счётчика',1,'plug','readings','common'],
    ['readings-30','Точность по привычке','Сохраните 30 записей показаний',30,'radar','readings','rare'],
    ['monitor-six','Шесть месяцев под контролем','В одной квартире внесите показания за 6 месяцев подряд',6,'homeassistant','readingMonths','legendary'],
    ['paid-first','Квитанция закрыта','Полностью оплатите один счёт с положительным начислением',1,'check','paidBills','common'],
    ['paid-30','Домашняя бухгалтерия','Полностью оплатите 30 счетов с положительным начислением',30,'book','paidBills','epic'],
    ['paid-six','Точно в срок','В одной квартире полностью оплатите все счета вовремя за 6 месяцев подряд (минимум один в месяц)',6,'shield','paidMonths','legendary'],
    ['climate-30','Метеостанция дома','Запишите климат за 30 разных дней',30,'thermo','climateDays','rare'],
    ['home-care-10','Мастер на все руки','Завершите 10 работ по квартире',10,'tools','homeTasks','rare'],
    ['home-care-50','Невидимый домовой','Завершите 50 работ по квартире',50,'key','homeTasks','epic',true],
  ]),
  ...definitions('automobile',[
    ['car-first','Свой гараж','Добавьте свой автомобиль',1,'car','cars','poor'],
    ['refuel-first','Топливный журнал','Внесите первую заправку',1,'plug','refuels','common'],
    ['refuel-24','Каждый бак учтён','Внесите 24 заправки',24,'activity','refuels','rare'],
    ['car-six','Бортовой летописец','Ведите журнал одной машины 6 месяцев подряд',6,'book','carMonths','legendary'],
    ['service-first','Забота о машине','Запишите выполненное ТО',1,'tools','services','uncommon'],
    ['service-10','Надёжный механик','Запишите 10 выполненных ТО',10,'tools','services','epic'],
    ['tires-cycle','Смена сезона','Установите и снимите один комплект шин',1,'tire','tireCycles','rare'],
    ['car-kit','Готов к дороге','Полностью загрузите набор из минимум трёх вещей в машину',1,'bag','carKits','rare'],
    ['car-return','Домой без потерь','Верните домой все вещи набора из минимум трёх вещей',1,'home','returnedKits','epic',true],
  ]),
  ...definitions('travel',[
    ['trip-first','Куда отправимся?','Создайте свою поездку',1,'outdoor','trips','poor'],
    ['route-five','Собственный маршрут','Добавьте пять точек в одну поездку',5,'map','stops','uncommon'],
    ['trip-events-10','Дни со смыслом','Добавьте 10 событий в планы поездок',10,'clock','tripEvents','rare'],
    ['travel-packed','Всё взвешено','Соберите минимум пять вещей в хранилища одной поездки без неизвестного веса и превышения лимитов',1,'backpack','packedTrip','rare'],
    ['loadouts-3','Собираюсь за минуту','Сохраните три непустых лодаута',3,'bag','loadouts','rare'],
    ['trip-complete','Вернулся с историей','Завершите поездку с прошедшей датой окончания, маршрутом и событием',1,'check','completedTrips','uncommon'],
    ['trip-complete-12','Год маленьких открытий','Завершите 12 поездок с прошедшими датами окончания, маршрутами и событиями',12,'globe','completedTrips','legendary'],
    ['trip-modes','Меняя ритм','Используйте три способа передвижения между точками одной поездки',3,'map','travelModes','epic',true],
    ['trip-offline','Вне сети','Сохраните офлайн-схему поездки',1,'download','offlineMaps','uncommon'],
  ]),
  ...definitions('metrics',[
    ['journal-first','Как я сегодня?','Сохраните первую личную отметку',1,'heart','journalDays','poor'],
    ['journal-30','Месяц наблюдений','Сохраните личные отметки за 30 разных дней',30,'heart','journalDays','rare'],
    ['journal-180','Полгода с собой','Сохраните личные отметки за 180 разных дней',180,'heart','journalDays','legendary'],
    ['journal-streak-30','В контакте с собой','Заполняйте личные отметки 30 дней подряд',30,'heat','journalStreak','epic'],
    ['journal-streak-180','Непрерывная линия','Заполняйте личные отметки 180 дней подряд',180,'heat','journalStreak','legendary'],
    ['health-first','Ритм тела','Запишите сон или активность за один день',1,'activity','healthDays','common'],
    ['health-180','Атлас привычек','Запишите сон или активность за 180 разных дней',180,'activity','healthDays','legendary'],
    ['health-import','Мост к здоровью','Импортируйте дневные итоги Apple Health',1,'link','healthImport','uncommon'],
    ['journal-notes-30','Между строк','Добавьте заметки к 30 личным отметкам',30,'book','journalNotes','rare',true],
  ]),
  ...definitions('routine',[
    ['active-7','Первая неделя','Откройте приложение в 7 разных дней после обновления наград',7,'sun','activeDays','uncommon'],
    ['active-30','Вошло в привычку','Откройте приложение в 30 разных дней после обновления наград',30,'clock','activeDays','rare'],
    ['active-90','Сезон порядка','Откройте приложение в 90 разных дней после обновления наград',90,'leaf','activeDays','epic'],
    ['active-180','Полгода вместе','Откройте приложение в 180 разных дней после обновления наград',180,'trophy','activeDays','legendary'],
    ['active-streak-30','Ни дня без порядка','Открывайте приложение 30 дней подряд',30,'heat','activeStreak','epic'],
    ['active-streak-180','Железная привычка','Открывайте приложение 180 дней подряд',180,'shield','activeStreak','legendary'],
    ['active-flex-150','Марафон с передышками','Наберите 150 активных дней за последние 183 дня — пропуски допустимы',150,'outdoor','activeWindow','legendary'],
    ['all-domains','Жизнь в одном месте','Учтите 10 вещей, показания, заправку, завершённую поездку и личную отметку',5,'sparkles','domains','epic'],
    ['all-domains-180','Архитектор своей жизни','Наберите 180 активных дней и получите «Жизнь в одном месте»',180,'trophy','architectDays','legendary',true],
  ]),
];
export const AWARD_RARITIES = RARITIES.map((r,i)=>({...r,name:['Простая','Обычная','Необычная','Редкая','Эпическая','Легендарная'][i],rank:i}));
const object = v => v && typeof v==='object' && !Array.isArray(v) ? v : {};
const rows = v => Array.isArray(v) ? v.filter(r=>r&&typeof r==='object') : [];
const timestamp = v => typeof v==='string' && Number.isFinite(Date.parse(v));
const validDate = v => typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && timestamp(v+'T12:00:00Z') && new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const dayNumber = day => Date.parse(day+'T12:00:00Z')/86400000;
export const awardToday = (now=new Date()) => `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const dated = (list,today) => rows(list).filter(r=>!r.demo&&validDate(r.date)&&r.date<=today);
const uniqueDays = list => [...new Set(list)].sort();
function longestRun(values,numberOf) {
  let best=0,run=0,last=-Infinity;
  for(const n of [...new Set(values.map(numberOf).filter(Number.isFinite))].sort((a,b)=>a-b)){run=n===last+1?run+1:1;best=Math.max(best,run);last=n;}
  return best;
}
const monthNumber = month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? Number(month.slice(0,4))*12+Number(month.slice(5))-1 : NaN;
const monthRun = dates => longestRun(dates.map(d=>d.slice(0,7)),monthNumber);
function grants(doc) {return Object.fromEntries(Object.entries(object(object(doc.awards).earned)).filter(([,v])=>v&&typeof v==='object'&&(v.earnedAt===null||timestamp(v.earnedAt))));}
function activityDays(doc,today) {return uniqueDays(rows(object(doc.awards).activity).map(r=>r.date).filter(d=>validDate(d)&&d<=today));}

export function calculateAwards(doc,context={}) {
  const today=validDate(context.today)?context.today:awardToday(), demo=Boolean(doc.demoProfile);
  const nodes=rows(doc.nodes), categories=rows(doc.categories), byId=new Map(nodes.map(n=>[n.id,n])), cats=new Map(categories.map(c=>[c.id,c]));
  const active=nodes.filter(n=>!n.archived), things=demo?[]:active.filter(n=>!n.demo&&!isSection(n)&&['item','furniture'].includes(n.kind));
  const rooms=active.filter(n=>n.kind==='room'&&!n.virtual), usedRooms=new Set(),usedStorage=new Set(),usedCategories=new Set();
  let depth=0,unplaced=0;
  for(const n of things){
    let p=byId.get(n.parentId),level=0,placed=false;const seen=new Set([n.id]);
    while(p&&!seen.has(p.id)){
      seen.add(p.id);
      if(p.kind==='room'){if(!p.archived&&(!p.virtual||p.automobileId)){placed=true;if(!p.virtual)usedRooms.add(p.id);}break;}
      if(!p.archived){usedStorage.add(p.id);level++;}p=byId.get(p.parentId);
    }
    if(!placed)unplaced++;depth=Math.max(depth,level);
    let c=cats.get(n.categoryId);const seenCats=new Set();while(c?.parentId&&!seenCats.has(c.id)){seenCats.add(c.id);c=cats.get(c.parentId);}if(c)usedCategories.add(c.id);
  }
  const hasPhoto=n=>typeof n.photo==='string'&&Boolean(n.photo),hasPrice=n=>[n.purchaseCents,n.currentCents].some(v=>Number.isSafeInteger(v)&&v>=0),hasFields=n=>Object.values(object(n.fields)).some(v=>String(v??'').trim());
  const apartments=demo?[]:rows(doc.monitoring?.apartments).filter(a=>!a.demo), cars=demo?[]:rows(doc.automobiles?.vehicles).filter(c=>!c.demo);
  const trips=demo?[]:rows(doc.travel?.trips).filter(t=>!t.demo), records=cars.flatMap(c=>dated(c.records,today));
  const completed=trips.filter(t=>t.status==='completed'&&validDate(t.endDate)&&t.endDate<=today&&rows(t.stops).length>=2&&rows(t.events).some(e=>validDate(e.date)&&e.date<=today));
  const journal=demo?[]:dated(doc.personalMetrics?.entries,today), health=demo?[]:dated(doc.personalMetrics?.health,today);
  let paidBills=0,paidMonths=0;
  for(const a of apartments){
    const bills=dated(a.bills,today).filter(b=>b.period<=today.slice(0,7)),payments=dated(a.payments,today);
    const positive=b=>Number.isSafeInteger(b.amountCents)&&Number.isSafeInteger(b.adjustmentCents)&&b.amountCents+b.adjustmentCents>0;
    const billById=new Map(bills.map(b=>[b.id,b])),totals=new Map(),onTime=new Map(),periods=new Map();
    for(const p of payments){
      if(!Number.isSafeInteger(p.amountCents)||p.amountCents<=0)continue;
      totals.set(p.billId,(totals.get(p.billId)||0)+p.amountCents);
      const bill=billById.get(p.billId);
      if(bill&&validDate(bill.dueDate)&&p.date<=bill.dueDate)onTime.set(p.billId,(onTime.get(p.billId)||0)+p.amountCents);
    }
    for(const b of bills.filter(positive)){
      if((totals.get(b.id)||0)>=b.amountCents+b.adjustmentCents)paidBills++;
      const paid=validDate(b.dueDate)&&(onTime.get(b.id)||0)>=b.amountCents+b.adjustmentCents;
      periods.set(b.period,(periods.get(b.period)??true)&&paid);
    }
    paidMonths=Math.max(paidMonths,longestRun([...periods].filter(([,paid])=>paid).map(([period])=>period),monthNumber));
  }
  const days=demo?[]:activityDays(doc,today), domains=[things.length>=10,apartments.some(a=>dated(a.readings,today).length),records.some(r=>r.type==='refuel'),completed.length>0,journal.length>0].filter(Boolean).length;
  const metrics={
    items:things.length,rooms:usedRooms.size,storage:usedStorage.size,depth,placed:unplaced?0:things.length,categories:usedCategories.size,
    photos:things.filter(hasPhoto).length,prices:things.filter(hasPrice).length,attributes:things.filter(hasFields).length,completeCards:things.filter(n=>hasPhoto(n)&&hasPrice(n)&&hasFields(n)).length,
    fill:demo?0:rooms.filter(n=>Number.isFinite(n.fill)&&n.fill>=0&&n.fill<=100).length,
    expiry:things.filter(n=>validDate(n.expiry)).length,warranty:things.filter(n=>validDate(n.warranty)).length,
    wear:things.filter(n=>n.wearMode==='automatic'||n.wearMode==='manual'||typeof n.wear==='number').length,
    move:!demo&&rows(doc.events).some(e=>e.type==='move'&&!e.demo&&timestamp(e.date))?1:0,
    backup:!demo&&(timestamp(context.lastBackupAt)||timestamp(object(doc.awards).backupAt))?1:0,
    apartments:apartments.length,readings:apartments.reduce((s,a)=>s+dated(a.readings,today).length,0),
    readingMonths:Math.max(0,...apartments.map(a=>monthRun(dated(a.readings,today).map(r=>r.date)))),paidBills,paidMonths,
    climateDays:uniqueDays(apartments.flatMap(a=>dated(a.climate,today).map(r=>r.date))).length,
    homeTasks:apartments.reduce((s,a)=>s+rows(a.tasks).filter(t=>!t.demo&&validDate(t.completedAt)&&t.completedAt<=today).length,0),
    cars:cars.length,refuels:records.filter(r=>r.type==='refuel').length,services:records.filter(r=>r.type==='service').length,
    carMonths:Math.max(0,...cars.map(c=>monthRun(dated(c.records,today).map(r=>r.date)))),
    tireCycles:cars.reduce((s,c)=>s+rows(c.tires).filter(t=>rows(t.sessions).some(r=>validDate(r.date)&&validDate(r.endDate)&&r.endDate<=today)).length,0),
    carKits:cars.reduce((s,c)=>s+rows(c.kits).filter(k=>rows(k.entries).length>=3&&k.entries.every(e=>e.packed&&byId.has(e.nodeId)&&!byId.get(e.nodeId).archived)).length,0),
    returnedKits:cars.reduce((s,c)=>s+rows(c.kits).filter(k=>rows(k.entries).length>=3&&k.entries.every(e=>!e.packed&&validDate(e.returnedAt)&&e.returnedAt<=today)).length,0),
    trips:trips.length,stops:Math.max(0,...trips.map(t=>rows(t.stops).length)),tripEvents:trips.reduce((s,t)=>s+rows(t.events).length,0),
    packedTrip:trips.some(t=>{const bags=rows(t.bags),ids=new Set(bags.flatMap(b=>b.items||[]));return ids.size>=5&&bags.every(b=>{if(!storageExists(doc,b))return false;const s=bagStats(doc,b);return !s.missing.length&&!s.deleted.length&&!s.overWeight&&!s.overVolume;});})?1:0,
    loadouts:demo?0:rows(doc.travel?.loadouts).filter(l=>!l.demo&&rows(l.bags).some(b=>Array.isArray(b.items)&&b.items.length)).length,
    completedTrips:completed.length,travelModes:Math.max(0,...trips.map(t=>new Set(rows(t.stops).slice(1).map(s=>s.mode).filter(v=>v&&v!=='manual')).size)),
    offlineMaps:trips.filter(t=>timestamp(t.offlineSavedAt)).length,
    journalDays:uniqueDays(journal.map(r=>r.date)).length,journalStreak:longestRun(journal.map(r=>r.date),dayNumber),journalNotes:journal.filter(r=>typeof r.note==='string'&&r.note.trim()).length,
    healthDays:uniqueDays(health.map(r=>r.date)).length,healthImport:health.some(r=>r.source==='apple-health-export')?1:0,
    activeDays:days.length,activeStreak:longestRun(days,dayNumber),activeWindow:days.filter(d=>dayNumber(today)-dayNumber(d)<183).length,domains,architectDays:domains===5||grants(doc)['all-domains']?days.length:0,
  };
  const earned=demo?{}:grants(doc);
  return AWARDS.map(a=>{const target=a.metric==='fill'?Math.max(1,rooms.length):a.target,value=Math.max(0,Math.min(target,metrics[a.metric]||0)),met=value>=target,previous=earned[a.id];return {...a,target,value,met,earned:Boolean(previous)||met,earnedAt:previous?.earnedAt||null};});
}

/** Daily visits are recorded explicitly, never inferred from old imports or an idle timer. */
export function syncAwards(doc,context={}, {now=null,previous=null,visitDay=null}={}) {
  try {
    const before=JSON.stringify(doc.awards),old=object(doc.awards),earned={...grants(previous||{}),...grants(doc)};
    const activity=uniqueDays([...rows(object(previous?.awards).activity),...rows(old.activity)].map(r=>r.date).filter(validDate));
    if(!doc.demoProfile&&validDate(visitDay)&&!activity.includes(visitDay))activity.push(visitDay);
    const next={...old,version:2,earned,activity:activity.sort().map(date=>({date}))};
    // Calculate on a temporary document: optional corruption cannot partially mutate a save.
    if(timestamp(context.lastBackupAt))next.backupAt=context.lastBackupAt;
    for(const a of calculateAwards({...doc,awards:next},context))if(a.met&&!earned[a.id])earned[a.id]={earnedAt:timestamp(now)?now:null};
    doc.awards=next;return JSON.stringify(next)!==before;
  } catch {return false;}
}
