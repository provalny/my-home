import { randomID } from '../uuid.js';
// Shared identities let overlapping work/hobby packs extend the same tree.
const roots = [
  ['clothes','Одежда','clothes'], ['accessories','Аксессуары','key'],
  ['electronics','Домашняя электроника','laptop'], ['appliances','Бытовая техника','washer','electronics'],
  ['furniture','Мебель','furniture'], ['decor','Уют','palette'], ['linen','Домашний текстиль','bed'],
  ['dishes','Посуда','dishes'], ['food','Продукты','food'], ['tools','Инструменты','tools'],
  ['sport','Спорт','sport'], ['outdoor','Туризм','outdoor','sport'], ['books','Книги','book'],
  ['medicine','Аптечка','medicine'], ['cosmetics','Уход и косметика','sparkles'],
  ['cleaning','Бытовая химия','cleaning'], ['documents','Документы','documents'],
  ['hobby','Творчество, игры и коллекции','hobby','default'], ['pets','Товары для животных','pets'],
  ['auto','Авто и транспорт','car','tools'],
];
const categories = roots.map(([key,name,icon,kind]) => ({key,name,icon,kind:kind||key,parentKey:null,legacyId:key}));
categories.find(c=>c.key==='appliances').legacyParentId='electronics';
function branch(parentKey, entries) {
  for (const [key,name,icon] of entries) categories.push({key:`${parentKey}.${key}`,name,icon,parentKey});
}
branch('clothes', [['outer','Верхняя одежда'],['tops','Футболки'],['trousers','Брюки'],['shoes','Обувь','shoes'],['sportswear','Спортивная одежда']]);
branch('accessories', [['bags','Сумки и рюкзаки'],['photo-bags','Фотосумки'],['jewelry','Украшения и часы']]);
branch('electronics', [['computers','Компьютеры','laptop'],['peripherals','Периферия','plug'],['phones','Телефоны','phone'],['photo','Фото и видео','camera'],['audio','Аудио','film'],['network','Сетевое оборудование','bridge'],['gaming','Игровая техника','games']]);
branch('electronics.photo', [['cameras','Камеры'],['lenses','Объективы'],['lighting','Свет'],['supports','Штативы и крепления']]);
branch('appliances', [['kitchen','Кухонная техника','stove'],['cleaning','Техника для уборки'],['laundry','Техника для стирки','washer'],['climate','Климатическая техника','cool']]);
branch('furniture', [['storage','Мебель для хранения'],['tables','Столы и стулья'],['beds','Кровати и диваны']]);
branch('decor', [['lighting','Освещение','bulb'],['interior','Предметы интерьера'],['plants','Комнатные растения','flower'],['rugs','Ковры']]);
branch('linen', [['bedding','Постельное бельё'],['towels','Полотенца']]);
branch('dishes', [['tableware','Столовая посуда'],['cookware','Приготовление пищи'],['storage','Хранение продуктов'],['baking','Выпечка']]);
branch('food', [['grains','Крупы'],['dairy','Молочные продукты','milk'],['vegetables','Овощи'],['drinks','Напитки'],['stock','Долгосрочные запасы']]);
branch('tools', [['hand','Ручные инструменты'],['power','Электроинструменты'],['materials','Материалы и крепёж'],['measuring','Измерительные приборы'],['garden','Садовые инструменты','leaf']]);
branch('sport', [['cycling','Велосипеды и аксессуары'],['fitness','Тренировки и фитнес'],['winter','Зимние виды спорта'],['fishing','Рыболовные снасти'],['protection','Спортивная защита']]);
branch('outdoor', [['shelter','Палатки и укрытия'],['sleep','Спальные мешки и коврики'],['cooking','Походная кухня'],['navigation','Навигация и фонари']]);
branch('books', [['fiction','Художественная литература'],['professional','Профессиональная литература'],['magazines','Журналы'],['media','Пластинки и диски']]);
branch('medicine', [['medicines','Лекарства'],['first-aid','Первая помощь'],['devices','Медицинские приборы']]);
branch('cosmetics', [['hygiene','Гигиена'],['care','Уход'],['cosmetics','Косметика']]);
branch('cleaning', [['laundry','Стирка'],['surfaces','Уборка']]);
branch('documents', [['personal','Личные документы'],['work','Рабочие документы'],['stationery','Канцелярия']]);
branch('hobby', [['music','Музыкальные инструменты'],['drawing','Рисование'],['needlework','Шитьё и рукоделие'],['boardgames','Настольные игры','games'],['models','Моделизм'],['collectibles','Коллекционные предметы'],['plants','Растения и уход','flower']]);
branch('pets', [['food','Корма'],['care','Уход за животными'],['accessories','Аксессуары для животных']]);
branch('auto', [['parts','Запчасти'],['care','Уход за транспортом'],['accessories','Автомобильные принадлежности']]);

export const PRESET_CATEGORIES = categories;
const templates = new Map(categories.map(c=>[c.key,c]));
const all = key => categories.filter(c=>c.key===key||c.key.startsWith(key+'.')).map(c=>c.key);
const pack = (id,group,name,icon,description,categoryKeys,collectionKeys=[]) => ({id,group,name,icon,description,categoryKeys,collectionKeys});
const photo = all('electronics.photo').concat('accessories.photo-bags');
const it = ['electronics.computers','electronics.peripherals','electronics.network','books.professional'];
const repair = all('tools').filter(k=>k!=='tools.garden').concat('books.professional');
export const CATEGORY_PACKS = [
  pack('base-clothes','base','Одежда и аксессуары','clothes','Одежда, обувь, сумки и украшения',all('clothes').concat(all('accessories').filter(k=>k!=='accessories.photo-bags'))),
  pack('base-kitchen','base','Кухня и продукты','dishes','Посуда, продукты и кухонная техника',all('dishes').concat(all('food'),'appliances.kitchen')),
  pack('base-electronics','base','Техника','laptop','Компьютеры, телефоны, аудио и бытовая техника',it.concat('electronics.phones','electronics.audio',all('appliances'))),
  pack('base-home','base','Мебель и обустройство','furniture','Мебель, свет, декор и домашний текстиль',all('furniture').concat(all('decor'),all('linen'))),
  pack('base-repair','base','Ремонт и уборка','tools','Инструменты, материалы и бытовая химия',repair.concat(all('cleaning'))),
  pack('base-health','base','Здоровье и уход','medicine','Аптечка, гигиена и косметика',all('medicine').concat(all('cosmetics'))),
  pack('base-documents','base','Книги и документы','book','Литература, документы и канцелярия',all('books').concat(all('documents'))),
  pack('base-pets','base','Животные','pets','Корма, уход и принадлежности',all('pets')),
  pack('base-auto','base','Авто и транспорт','car','Принадлежности, запчасти и уход',all('auto')),
  pack('work-it','work','IT и компьютеры','laptop','Компьютеры, периферия и сетевое оборудование',it,['work']),
  pack('work-photo','work','Фото и видеосъёмка','camera','Камеры, объективы, свет и фотосумки',photo,['work','photography']),
  pack('work-repair','work','Строительство и ремонт','tools','Инструменты, измерение и материалы',repair,['work']),
  pack('work-music','work','Музыка и звук','film','Инструменты и звуковое оборудование',['hobby.music','electronics.audio','electronics.computers'],['work','music']),
  pack('work-design','work','Дизайн и творчество','palette','Компьютер, рисование и материалы',['hobby.drawing','electronics.computers','electronics.peripherals','books.professional'],['work','drawing']),
  pack('work-crafts','work','Шитьё и ручная работа','hobby','Рукоделие, инструменты и материалы',['hobby.needlework','tools.hand','tools.materials'],['work','needlework']),
  pack('work-health','work','Медицина и уход','medicine','Приборы, первая помощь и литература',['medicine.devices','medicine.first-aid','books.professional'],['work']),
  pack('work-office','work','Офис и учёба','documents','Документы, канцелярия и рабочая техника',it.concat('documents.work','documents.stationery'),['work']),
  pack('hobby-photo','hobby','Фотография','camera','Камеры, объективы, свет и фотосумки',photo,['photography']),
  pack('hobby-hiking','hobby','Походы и туризм','outdoor','Палатки, спальники, походная кухня и одежда',all('outdoor').concat('clothes.outer','clothes.shoes','accessories.bags'),['hiking']),
  pack('hobby-fishing','hobby','Рыбалка','outdoor','Снасти, одежда и снаряжение',['sport.fishing','outdoor.shelter','outdoor.cooking','clothes.outer'],['fishing']),
  pack('hobby-cycling','hobby','Велосипед','sport','Велосипед, защита и инструменты',['sport.cycling','sport.protection','clothes.sportswear','tools.hand'],['cycling']),
  pack('hobby-fitness','hobby','Фитнес и тренировки','sport','Инвентарь, спортивная одежда и обувь',['sport.fitness','clothes.sportswear','clothes.shoes'],['fitness']),
  pack('hobby-winter','hobby','Лыжи и сноуборд','cool','Зимний инвентарь, защита и одежда',['sport.winter','sport.protection','clothes.sportswear','clothes.outer'],['winter']),
  pack('hobby-music','hobby','Музыка','film','Инструменты, аудио и пластинки',['hobby.music','electronics.audio','books.media'],['music']),
  pack('hobby-drawing','hobby','Рисование','palette','Художественные материалы и литература',['hobby.drawing','books.professional'],['drawing']),
  pack('hobby-needlework','hobby','Рукоделие','hobby','Шитьё, вязание и материалы',['hobby.needlework','tools.hand','tools.materials'],['needlework']),
  pack('hobby-boardgames','hobby','Настольные игры','games','Игры, дополнения и аксессуары',['hobby.boardgames'],['boardgames']),
  pack('hobby-videogames','hobby','Видеоигры','games','Консоли, игровые компьютеры и периферия',['electronics.gaming','electronics.computers','electronics.peripherals'],['videogames']),
  pack('hobby-models','hobby','Моделизм','box','Модели, ручные инструменты и материалы',['hobby.models','tools.hand','tools.materials'],['models']),
  pack('hobby-collecting','hobby','Коллекционирование','box','Коллекционные предметы и печатные издания',['hobby.collectibles','books.magazines','books.media'],['collecting']),
  pack('hobby-gardening','hobby','Растения и сад','flower','Растения, уход и садовые инструменты',['hobby.plants','tools.garden'],['gardening']),
  pack('hobby-cooking','hobby','Кулинария и выпечка','dishes','Посуда, выпечка и кухонная техника',all('dishes').concat('appliances.kitchen'),['cooking']),
];
export const PRESET_COLLECTIONS = [
  ['work','Работа'],['photography','Фотография'],['hiking','Походы'],['fishing','Рыбалка'],
  ['cycling','Велосипед'],['fitness','Тренировки'],['winter','Зимний спорт'],['music','Музыка'],
  ['drawing','Рисование'],['needlework','Рукоделие'],['boardgames','Настольные игры'],
  ['videogames','Видеоигры'],['models','Моделизм'],['collecting','Коллекции'],['gardening','Растения и сад'],['cooking','Кулинария'],
].map(([key,name])=>({key,name}));
const sameName = (a,b) => a.trim().normalize('NFKC').toLocaleLowerCase('ru')===b.trim().normalize('NFKC').toLocaleLowerCase('ru');

// Preview is pure: accepting the final step is the only catalogue mutation.
export function previewCategoryPacks(doc,packIds) {
  const selected = CATEGORY_PACKS.filter(p=>packIds.includes(p.id));
  const wanted = new Set();
  function include(key) { if(wanted.has(key))return;const c=templates.get(key);if(!c)throw Error('Неизвестная категория набора');if(c.parentKey)include(c.parentKey);wanted.add(key); }
  selected.flatMap(p=>p.categoryKeys).forEach(include);
  const result=[], resolved=new Map();
  for(const key of wanted){
    const c=templates.get(key),parent=c.parentKey?resolved.get(c.parentKey):null;
    const existing=doc.categories.find(x=>x.presetKey===key)
      || (!c.parentKey&&doc.categories.find(x=>x.id===c.legacyId&&!x.parentId))
      || (c.legacyParentId&&doc.categories.find(x=>x.parentId===c.legacyParentId&&sameName(x.name,c.name)))
      || ((!c.parentKey||parent?.existingId)&&doc.categories.find(x=>(x.parentId||null)===(parent?.existingId||null)&&sameName(x.name,c.name)));
    const name=existing?.name||c.name;
    const oldPath=[];for(let n=existing;n&&!oldPath.includes(n);n=doc.categories.find(x=>x.id===n.parentId))oldPath.unshift(n);
    const row={...c,name,existingId:existing?.id||null,depth:parent?parent.depth+1:0,path:existing?oldPath.map(x=>x.name).join(' / '):parent?parent.path+' / '+name:name};
    resolved.set(key,row);result.push(row);
  }
  const collectionKeys=new Set(selected.flatMap(p=>p.collectionKeys));
  const collections=PRESET_COLLECTIONS.filter(c=>collectionKeys.has(c.key)).map(c=>{
    const existing=(doc.collections||[]).find(x=>x.presetKey===c.key)||(doc.collections||[]).find(x=>sameName(x.name,c.name));
    return {...c,name:existing?.name||c.name,existingId:existing?.id||null};
  });
  return {categories:result,collections};
}

export function applyCategoryPacks(doc,packIds,{excludedCategories=[],excludedCollections=[]}={}) {
  const preview=previewCategoryPacks(doc,packIds),ids=new Map();
  const excluded=new Set(excludedCategories),omitCollections=new Set(excludedCollections);
  const selected=preview.categories.filter(c=>!excluded.has(c.key)||c.existingId);
  // Reject an incomplete tree before changing any data.
  const selectedKeys=new Set(selected.map(c=>c.key));
  if(selected.some(c=>c.parentKey&&!selectedKeys.has(c.parentKey)))throw Error('Выберите родительские категории для подкатегорий');
  let addedCategories=0,addedCollections=0;
  for(const c of selected){
    let target=doc.categories.find(x=>x.id===c.existingId);
    if(!target){
      let id=c.parentKey?'preset:'+c.key:c.legacyId;
      if(doc.categories.some(x=>x.id===id))id=randomID();
      target={id,name:c.name,parentId:c.parentKey?ids.get(c.parentKey):null,kind:c.kind||'default',...(c.icon?{icon:c.icon}:{})};
      doc.categories.push(target);addedCategories++;
    }
    target.presetKey=c.key;ids.set(c.key,target.id);
  }
  doc.collections??=[];
  for(const c of preview.collections.filter(c=>!omitCollections.has(c.key)||c.existingId)){
    let target=doc.collections.find(x=>x.id===c.existingId);
    if(!target){target={id:randomID(),name:c.name};doc.collections.push(target);addedCollections++;}
    target.presetKey=c.key;
  }
  doc.settings.categorySetup={version:1,status:'completed',packIds:CATEGORY_PACKS.filter(p=>packIds.includes(p.id)).map(p=>p.id),excludedCategories:[...excluded],excludedCollections:[...omitCollections]};
  return {addedCategories,addedCollections};
}

export const itemCollections = (doc,node) => (doc.collections||[]).filter(c=>(node.collectionIds||[]).includes(c.id));
export function validateCollections(doc) {
  const setup=doc.settings.categorySetup;
  if(setup!=null){
    if(typeof setup!=='object'||Array.isArray(setup)||setup.version!==1||!['completed','skipped'].includes(setup.status)||!Array.isArray(setup.packIds))throw Error('Некорректные настройки мастера категорий');
    for(const values of [setup.packIds,setup.excludedCategories||[],setup.excludedCollections||[]])if(!Array.isArray(values)||values.some(x=>typeof x!=='string')||new Set(values).size!==values.length)throw Error('Некорректный выбор наборов категорий');
  }
  if(doc.collections!=null&&!Array.isArray(doc.collections))throw Error('Некорректные подборки');
  const ids=new Set();
  for(const c of doc.collections||[]){
    if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>200)throw Error('Некорректная подборка');
    ids.add(c.id);
  }
  for(const n of [...doc.nodes,...(Array.isArray(doc.trash)?doc.trash:[]).flatMap(e=>Array.isArray(e?.nodes)?e.nodes:[])]){
    if(n.collectionIds!=null&&(!Array.isArray(n.collectionIds)||n.collectionIds.some(id=>!ids.has(id))||new Set(n.collectionIds).size!==n.collectionIds.length))throw Error('Подборка вещи не найдена или повторяется');
  }
}
