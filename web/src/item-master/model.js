import { weightKg } from '../inventory/weights.js';

export const FIELDS = {officialName:'Официальное название',mpn:'Артикул производителя',weightGrams:'Вес, г',transportLiters:'Транспортный объём, л',name:'Название в каталоге'};
export const eligible = n => Boolean(n && !n.archived && !n.virtual && !n.autoSection && !n.kitchenModule && !n.fridgeChamber && ['item','furniture','box'].includes(n.kind));
export const items = d => d.nodes.filter(eligible);
export const checked = n => Boolean(n.itemResearch?.checkedAt);
export const pending = d => items(d).filter(n => !checked(n));
// Deliberate allowlist: no notes, photographs, location, categories or other fields.
export function searchInput(n) {
  return {name:String(n.name || '').trim().slice(0,200),brand:String(n.fields?.['Бренд'] || n.fields?.['Производитель'] || '').trim().slice(0,100),model:String(n.fields?.['Модель'] || '').trim().slice(0,100)};
}
export const fingerprint = n => JSON.stringify(searchInput(n));
export function safeURL(raw) {
  try {const u=new URL(raw);return u.protocol==='https:' && !u.username && !u.password && (!u.port || u.port==='443') && u.hostname.includes('.') && !/[\[\]:]/.test(u.hostname) && !/^\d+(\.\d+){3}$/.test(u.hostname) && !/\.(local|localhost|internal|test|invalid)$/.test(u.hostname) ? u.href : null;}catch{return null;}
}
function validCandidate(c) {
  if(!c || typeof c.id!=='string' || !c.id || c.id.length>2200 || !safeURL(c.url) || typeof c.title!=='string' || !c.title.trim() || c.title.length>300 || !['manufacturer','store','other'].includes(c.sourceKind) || !c.fields || typeof c.fields!=='object' || Array.isArray(c.fields))return false;
  return Object.entries(c.fields).every(([key,v])=> key!=='name' && Object.hasOwn(FIELDS,key) && v && safeURL(v.source) && typeof v.basis==='string' && v.basis.length<=500 && (['weightGrams','transportLiters'].includes(key)?typeof v.value==='number' && Number.isFinite(v.value) && v.value>0 && v.value<=1e9:typeof v.value==='string' && v.value.trim() && v.value.length<=200));
}
export function validateResearch(d) {
  for(const n of d.nodes || []) {
    const r=n.itemResearch;if(!r)continue;
    if(!['review','not_found'].includes(r.status) || typeof r.checkedAt!=='string' || !Number.isFinite(Date.parse(r.checkedAt)) || typeof r.query!=='string' || r.query.length>500 || !Array.isArray(r.candidates) || r.candidates.length>12 || r.candidates.some(c=>!validCandidate(c)) || new Set(r.candidates.map(c=>c.id)).size!==r.candidates.length || r.chosen!=null && !r.candidates.some(c=>c.id===r.chosen))throw Error('Некорректная история «Мастера предметов»');
  }
}
export function saveResult(d,id,result,expectedFingerprint,at=new Date().toISOString()) {
  const n=d.nodes.find(n=>n.id===id);
  if(!eligible(n))throw Error('Предмет удалён или находится в архиве');
  if(fingerprint(n)!==expectedFingerprint)throw Error('Название или модель изменились во время поиска. Запустите поиск снова.');
  if(!result || !Array.isArray(result.candidates) || result.candidates.length>12 || result.candidates.some(c=>!validCandidate(c)))throw Error('Не удалось проверить найденные сведения');
  n.itemResearch={checkedAt:at,query:Object.values(searchInput(n)).filter(Boolean).join(' '),status:result.candidates.length?'review':'not_found',candidates:structuredClone(result.candidates),chosen:null,warning:String(result.warning||'').slice(0,600)};
  delete n.itemResearchError;
  validateResearch(d);
}
export function saveError(d,id,message) {const n=d.nodes.find(n=>n.id===id);if(n)n.itemResearchError=String(message).slice(0,600);}
export function chooseCandidate(d,id,candidateId) {
  const n=d.nodes.find(n=>n.id===id);if(!eligible(n)||!n.itemResearch?.candidates.some(c=>c.id===candidateId))throw Error('Выберите найденную модель');
  n.itemResearch.chosen=candidateId;
}
export const chosen = n => n.itemResearch?.candidates.find(c=>c.id===n.itemResearch.chosen);
export function currentValue(n,key) {
  if(key==='name')return n.name;
  if(key==='weightGrams'){const kg=weightKg(n);return kg==null?null:Math.round(kg*1e6)/1000;}
  if(key==='transportLiters'){const raw=n.fields?.[FIELDS[key]];return raw==null||raw.trim()===''?null:Number(raw.replace(',','.'));}
  return n.fields?.[FIELDS[key]] || '';
}
export function planChanges(n,keys) {
  const c=chosen(n);if(!eligible(n)||!c)throw Error('Сначала выберите свою модель');
  return [...new Set(keys)].map(key=>{
    if(!Object.hasOwn(FIELDS,key))throw Error('Неизвестное поле');
    const fact=c.fields[key==='name'?'officialName':key];if(!fact)throw Error('Для этого поля нет подтверждённого значения');
    return {key,before:currentValue(n,key),after:fact.value,fact:structuredClone(fact)};
  }).filter(p=>p.before!==p.after);
}
// Compare again at commit time: a modal or a background search cannot overwrite newer edits.
export function applyChanges(d,plans,at=new Date().toISOString()) {
  if(!plans.length)throw Error('Выберите поля для применения');
  for(const plan of plans) {
    const n=d.nodes.find(n=>n.id===plan.id);
    if(!eligible(n) || n.itemResearch?.chosen!==plan.candidateId || n.itemResearch?.checkedAt!==plan.checkedAt)throw Error('Результаты изменились. Откройте сравнение заново.');
    for(const p of plan.fields)if(currentValue(n,p.key)!==p.before || JSON.stringify(planChanges(n,[p.key])[0])!==JSON.stringify(p))throw Error('Карточка изменилась. Откройте сравнение заново.');
  }
  for(const plan of plans) {
    const n=d.nodes.find(n=>n.id===plan.id);n.fields??={};n.itemResearch.applied??={};
    for(const p of plan.fields) {
      if(p.key==='name')n.name=String(p.after);
      else n.fields[FIELDS[p.key]]=String(p.after);
      if(p.key==='weightGrams'){delete n.fields['Вес, кг'];delete n.weightKg;delete n.weightEstimate;}
      n.itemResearch.applied[p.key]={...p.fact,appliedAt:at};
    }
    n.itemResearch.appliedAt=at;
    n.itemResearch.appliedCandidateId=plan.candidateId;
  }
}
