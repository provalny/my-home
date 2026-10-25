import {FIELDS,eligible} from './model.js';
import {weightKg,estimatedWeight} from '../inventory/weights.js';

export const MANUAL_KEYS=['officialName','mpn','weightGrams','transportLiters'];
export function manualValue(n,key) {
  if(key==='weightGrams'){
    const kg=weightKg(n);return kg==null||estimatedWeight(n)?'':String(Math.round(kg*1e6)/1000);
  }
  return String(n.fields?.[FIELDS[key]]??'').trim();
}
export function missingFields(n) {
  return MANUAL_KEYS.filter(key=>{
    const value=manualValue(n,key);
    return value===''||key==='transportLiters'&&(!Number.isFinite(Number(value.replace(',','.')))||Number(value.replace(',','.'))<=0);
  });
}
export function manualItems(d,{filter='missing',query=''}={}) {
  const q=query.trim().toLocaleLowerCase('ru');
  return d.nodes.filter(n=>{
    if(!eligible(n)||q&&!n.name.toLocaleLowerCase('ru').includes(q))return false;
    const missing=missingFields(n);
    return filter==='all'||filter==='missing'&&missing.length>0||filter==='empty'&&missing.length===MANUAL_KEYS.length||MANUAL_KEYS.includes(filter)&&missing.includes(filter);
  });
}
function snapshot(n,key) {
  if(key==='weightGrams')return JSON.stringify([n.fields?.['Вес, г']??null,n.fields?.['Вес, кг']??null,n.weightKg??null,n.weightEstimate??null]);
  return JSON.stringify(n.fields?.[FIELDS[key]]??null);
}
function normalize(key,raw) {
  if(!MANUAL_KEYS.includes(key)||typeof raw!=='string')throw Error('Неизвестное поле ручного ввода');
  const value=raw.trim();if(value==='')return '';
  if(['weightGrams','transportLiters'].includes(key)){
    const n=Number(value.replace(',','.'));
    if(!/^\d+(?:[.,]\d+)?$/.test(value)||!Number.isFinite(n)||n>1e9||(key==='transportLiters'?n<=0:n<0))throw Error(`${FIELDS[key]}: введите ${key==='weightGrams'?'неотрицательное':'положительное'} число без единиц измерения`);
    return String(n);
  }
  if(value.length>200)throw Error(`${FIELDS[key]}: максимум 200 символов`);
  return value;
}
export function planManualChanges(n,values) {
  if(!eligible(n))throw Error('Предмет удалён или находится в архиве');
  return Object.entries(values).map(([key,raw])=>({key,before:snapshot(n,key),after:normalize(key,raw)})).filter(p=>p.after!==manualValue(n,p.key));
}
export function applyManualChanges(d,plans) {
  if(!plans.length)throw Error('Введите параметры для сохранения');
  const prepared=[];
  for(const plan of plans){
    const n=d.nodes.find(n=>n.id===plan.id);
    if(!eligible(n))throw Error('Один из предметов удалён или находится в архиве');
    for(const p of plan.fields){
      if(!MANUAL_KEYS.includes(p.key)||p.before!==snapshot(n,p.key))throw Error('Параметры предмета изменились. Сбросьте черновик и введите их заново.');
      const after=normalize(p.key,p.after);if(after!==p.after)throw Error('Некорректное значение параметра');
      prepared.push({n,key:p.key,value:after});
    }
  }
  for(const {n,key,value} of prepared){
    n.fields??={};
    if(value==='')delete n.fields[FIELDS[key]];else n.fields[FIELDS[key]]=value;
    if(key==='weightGrams'){delete n.fields['Вес, кг'];delete n.weightKg;delete n.weightEstimate;}
    if(n.itemResearch?.applied?.[key]){delete n.itemResearch.applied[key];delete n.itemResearch.appliedCandidateId;}
  }
}
