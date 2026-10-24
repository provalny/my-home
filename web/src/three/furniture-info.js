// Dimensions are metres: width (X), height (Y), depth (Z). IDs stay stable in saved plans.
import { IKEA_STORAGE } from '../inventory/ikea-storage.js';
export const EXTRA_MODEL_INFO = {
  officeChair:{name:'Офисное кресло',size:[.65,1.05,.65],category:'furniture',color:'#444b57'},
  gamingDesktop:{name:'Игровая клавиатура, мышь и коврик RGB',size:[.8,.045,.35],category:'electronics',color:'#202530',defaultY:.75},
  monitorStand:{name:'Монитор на стойке',size:[.62,1.3,.4],category:'electronics',color:'#202530'},
  desktopMonitor:{name:'Настольный монитор',size:[.62,.54,.22],category:'electronics',color:'#202530',defaultY:.75},
  smallDesk:{name:'Маленький стол 60 см',size:[.6,.75,.45],category:'furniture',color:'#c8b18f'},
  neonPorsche:{name:'Неоновая вывеска Porsche',size:[1.2,.45,.035],category:'decor',color:'#55bfff',defaultY:1.35},
  ikeaFloorLamp:{name:'Высокий торшер в стиле IKEA',size:[.36,1.6,.36],category:'decor',color:'#f2eee6'},
  whiteSpeaker:{name:'Белая колонка',size:[.17,.27,.18],category:'electronics',color:'#f0f0eb',defaultY:.75},
  bookcaseTall:{name:'Книжный шкаф высокий',size:[.8,2.1,.32],category:'furniture',color:'#c7ad87',storageSections:6},
  bookcaseMedium:{name:'Книжный шкаф средней высоты',size:[.8,1.25,.32],category:'furniture',color:'#c7ad87',storageSections:3},
  pcCase:{name:'Корпус ПК',size:[0.24,0.48,0.46],category:'electronics',area:'Работа',color:'#202532'},
  macBook:{name:'MacBook',size:[0.31,0.22,0.25],category:'electronics',area:'Работа',color:'#b7bec8',defaultY:0.76,fixedSize:true},
  simCockpit:{name:'Кокпит для симрейсинга',size:[0.78,1.08,1.6],category:'electronics',area:'Работа',color:'#252b35'},
  simCockpitTriple:{name:'Кокпит с трипл-скрином',size:[1.85,1.45,1.6],category:'electronics',area:'Работа',color:'#252b35'},
  printer3dEnclosed:{name:'3D-принтер в кожухе',size:[.5,.55,.5],category:'electronics',area:'Работа',color:'#181b22',defaultY:.76},
  printer3dOpen:{name:'3D-принтер без кожуха',size:[.5,.55,.5],category:'electronics',area:'Работа',color:'#eeeeea',defaultY:.76},
  printerCabinet:{name:'Тумбочка под 3D-принтер',size:[.5,.76,.5],category:'furniture',area:'Хранение',color:'#c8b18f',storageSections:2},
  metalRack:{name:'Металлический стеллаж',size:[0.9,1.8,0.4],category:'furniture',area:'Хранение',color:'#a6acb3'},
  tireStack:{name:'Комплект из 4 шин',size:[0.68,0.92,0.68],category:'other',area:'Балкон и гараж',color:'#272a30'},
  washingMachine:{name:'Стиральная машина',size:[0.6,0.85,0.6],category:'electronics',area:'Бытовая техника',color:'#e7e9eb'},
  dishwasher:{name:'Посудомоечная машина',size:[0.6,0.82,0.6],category:'electronics',area:'Кухня',color:'#b4bcc3'},
  stove:{name:'Плита с духовкой',size:[0.5,0.85,0.6],category:'electronics',area:'Кухня',color:'#e5e5df'},
  microwave:{name:'Микроволновая печь',size:[0.48,0.29,0.38],category:'electronics',area:'Кухня',color:'#c3c8ce',defaultY:0.9},
  shoeCabinet:{name:'Узкая обувница',size:[0.8,1.1,0.28],category:'furniture',area:'Прихожая',color:'#c1a17c'},
  hallUnit:{name:'Прихожая с зеркалом и вешалкой',size:[1.2,2.1,0.4],category:'furniture',area:'Прихожая',color:'#c0a17f'},
  cornerSofa:{name:'Угловой диван',size:[2.65,0.88,1.55],category:'furniture',area:'Гостиная',color:'#87938d'},
  slidingWardrobe:{name:'Шкаф-купе с зеркалом',size:[2,2.35,0.65],category:'furniture',area:'Хранение',color:'#d6c6ac'},
  wallUnit:{name:'Стенка для гостиной',size:[2.5,1.9,0.42],category:'furniture',area:'Гостиная',color:'#c4aa85'},
  wallShelf:{name:'Настенная полка',size:[1.1,0.46,0.26],category:'furniture',area:'Хранение',color:'#af8960',defaultY:1.35},
  laundryBasket:{name:'Корзина для белья',size:[0.42,0.58,0.36],category:'furniture',area:'Ванная',color:'#c1b5a0'},
  showerCabin:{name:'Душевая кабина',size:[0.9,2.1,0.9],category:'furniture',area:'Ванная',color:'#c6d4dc'},
  crossover:{name:'Кроссовер',size:[1.86,1.65,4.45],category:'other',area:'Балкон и гараж',color:'#668293'},
};
const safeSize=(value,fallback)=>typeof value==='number'&&Number.isFinite(value)&&value>0?Math.min(15,Math.max(0.1,value)):fallback;
for(const [type,info]of Object.entries(EXTRA_MODEL_INFO))if(IKEA_STORAGE[type])info.size=[...IKEA_STORAGE[type].size];
export function extraDimensions(item) {
  const info=EXTRA_MODEL_INFO[item.type];if(!info)return null;
  const base=item.type==='tireStack'&&item.layout==='row'?[2.8,0.68,0.24]:IKEA_STORAGE[item.type]?.size||info.size;
  if(info.fixedSize)return [...info.size];
  return [safeSize(item.width,base[0]),safeSize(item.height,base[1]),safeSize(item.depth,base[2])];
}
