import {weightKg,estimatedWeight} from '../inventory/weights.js';
import {vehicleModelType} from '../automobile/vehicle-model.js';
import { randomID } from '../uuid.js';

export const MODES = {car:'Авто',foot:'Пешком',bike:'Велосипед',train:'Поезд',plane:'Самолёт',manual:'Вручную'};
export const EVENT_TYPES = {activity:'Событие',stay:'Жильё',ticket:'Билет',note:'Заметка',hike:'Пеший поход',cycling:'Велопрогулка',paddling:'Сплав',camping:'Кемпинг / ночёвка',excursion:'Экскурсия',museum:'Музей / выставка',beach:'Пляж / купание',fishing:'Рыбалка',skiing:'Лыжи / сноуборд',sport:'Спорт',meal:'Еда / ресторан',rest:'Отдых',transfer:'Переезд',shopping:'Покупки'};
export const BAG_MODELS = {backpack20:'Рюкзак · 20 л',travelBag30:'Дорожная сумка · 30 л',duffel60:'Багажная сумка · 60 л'};
export const BAG_CAPACITY = {backpack20:20,travelBag30:30,duffel60:60};
const finite = n => typeof n === 'number' && Number.isFinite(n);
const nonnegative = n => finite(n) && n >= 0;
export const number = n => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
export const weightNumber=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(Math.round(n*1000)/1000||0);
export const trips = d => d.travel?.trips || [];
export const loadouts = d => d.travel?.loadouts || [];
export const getTrip = (d,id) => trips(d).find(t=>t.id===id);
export const isPossession = n => Boolean(n && !n.archived && !n.autoSection && !n.virtual && ['item','furniture','box'].includes(n.kind));
export const isStorageCandidate=n=>isPossession(n)&&n.storageEnabled!==false;
export function state(d) { return d.travel ??= {version:1,trips:[],loadouts:[]}; }
export function validDate(s) { return s === '' || typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s; }
export function decimal(value,{required=false,min=0}={}) {
  if(value==null||String(value).trim()===''){if(required)throw Error('Заполните числовое поле');return null;}
  const n=Number(String(value).replace(/\s/g,'').replace(',','.'));
  if(!finite(n)||n<min)throw Error('Укажите число не меньше '+min);return n;
}
export const itemWeightKg=weightKg;
export {estimatedWeight};
export const storageKind=b=>b.kind||'bag';
export const storageNode=(d,b)=>d.nodes.find(n=>n.id===b.nodeId);
export const storageCar=(d,b)=>storageKind(b)==='car'?d.automobiles?.vehicles.find(c=>c.rootId===b.nodeId):null;
export const storageExists=(d,b)=>storageKind(b)==='car'?!!storageCar(d,b):isStorageCandidate(storageNode(d,b));
export function itemVolumeLiters(n){const raw=n?.fields?.['Транспортный объём, л']??n?.fields?.['Объём, л']??n?.volumeLiters;try{return decimal(raw);}catch{return null;}}
export function setWeight(d,id,grams) {
  const n=d.nodes.find(n=>n.id===id);if(!isPossession(n))throw Error('Вещь недоступна');
  if(!nonnegative(grams))throw Error('Укажите вес в граммах');n.fields??={};n.fields['Вес, г']=String(grams);delete n.fields['Вес, кг'];delete n.weightKg;delete n.weightEstimate;
}
export function memberships(d,nodeId,{includeCompleted=false}={}) {
  return trips(d).filter(t=>(includeCompleted||t.status!=='completed')&&t.bags.some(b=>b.nodeId===nodeId||b.items.includes(nodeId)));
}
export function bagStats(d,b) {
  const ownWeight=storageKind(b)==='car'?0:isStorageCandidate(storageNode(d,b))?itemWeightKg(storageNode(d,b)):null;
  const ids=[...(storageKind(b)==='car'?[]:[b.nodeId]),...b.items],missing=[],deleted=[],estimated=[];let weight=0;
  if(!storageExists(d,b))deleted.push(b.nodeId);
  for(const id of ids){const n=d.nodes.find(n=>n.id===id);if(!isPossession(n)){if(!deleted.includes(id))deleted.push(id);continue;}const w=itemWeightKg(n);if(w==null)missing.push(n);else weight+=w;if(estimatedWeight(n))estimated.push(n);}
  return {ownWeight,weight:Math.round(weight*1000000)/1000000,missing,deleted,estimated,overWeight:b.maxWeightKg!=null&&weight>b.maxWeightKg,overVolume:b.capacityLiters!=null&&b.usedLiters!=null&&b.usedLiters>b.capacityLiters};
}
export function tripTotals(d,t){const stats=t.bags.map(b=>bagStats(d,b));return {weight:stats.reduce((s,v)=>s+v.weight,0),ownWeight:stats.reduce((s,v)=>s+(v.ownWeight||0),0),usedLiters:t.bags.reduce((s,b)=>s+(b.usedLiters||0),0),capacityLiters:t.bags.reduce((s,b)=>s+(b.capacityLiters||0),0),unknownVolumes:t.bags.filter(b=>b.usedLiters==null).length,unknownCapacities:t.bags.filter(b=>b.capacityLiters==null).length,missing:stats.flatMap(s=>s.missing),deleted:stats.flatMap(s=>s.deleted),estimated:stats.flatMap(s=>s.estimated),items:new Set(t.bags.flatMap(b=>b.items)).size};}
export function migrateTravel(d){for(const t of trips(d)){if(!t.carId)continue;const car=d.automobiles?.vehicles.find(c=>c.id===t.carId);if(car&&!t.bags.some(b=>b.nodeId===car.rootId))t.bags.push({id:'car-storage:'+t.id+':'+car.id,kind:'car',nodeId:car.rootId,modelType:'trailSuv',color:car.color||'#536d67',capacityLiters:null,usedLiters:null,maxWeightKg:null,items:[]});t.carId=null;}return d;}
export function saveTrip(d,value) {
  const old=getTrip(d,value.id),t={id:randomID(),name:'',startDate:'',endDate:'',participants:1,status:'planned',notes:'',carId:null,stops:[],events:[],bags:[],createdAt:new Date().toISOString(),...(old||{}),...value};
  t.name=t.name.trim();checkTrip(t);const list=state(d).trips,i=list.findIndex(x=>x.id===t.id);i<0?list.push(t):list.splice(i,1,t);return t.id;
}
export function deleteTrip(d,id){state(d).trips=trips(d).filter(t=>t.id!==id);}
export function saveBag(d,tripId,value) {
  const t=getTrip(d,tripId);if(!t)throw Error('Поездка не найдена');const old=t.bags.find(b=>b.id===value.id),kind=value.kind||old?.kind||'bag',node=d.nodes.find(n=>n.id===value.nodeId);
  if(kind==='car'){if(!d.automobiles?.vehicles.some(c=>c.rootId===node?.id))throw Error('Выберите автомобиль из раздела машин');}
  else {if(!isStorageCandidate(node))throw Error('Выберите хранилище из общего каталога');if(itemWeightKg(node)==null)throw Error('Сначала укажите собственный вес хранилища');}
  if(t.bags.some(b=>b.id!==value.id&&b.nodeId===node.id))throw Error('Это хранилище уже добавлено');
  if(t.bags.some(b=>b.items.includes(node.id)))throw Error('Сначала уберите хранилище из другого багажа');
  const b={id:randomID(),nodeId:node.id,kind,modelType:kind==='car'?vehicleModelType(storageCar(d,{kind:'car',nodeId:node.id})):kind==='box'?'box':'backpack20',color:'#637653',capacityLiters:kind==='bag'?20:null,usedLiters:null,maxWeightKg:null,items:[],...(old||{}),...value};
  checkBag(b);const i=t.bags.findIndex(x=>x.id===b.id);i<0?t.bags.push(b):t.bags.splice(i,1,b);return b.id;
}
export function removeBag(d,tripId,bagId){const t=getTrip(d,tripId);if(t)t.bags=t.bags.filter(b=>b.id!==bagId);}
// Only trip references change. Never alter parentId, quantity or the home/car hierarchy.
export function transferItems(d,tripId,bagId,ids) {
  const t=getTrip(d,tripId);if(!t||t.status==='completed')throw Error('Откройте действующую поездку');
  if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string'))throw Error('Не выбраны вещи');
  const b=bagId==null?null:t.bags.find(b=>b.id===bagId);if(bagId!=null&&(!b||!storageExists(d,b)))throw Error('Выберите доступное хранилище');
  const unique=[...new Set(ids)],bagNodes=new Set(t.bags.map(b=>b.nodeId));
  if(b)for(const id of unique){const n=d.nodes.find(n=>n.id===id);if(!isPossession(n))throw Error('Вещь удалена или находится в архиве');if(bagNodes.has(id))throw Error('Сумки и другие хранилища выбираются переключателями сверху');if(itemWeightKg(n)==null)throw Error('Укажите вес: '+n.name);}
  for(const current of t.bags)current.items=current.items.filter(id=>!unique.includes(id));
  if(b)b.items.push(...unique);
}
export function missingWeights(d,ids){return [...new Set(ids)].map(id=>d.nodes.find(n=>n.id===id)).filter(n=>isPossession(n)&&itemWeightKg(n)==null);}
export function saveLoadout(d,tripId,name){const t=getTrip(d,tripId);if(!t||!name?.trim())throw Error('Укажите название лодаута');const l={id:randomID(),name:name.trim(),bags:structuredClone(t.bags)};state(d).loadouts.push(l);return l.id;}
export function applyLoadout(d,tripId,loadoutId){
  const t=getTrip(d,tripId),l=loadouts(d).find(l=>l.id===loadoutId);if(!t||!l)throw Error('Лодаут не найден');
  const skipped=[],bags=[];
  for(const source of l.bags){const n=storageNode(d,source);if(!storageExists(d,source)){skipped.push(source.nodeId);continue;}
    const items=source.items.filter(id=>{const exists=isPossession(d.nodes.find(n=>n.id===id));if(!exists)skipped.push(id);return exists;});
    const unknown=missingWeights(d,[...(storageKind(source)==='car'?[]:[n.id]),...items]);if(unknown.length)throw Error('Укажите вес: '+unknown.map(n=>n.name).join(', '));
    bags.push({...structuredClone(source),id:randomID(),items});
  }
  t.bags=bags;return skipped;
}
export function clearRoutes(t){for(const s of t.stops){delete s.route;}}
export function saveStop(d,tripId,value){const t=getTrip(d,tripId);if(!t)throw Error('Поездка не найдена');const s={id:randomID(),mode:'car',manual:false,...value};checkStop(s);const i=t.stops.findIndex(x=>x.id===s.id);i<0?t.stops.push(s):t.stops.splice(i,1,s);clearRoutes(t);return s.id;}
export function reorderStop(d,tripId,id,beforeId){const t=getTrip(d,tripId),i=t?.stops.findIndex(s=>s.id===id);if(i==null||i<0||id===beforeId)return;const [s]=t.stops.splice(i,1);const j=t.stops.findIndex(s=>s.id===beforeId);t.stops.splice(j<0?t.stops.length:j,0,s);clearRoutes(t);}
export const routeKey = (a,b) => JSON.stringify([a.lon,a.lat,b.lon,b.lat,b.mode,Boolean(b.manual)]);
export function saveRoutes(d,tripId,expected,routes){const t=getTrip(d,tripId);if(!t||routePlanKey(t)!==expected)throw Error('Точки изменились во время расчёта. Постройте маршрут заново.');for(const s of t.stops)s.route=routes[s.id];}
export const routePlanKey=t=>JSON.stringify(t.stops.map(s=>[s.id,s.lon,s.lat,s.mode,Boolean(s.manual)]));
export function saveEvent(d,tripId,value){const t=getTrip(d,tripId);if(!t)throw Error('Поездка не найдена');const e={id:randomID(),date:'',time:'',type:'activity',name:'',notes:'',stopId:null,attachments:[],...value};checkEvent(e);const i=t.events.findIndex(x=>x.id===e.id);i<0?t.events.push(e):t.events.splice(i,1,e);return e.id;}
export function tripDays(t){const days=new Set(t.events.map(e=>e.date));if(t.startDate&&t.endDate){let d=new Date(t.startDate+'T12:00:00Z'),end=new Date(t.endDate+'T12:00:00Z');for(let i=0;d<=end&&i<366;i++,d.setUTCDate(d.getUTCDate()+1))days.add(d.toISOString().slice(0,10));}else if(t.startDate)days.add(t.startDate);return [...days].sort();}
function text(v,label){if(typeof v!=='string'||!v.trim()||v.length>500)throw Error('Укажите '+label);}
function unique(rows,label){if(!Array.isArray(rows)||rows.length>10000||rows.some(r=>!r||typeof r.id!=='string'||!r.id)||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Некорректный список: '+label);}
function checkBag(b){const kind=storageKind(b),modelOK=kind==='car'?['trailSuv','vestaSwCross2019'].includes(b.modelType):kind==='box'?b.modelType==='box':Object.hasOwn(BAG_MODELS,b.modelType);if(!['bag','box','car'].includes(kind)||typeof b.nodeId!=='string'||!modelOK||!/^#[\da-f]{6}$/i.test(b.color)||b.capacityLiters!=null&&(!finite(b.capacityLiters)||b.capacityLiters<=0)||kind==='bag'&&b.capacityLiters==null||b.usedLiters!=null&&!nonnegative(b.usedLiters)||b.maxWeightKg!=null&&(!finite(b.maxWeightKg)||b.maxWeightKg<=0)||!Array.isArray(b.items)||b.items.some(id=>typeof id!=='string')||new Set(b.items).size!==b.items.length)throw Error('Проверьте параметры хранилища');}
function checkStop(s){text(s.name,'название точки');if(!finite(s.lat)||Math.abs(s.lat)>85||!finite(s.lon)||Math.abs(s.lon)>180||!Object.hasOwn(MODES,s.mode)||typeof s.manual!=='boolean')throw Error('Некорректная точка маршрута');if(s.route){const r=s.route;if(!Array.isArray(r.coordinates)||r.coordinates.length<2||r.coordinates.length>200000||r.coordinates.some(p=>!Array.isArray(p)||p.length!==2||!finite(p[0])||Math.abs(p[0])>180||!finite(p[1])||Math.abs(p[1])>85)||r.distanceM!=null&&!nonnegative(r.distanceM)||r.durationS!=null&&!nonnegative(r.durationS))throw Error('Некорректный путь');}}
function checkEvent(e){text(e.name,'название события');if(!validDate(e.date)||e.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)||!Object.hasOwn(EVENT_TYPES,e.type)||typeof e.notes!=='string'||!Array.isArray(e.attachments)||e.attachments.length>8||e.attachments.some(a=>!a||typeof a.name!=='string'||typeof a.dataUrl!=='string'||a.dataUrl.length>4000000||!/^data:(application\/pdf|image\/(png|jpeg|webp));base64,[A-Za-z0-9+/=]+$/.test(a.dataUrl)))throw Error('Проверьте событие и вложения');}
function checkTrip(t){text(t.name,'название поездки');if(!validDate(t.startDate)||!validDate(t.endDate)||t.startDate&&t.endDate&&t.endDate<t.startDate||!Number.isInteger(t.participants)||t.participants<1||t.participants>1000||!['planned','active','completed'].includes(t.status)||t.carId!=null&&typeof t.carId!=='string')throw Error('Проверьте даты и участников поездки');unique(t.stops,'точки');unique(t.events,'события');unique(t.bags,'сумки');t.stops.forEach(checkStop);t.events.forEach(checkEvent);t.bags.forEach(checkBag);const ids=t.bags.flatMap(b=>[b.nodeId,...b.items]);if(new Set(ids).size!==ids.length)throw Error('Одна вещь не может находиться в двух сумках одной поездки');}
export function validateTravel(d){if(d.travel==null)return true;const s=d.travel;if(s.version!==1)throw Error('Неизвестная версия поездок');unique(s.trips,'поездки');unique(s.loadouts,'лодауты');s.trips.forEach(checkTrip);for(const l of s.loadouts){text(l.name,'название лодаута');unique(l.bags,'сумки лодаута');l.bags.forEach(checkBag);}return true;}

export function finishTrip(d,id){const t=getTrip(d,id);if(!t)throw Error('Поездка не найдена');t.status='completed';return t;}
