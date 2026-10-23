import { h } from '../ui/dom.js';
import { FURNITURE_NAMES } from '../inventory/model.js';
import { FURNITURE_TYPES } from '../three/furniture.js';
import { EXTRA_MODEL_INFO } from '../three/furniture-info.js';

const svgNS = 'http://www.w3.org/2000/svg';
const shape = (tag, attrs) => {
  const el = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
};

// Small, code-native drawings mirror the silhouettes in the original 3D library.
export function objectThumbnail(kind, type) {
  const svg = shape('svg', { viewBox: '0 0 100 64', 'aria-hidden': 'true', class: 'catalog-thumb' });
  const rect = (x,y,width,height,fill='#9cabc8',rx=3) => svg.append(shape('rect',{x,y,width,height,fill,rx}));
  const line = (x1,y1,x2,y2,stroke='#d9e3f5') => svg.append(shape('line',{x1,y1,x2,y2,stroke,'stroke-width':2}));
  const circle = (cx,cy,r,fill) => svg.append(shape('circle',{cx,cy,r,fill}));
  if (kind === 'furniture' && EXTRA_MODEL_INFO[type]) {
    if(type==='metalRack'){[25,75].forEach(x=>rect(x,6,3,52,'#9ca9b6',0));[12,23,34,45,55].forEach(y=>rect(25,y,53,3,'#b2a58c',0));line(28,14,73,53,'#758594');line(73,14,28,53,'#758594');}
    else if(type==='tireStack'){[13,24,35,46].forEach(y=>{rect(29,y,43,12,'#313740',5);svg.append(shape('ellipse',{cx:50,cy:y+3,rx:18,ry:3,fill:'#69717a'}));svg.append(shape('ellipse',{cx:50,cy:y+3,rx:10,ry:2,fill:'#172033'}));});}
    else if(type==='washingMachine'){rect(27,8,46,49,'#e0e3e9');rect(31,12,38,7,'#b4bbc5');circle(50,37,15,'#6b798b');circle(50,37,11,'#253849');}
    else if(type==='dishwasher'){rect(26,9,48,48,'#bec8d0');rect(29,12,42,8,'#394555');rect(32,24,36,3,'#f0eee8');}
    else if(type==='stove'){rect(29,9,42,48,'#d8dcdf');rect(34,29,32,21,'#263746');[37,46,55,64].forEach(x=>circle(x,20,2,'#718093'));}
    else if(type==='microwave'){rect(15,19,70,30,'#c4cbd1');rect(20,23,46,22,'#273a4a');circle(75,37,4,'#74818f');}
    else if(type==='shoeCabinet'){rect(29,7,42,50,'#ac8e6c');[12,28,44].forEach(y=>{rect(32,y,36,13,'#dfd9cb',1);line(44,y+3,56,y+3,'#84909b');});}
    else if(type==='hallUnit'){rect(18,7,29,50,'#bfa684');rect(22,11,21,39,'#9eb7c6');rect(48,42,35,15,'#bfa684');rect(50,8,31,30,'#c5ad8f');[57,66,75].forEach(x=>line(x,20,x,27,'#58677a'));}
    else if(type==='cornerSofa'){rect(13,18,73,27,'#7e968b',5);rect(63,33,23,24,'#a6b8ac',5);rect(16,30,48,15,'#a6b8ac',4);rect(11,27,7,21,'#657d73');rect(81,27,7,30,'#657d73');}
    else if(type==='slidingWardrobe'){rect(18,5,64,53,'#bca98b');rect(22,9,18,45,'#e0d8ca',1);rect(42,9,17,45,'#98b0c1',1);rect(61,9,17,45,'#e0d8ca',1);}
    else if(type==='wallUnit'){rect(10,43,80,14,'#bca17c');rect(10,7,18,36,'#e0d8c8');rect(33,6,51,5,'#bca17c');rect(73,14,17,25,'#ddd7c8');rect(33,21,33,19,'#344b61');}
    else if(type==='wallShelf'){[21,44].forEach(y=>rect(15,y,70,4,'#b38d67'));[25,75].forEach(x=>line(x,15,x,49,'#7e8fa7'));}
    else if(type==='laundryBasket'){rect(30,10,40,46,'#ac9e85',5);for(let y=17;y<51;y+=6)line(34,y,66,y,'#d5c7ab');[38,50,62].forEach(x=>line(x,16,x,52,'#776e60'));}
    else if(type==='showerCabin'){rect(25,7,50,46,'#759aa833');line(25,7,25,52);line(75,7,75,52);line(50,7,50,52,'#93aabd');rect(23,52,54,6,'#e1e6e6');line(51,17,62,17,'#d7e3ec');}
    else if(type==='crossover'){svg.append(shape('path',{d:'M10 39 L19 29 L33 26 L42 14 L68 14 L78 27 L89 32 L93 46 L9 46 Z',fill:'#7899ac'}));svg.append(shape('path',{d:'M37 27 L45 17 L64 17 L73 27 Z',fill:'#283c50'}));circle(28,46,9,'#28303a');circle(76,46,9,'#28303a');circle(28,46,5,'#aebdca');circle(76,46,5,'#aebdca');}
  }
  else if (kind === 'ac') { rect(17,20,66,22,'#dce9f5',5); rect(23,34,54,3,'#688fae',1); line(28,47,24,55,'#77b9ec'); line(50,47,50,57,'#77b9ec'); line(72,47,76,55,'#77b9ec'); }
  else if (kind === 'light') {
    if (type === 'strip') { line(15,40,85,24,'#ffcc91'); line(15,44,85,28,'#8a684b'); }
    else if (type === 'spots') { line(20,19,80,19); [26,50,74].forEach(x=>{rect(x-6,20,12,13,'#d6dce6');circle(x,35,5,'#ffd29b');}); }
    else if (type === 'ceiling') { rect(30,19,40,9,'#cbd6e6'); rect(25,27,50,13,'#ffd29b',7); }
    else { line(50,9,50,type === 'floor' ? 56 : type === 'table' ? 51 : 28); rect(36,type === 'pendant' ? 25 : 17,28,19,'#ffd29b',5); if(type !== 'pendant') rect(type === 'table' ? 34:30,52,type === 'table' ? 32:40,4,'#cbd6e6'); }
  } else if (['sofa','armchair'].includes(type)) { rect(20,18,60,27,'#738db6',6); rect(17,31,66,19,'#b3c4db',5); rect(15,25,9,27); rect(76,25,9,27); line(50,34,50,47,'#738db6'); rect(23,51,5,5); rect(72,51,5,5); }
  else if (['wardrobe','bookshelf','sideboard','dresser','kitchen','fridge','nightstand'].includes(type)) { const tall=['wardrobe','bookshelf','fridge'].includes(type); rect(24,tall?8:25,52,tall?48:31,type==='fridge'?'#d5e0ed':'#aa8964'); if(type==='bookshelf') [20,32,44].forEach(y=>{rect(27,y,46,2,'#d7b58d');rect(30,y-9,7,9,'#728cba',0);rect(43,y-8,6,8,'#c7ae88',0);}); else {line(50,tall?11:27,50,53,'#705a45');rect(45,31,2,8,'#e3d1b6');rect(54,31,2,8,'#e3d1b6');if(type==='dresser'||type==='fridge')line(27,36,73,36,'#705a45');} }
  else if (type === 'bed') { rect(22,10,56,44,'#8e7258'); rect(25,20,50,32,'#c3cee0',4);rect(28,13,20,12,'#edf0f6');rect(52,13,20,12,'#edf0f6');line(27,33,73,33,'#8b9cb8'); }
  else if (type === 'tv') { rect(16,10,68,37,'#172033');rect(20,14,60,29,'#405b86');line(43,48,38,55);line(57,48,62,55);line(32,56,68,56); }
  else if (type === 'plant') { rect(38,39,24,17,'#ad8162');line(50,16,50,43,'#7dab85');[[40,20],[59,15],[38,33],[61,29]].forEach(([x,y])=>{circle(x,y,9,'#7dab85');line(x,y,50,40,'#7dab85');}); }
  else if (type === 'rug') { rect(15,17,70,33,'#6883a9',3);rect(22,23,56,21,'#8198ba',2); }
  else if (type === 'bathtub') { rect(15,18,70,34,'#dbe6ec',10);rect(22,23,56,23,'#7994ab',8); }
  else if (type === 'toilet') { rect(37,12,26,15,'#dbe6ec');rect(33,27,34,23,'#dbe6ec',12);rect(40,30,20,13,'#8ea5bc',8);rect(42,49,16,7,'#c8d7e1'); }
  else { rect(18,25,64,7,'#b8946c');line(24,32,24,54,'#bbccdd');line(76,32,76,54,'#bbccdd');if(type==='desk') {rect(54,10,21,14,'#4b6388');line(65,24,65,25);} if(type==='vanity'){rect(22,32,56,21,'#b8946c');circle(50,26,9,'#dce6ec');} if(type==='diningSet'){[24,68].forEach(x=>{rect(x,10,10,9,'#9babc4');rect(x,40,10,9,'#9babc4');});} }
  return svg;
}

export const FURNITURE_CATEGORIES = [
  ['Все',''], ['NEW · Новые модели (15)',Object.keys(EXTRA_MODEL_INFO).join(' ')],
  ['Хранение','wardrobe bookshelf sideboard dresser nightstand metalRack slidingWardrobe wallShelf'],
  ['Гостиная','sofa armchair coffeeTable tv rug plant cornerSofa wallUnit'], ['Спальня','bed nightstand dresser wardrobe slidingWardrobe'],
  ['Прихожая','hallUnit shoeCabinet'], ['Балкон и гараж','metalRack tireStack crossover'],
  ['Кухня','kitchen island fridge diningSet dishwasher stove microwave'], ['Работа','desk bookshelf'], ['Ванная','vanity bathtub toilet washingMachine showerCabin laundryBasket'],
];

export function openObjectCatalog({kind='furniture', existing=[], placeNodeId=null, rooms=[], roomId, onChoose}) {
  const dialog = h('dialog.object-catalog', {'aria-label':'Добавить на план'});
  const query = h('input.catalog-search', {type:'search',placeholder:'Найти мебель или оборудование…','aria-label':'Поиск по каталогу'});
  const category = h('select', {'aria-label':'Категория каталога'},h('option',{value:''},'Все категории'),
    FURNITURE_CATEGORIES.slice(1).map(([label,types])=>h('option',{value:types},label.startsWith('NEW')?label:label+((types.split(' ').filter(t=>EXTRA_MODEL_INFO[t]).length)?` · ${types.split(' ').filter(t=>EXTRA_MODEL_INFO[t]).length} NEW`:''))),
    h('option',{value:'lights'},'Светильники'),h('option',{value:'ac'},'Кондиционеры'));
  const room = h('select', {'aria-label':'Комната размещения'},rooms.map(r=>h('option',{value:r.id},r.name||r.id)));
  room.value=roomId||rooms[0]?.id||'';
  const linked = h('select', {'aria-label':'Карточка мебели'},h('option',{value:''},'Создать новую карточку'),existing.map(n=>h('option',{value:n.id},n.name)));
  linked.value=placeNodeId||'';
  const grid=h('div.catalog-grid');
  const close=()=>{dialog.close();dialog.remove();};
  const choices = [...FURNITURE_TYPES.map(type=>({kind:'furniture',type,name:FURNITURE_NAMES[type]||type})),
    ...Object.entries({ceiling:'Потолочный светильник',pendant:'Подвесной светильник',spots:'Споты',floor:'Торшер',table:'Настольная лампа',strip:'Светодиодная лента'}).map(([type,name])=>({kind:'light',type,name})),
    {kind:'ac',type:'ac',name:'Кондиционер'}];
  category.value=kind==='light'?'lights':kind==='ac'?'ac':'';
  function render(){
    const q=query.value.trim().toLocaleLowerCase('ru');
    const list=choices.filter(x=>(!linked.value||x.kind==='furniture')&&(!q||x.name.toLocaleLowerCase('ru').includes(q))&&(!category.value||(category.value==='lights'?x.kind==='light':category.value==='ac'?x.kind==='ac':x.kind==='furniture'&&category.value.split(' ').includes(x.type))));
    grid.replaceChildren(...list.map(x=>h('button.catalog-item',{onclick:()=>{if(!room.value)return;onChoose({...x,roomId:room.value,nodeId:x.kind==='furniture'?linked.value||null:null});close();}},objectThumbnail(x.kind,x.type),h('b',x.name,EXTRA_MODEL_INFO[x.type]?h('em.catalog-new','NEW'):null),h('span',x.kind==='furniture'?(linked.value?'Связать с карточкой':'Мебель и учёт'): 'Декоративный объект'))));
    if(!list.length)grid.append(h('p.note','Ничего не найдено. Измените запрос или категорию.'));
  }
  query.addEventListener('input',render);category.addEventListener('change',render);linked.addEventListener('change',()=>{if(linked.value)category.value='';render();});
  dialog.append(h('header.catalog-head',h('div',h('h2',placeNodeId?'Разместить мебель':'Добавить на план'),h('p.note','Выберите модель, затем уточните её положение и размеры.')),h('button.btn',{onclick:close,'aria-label':'Закрыть каталог'},'Закрыть')),
    h('div.catalog-controls',query,category),h('div.catalog-controls',h('label.field',h('span','Комната'),room),h('label.field',h('span','Мебель в каталоге'),linked)),grid);
  dialog.addEventListener('cancel',()=>dialog.remove());
  document.body.append(dialog);dialog.showModal();render();query.focus();
}
