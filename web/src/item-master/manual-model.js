import {eligible} from './model.js';
import {weightKg,estimatedWeight} from '../inventory/weights.js';
import {CATEGORY_FIELDS,parseMoney,record} from '../inventory/model.js';

const BASE=[
  {key:'name',label:'Название',property:'name',required:true},
  {key:'mpn',label:'Артикул',aliases:['Артикул производителя','Артикул']},
  {key:'color',label:'Цвет',field:'Цвет'},
  {key:'weightGrams',label:'Вес, г',numeric:true},
  {key:'transportLiters',label:'Объём, л',numeric:true,aliases:['Транспортный объём, л','Объём, л']},
  {key:'purchaseCents',label:'Цена, ₽',property:'purchaseCents',money:true},
  {key:'currentCents',label:'Текущая оценка, ₽',property:'currentCents',money:true},
  {key:'brand',label:'Бренд',field:'Бренд'},
  {key:'model',label:'Модель',field:'Модель'},
  {key:'size',label:'Размер',field:'Размер'},
  {key:'material',label:'Материал',field:'Материал'},
];
export const DEFAULT_COLUMNS=['mpn','color','weightGrams','transportLiters','purchaseCents'];
export const MANUAL_KEYS=BASE.map(f=>f.key);
const reserved=new Set(['Официальное название','Вес, г','Вес, кг',...BASE.flatMap(f=>[f.field,...(f.aliases||[])].filter(Boolean))]);
const validField=s=>typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=80&&!/[\u0000-\u001f]/.test(s)&&!['__proto__','constructor','prototype'].includes(s)&&!reserved.has(s);
export function manualField(key) {
  return BASE.find(f=>f.key===key)||(typeof key==='string'&&key.startsWith('attr:')&&validField(key.slice(5))?{key,label:key.slice(5),field:key.slice(5)}:null);
}
export function availableManualFields(d) {
  const names=new Set([...Object.values(CATEGORY_FIELDS).flat(),...d.nodes.flatMap(n=>Object.keys(n.fields||{}))]);
  return [...BASE,...[...names].filter(validField).sort((a,b)=>a.localeCompare(b,'ru')).map(name=>manualField('attr:'+name))];
}
function storageField(n,f){return f.aliases?.find(k=>String(n.fields?.[k]??'').trim()!=='')||f.aliases?.find(k=>n.fields?.[k]!=null)||f.aliases?.[0]||f.field;}
export function manualValue(n,key) {
  const f=manualField(key);if(!f)return '';
  if(key==='weightGrams'){const kg=weightKg(n);return kg==null||estimatedWeight(n)?'':String(Math.round(kg*1e6)/1000);}
  if(f.money)return n[f.property]==null?'':(n[f.property]/100).toFixed(2);
  if(key==='transportLiters'&&!(f.aliases||[]).some(k=>String(n.fields?.[k]??'').trim()))return n.volumeLiters==null?'':String(n.volumeLiters);
  return String(f.property?n[f.property]??'':n.fields?.[storageField(n,f)]??'').trim();
}
export function missingFields(n,columns=DEFAULT_COLUMNS) {
  return columns.filter(key=>{
    if(!manualField(key))return false;const value=manualValue(n,key);
    return value===''||key==='transportLiters'&&(!Number.isFinite(Number(value.replace(',','.')))||Number(value.replace(',','.'))<=0);
  });
}
export function manualItems(d,{filter='missing',query='',columns=DEFAULT_COLUMNS}={}) {
  const q=query.trim().toLocaleLowerCase('ru'),keys=[...new Set(columns)].filter(k=>k!=='name'&&manualField(k));
  return d.nodes.filter(n=>{
    if(!eligible(n)||q&&!n.name.toLocaleLowerCase('ru').includes(q))return false;
    const missing=missingFields(n,keys);
    return filter==='all'||filter==='missing'&&missing.length>0||filter==='empty'&&keys.length>0&&missing.length===keys.length||keys.includes(filter)&&missing.includes(filter);
  });
}
function snapshot(n,key) {
  const f=manualField(key);if(!f)throw Error('Неизвестное поле ручного ввода');
  if(key==='weightGrams')return JSON.stringify([n.fields?.['Вес, г']??null,n.fields?.['Вес, кг']??null,n.weightKg??null,n.weightEstimate??null]);
  if(f.property)return JSON.stringify(n[f.property]??null);
  if(key==='transportLiters')return JSON.stringify([...(f.aliases||[]).map(k=>n.fields?.[k]??null),n.volumeLiters??null]);
  return JSON.stringify((f.aliases||[f.field]).map(k=>n.fields?.[k]??null));
}
function normalize(key,raw) {
  const f=manualField(key);if(!f||typeof raw!=='string')throw Error('Неизвестное поле ручного ввода');
  const value=raw.trim();if(value===''){if(f.required)throw Error('Название не может быть пустым');return '';}
  if(f.money){const cents=parseMoney(value);return (cents/100).toFixed(2);}
  if(f.numeric){
    const n=Number(value.replace(',','.'));
    if(!/^\d+(?:[.,]\d+)?$/.test(value)||!Number.isFinite(n)||n>1e9||(key==='transportLiters'?n<=0:n<0))throw Error(`${f.label}: введите ${key==='weightGrams'?'неотрицательное':'положительное'} число без единиц измерения`);
    return String(n);
  }
  if(value.length>200)throw Error(`${f.label}: максимум 200 символов`);
  return value;
}
export function rebaseManualDraft(base,current,keys) {
  if(!current)return;
  const copy=(target,source,key)=>{if(Object.hasOwn(source||{},key))target[key]=structuredClone(source[key]);else delete target[key];};
  base.fields??={};
  for(const key of keys){
    const f=manualField(key);if(!f)continue;
    if(f.property)copy(base,current,f.property);
    else if(key==='weightGrams'){for(const k of ['Вес, г','Вес, кг'])copy(base.fields,current.fields,k);for(const k of ['weightKg','weightEstimate'])copy(base,current,k);}
    else{for(const k of f.aliases||[f.field])copy(base.fields,current.fields,k);if(key==='transportLiters')copy(base,current,'volumeLiters');}
  }
}
export function planManualChanges(n,values) {
  if(!eligible(n))throw Error('Предмет удалён или находится в архиве');
  return Object.entries(values).map(([key,raw])=>({key,before:snapshot(n,key),after:normalize(key,raw)})).filter(p=>p.after!==manualValue(n,p.key));
}
export function applyManualChanges(d,plans) {
  if(!plans.length)throw Error('Введите параметры для сохранения');
  const prepared=[],prices=new Map();
  for(const plan of plans){
    const n=d.nodes.find(n=>n.id===plan.id);
    if(!eligible(n))throw Error('Один из предметов удалён или находится в архиве');
    for(const p of plan.fields){
      if(!manualField(p.key)||p.before!==snapshot(n,p.key))throw Error('Параметры предмета изменились. Сбросьте черновик и введите их заново.');
      const after=normalize(p.key,p.after);if(after!==p.after)throw Error('Некорректное значение параметра');
      prepared.push({n,key:p.key,value:after});
    }
  }
  for(const {n,key,value} of prepared){
    const f=manualField(key);n.fields??={};
    if(f.money){if(!prices.has(n.id))prices.set(n.id,{n,beforePurchase:n.purchaseCents??null,beforeCurrent:n.currentCents??null});n[f.property]=parseMoney(value);}
    else if(f.property)n[f.property]=value;
    else{const field=key==='weightGrams'?'Вес, г':storageField(n,f);if(value===''){for(const k of f.aliases||[field])delete n.fields[k];}else n.fields[field]=value;}
    if(key==='transportLiters')delete n.volumeLiters;
    if(key==='weightGrams'){delete n.fields['Вес, кг'];delete n.weightKg;delete n.weightEstimate;}
    const appliedKey=key==='name'?'officialName':key;
    if(n.itemResearch?.applied?.[appliedKey]||key==='name'&&n.itemResearch?.applied?.name){delete n.itemResearch.applied[appliedKey];if(key==='name')delete n.itemResearch.applied.name;delete n.itemResearch.appliedCandidateId;}
  }
  if(Array.isArray(d.events))for(const {n,beforePurchase,beforeCurrent} of prices.values())record(d,'value',n,{beforePurchase,beforeCurrent,purchaseCents:n.purchaseCents??null,currentCents:n.currentCents??null});
}
