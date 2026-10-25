import { randomID } from '../uuid.js';

// Independent ledger. Only planSpaceId points to the existing apartment drawing.
export const SERVICE_ICONS = [['plug','Электричество'],['dry','Вода'],['heat','Газ / отопление'],['home','Жильё'],['globe','Интернет'],['phone','Связь'],['tv','ТВ'],['shield','Охрана'],['car','Парковка'],['tools','Работы'],['thermo','Температура'],['activity','Другое']];
export const TASK_KINDS = [['maintenance','Обслуживание'],['repair','Ремонт'],['verification','Поверка счётчика'],['reading','Внести показания'],['submission','Передать показания'],['payment','Оплата']];
export const ZONES = {single:[['total','Общий']],dual:[['day','День'],['night','Ночь']],triple:[['peak','Пик'],['half','Полупик'],['night','Ночь']]};
const templates = [
  ['Электроэнергия','plug','#f4b65a','кВт·ч','meter'],['Холодная вода','dry','#60a5fa','м³','meter'],['Горячая вода','dry','#f48b6b','м³','meter'],
  ['Водоотведение','dry','#70c8cf','м³','consumption'],['Отопление','heat','#f07880','Гкал','consumption'],['Содержание жилья','home','#a69bf5','м²','fixed'],
  ['Капремонт','tools','#ac9bdf','м²','fixed'],['Вывоз мусора','trash','#7bb8a2','мес.','fixed'],['Интернет','globe','#b58af2','мес.','fixed'],
  ['Газ','heat','#ee9866','м³','meter'],['Мобильная связь','phone','#a98ce9','мес.','fixed'],['Телевидение','tv','#8d9de5','мес.','fixed'],
  ['Охрана','shield','#81baa8','мес.','fixed'],['Парковка','car','#a0b2c7','мес.','fixed'],
];
export const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const monthOf = date => date.slice(0,7);
export const monthShift = (month,by) => {const [y,m]=month.split('-').map(Number),d=new Date(y,m-1+by,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};
export function monthDay(month,day){const [y,m]=month.split('-').map(Number);return `${month}-${String(Math.min(day,new Date(y,m,0).getDate())).padStart(2,'0')}`;}
export const monthEnd = month => monthDay(month,31);
export const monthLabel = month => new Date(month+'-01T12:00:00').toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
export const formatDate = date => date?new Date(date.slice(0,10)+'T12:00:00').toLocaleDateString('ru-RU'):'—';
export const money = cents => cents==null?'—':new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:cents%100?2:0}).format(cents/100);
export const number = value => value==null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:6}).format(value);
export function decimal(raw,{signed=false,optional=true}={}){const s=String(raw??'').trim().replace(/\s/g,'').replace(',','.');if(!s&&optional)return null;if(!(signed?/^-?\d+(\.\d{1,6})?$/:/^\d+(\.\d{1,6})?$/).test(s)||!Number.isFinite(Number(s))||Math.abs(Number(s))>1e10)throw Error('Укажите число, до 6 знаков после запятой');return Number(s);}
export function cents(raw,{signed=false,optional=true}={}){const s=String(raw??'').trim().replace(/\s/g,'').replace(',','.');if(!s&&optional)return null;if(!(signed?/^-?\d+(\.\d{1,2})?$/:/^\d+(\.\d{1,2})?$/).test(s))throw Error('Укажите сумму в рублях, не более 2 знаков после запятой');const negative=s.startsWith('-'),[whole,fraction='']=s.replace('-','').split('.'),v=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(!Number.isSafeInteger(v)||v>1e12)throw Error('Слишком большая сумма');return negative?-v:v;}
export const rawMoney = value => value==null?'':(value/100).toFixed(2);
export function createApartment({name,planSpaceId=null,address=''}){return {id:randomID(),name:name.trim(),address,planSpaceId,services:templates.map(([name,glyph,color,unit,mode])=>({id:randomID(),name,glyph,color,unit,mode,provider:'',account:'',note:'',openingCents:0,archived:false})),meters:[],readings:[],consumption:[],tariffs:[],bills:[],payments:[],climate:[],tasks:[],rules:[],completions:[],settings:{remindersEnabled:true,leadDays:3}};}
export function apartments(doc){return doc.monitoring?.apartments||[];}
export const getApartment = (doc,id) => apartments(doc).find(a=>a.id===id);
export function addApartment(doc,options){doc.monitoring??={version:1,apartments:[]};const a=createApartment(options);doc.monitoring.apartments.push(a);return a.id;}
export function put(a,key,value){const entry={...value,id:value.id||randomID()},i=a[key].findIndex(v=>v.id===entry.id);if(i<0)a[key].push(entry);else a[key][i]=entry;return entry.id;}
export function remove(a,key,id){
  if(key==='services'&&['meters','readings','consumption','tariffs','bills','rules','tasks'].some(k=>a[k].some(r=>r.serviceId===id)))throw Error('У услуги есть записи. Скройте её из активного списка, чтобы сохранить историю.');
  if(key==='meters'&&a.readings.some(r=>r.meterId===id))throw Error('У счётчика есть показания. Укажите дату снятия вместо удаления.');
  if(key==='bills'&&a.payments.some(p=>p.billId===id))throw Error('Сначала удалите платежи этого счёта.');
  a[key]=a[key].filter(v=>v.id!==id);
  if(key==='rules')a.completions=a.completions.filter(v=>v.ruleId!==id);
}
export const billCharge = b => b.amountCents+b.adjustmentCents;
export function billPaid(a,bill,through='9999-12-31'){return a.payments.filter(p=>p.billId===bill.id&&p.date<=through).reduce((v,p)=>v+p.amountCents,0);}
export const billBalance = (a,b,through) => billCharge(b)-billPaid(a,b,through);
const sum = (rows,fn) => rows.length?rows.reduce((v,r)=>v+fn(r),0):null;
export function summary(a,from,to=from){const bills=a.bills.filter(b=>b.period>=from&&b.period<=to),end=monthEnd(to),payments=a.payments.filter(p=>p.date>=from+'-01'&&p.date<=end),history=a.bills.filter(b=>b.period<=to),balance=a.services.reduce((v,s)=>v+(s.openingCents||0),0)+history.reduce((v,b)=>v+billCharge(b),0)-a.payments.filter(p=>p.date<=end).reduce((v,p)=>v+p.amountCents,0);return {charged:sum(bills,billCharge),paid:sum(payments,p=>p.amountCents),balance,unpaid:bills.filter(b=>billBalance(a,b)>0).length,bills:bills.length};}
export function consumptionFor(a,serviceId,from,to=from){return sum(a.consumption.filter(r=>r.serviceId===serviceId&&r.period>=from&&r.period<=to),r=>r.amount);}
export function serviceSummary(a,id,period){const bills=a.bills.filter(b=>b.serviceId===id&&b.period===period);return {charged:sum(bills,billCharge),consumption:consumptionFor(a,id,period),bills};}
export function changePercent(current,previous){return current==null||previous==null||previous===0?null:Math.round((current-previous)/Math.abs(previous)*100);}
export function reminders(a,now=today(),horizon=40){
  const end=new Date(now+'T12:00:00');end.setDate(end.getDate()+horizon);const until=`${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`,out=[];
  for(const task of a.tasks)if(!task.completedAt&&task.dueDate<=until)out.push({id:'task:'+task.id,name:task.name,date:task.dueDate,kind:task.kind,taskId:task.id,serviceId:task.serviceId});
  for(const meter of a.meters)if(!meter.retiredAt&&meter.verificationDate&&meter.verificationDate<=until)out.push({id:'meter:'+meter.id,name:'Поверка: '+meter.name,date:meter.verificationDate,kind:'verification',meterId:meter.id,serviceId:meter.serviceId});
  for(const bill of a.bills)if(bill.dueDate&&bill.dueDate<=until&&billBalance(a,bill)>0)out.push({id:'bill:'+bill.id,name:'Оплата: '+(a.services.find(s=>s.id===bill.serviceId)?.name||'Счёт'),date:bill.dueDate,kind:'payment',billId:bill.id,amountCents:billBalance(a,bill),serviceId:bill.serviceId});
  for(const rule of a.rules.filter(r=>r.enabled))for(let i=0;i<=Math.ceil(horizon/28);i++){
    const date=monthDay(monthShift(monthOf(now),i),rule.day);if(date>until||a.completions.some(c=>c.ruleId===rule.id&&c.date===date))continue;
    out.push({id:`rule:${rule.id}:${date}`,name:rule.name,date,kind:rule.kind,ruleId:rule.id,serviceId:rule.serviceId});
  }
  return out.sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name,'ru'));
}
export function completeReminder(a,reminder,date=today()){
  if(reminder.taskId){const task=a.tasks.find(t=>t.id===reminder.taskId);if(task)task.completedAt=date;}
  else if(reminder.ruleId&&!a.completions.some(c=>c.ruleId===reminder.ruleId&&c.date===reminder.date))a.completions.push({id:randomID(),ruleId:reminder.ruleId,date:reminder.date});
}
const validDate = s => typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const validMonth = s => typeof s==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(s);
function must(condition,message){if(!condition)throw Error('Мониторинг: '+message);}
function text(value,max=300,required=false){return typeof value==='string'&&value.length<=max&&(!required||value.trim().length>0);}
const moneyOK=(v,signed=false)=>Number.isSafeInteger(v)&&Math.abs(v)<=1e12&&(signed||v>=0);
const numberOK=(v,signed=false)=>Number.isFinite(v)&&Math.abs(v)<=1e10&&(signed||v>=0);
export function validateMonitoring(doc){
  const data=doc.monitoring;if(data==null)return;
  must(data.version===1&&Array.isArray(data.apartments)&&data.apartments.length<=100,'некорректный список квартир');
  const ids=new Set();let attachmentBytes=0;
  const id=v=>{must(text(v,150,true)&&!ids.has(v),'повторяющийся или пустой идентификатор');ids.add(v);};
  const date=(v,optional=false)=>must(optional&&(v==null||v==='')||validDate(v),'некорректная дата');
  for(const a of data.apartments){
    id(a.id);must(text(a.name,200,true)&&text(a.address,1000)&&(!a.planSpaceId||text(a.planSpaceId,150,true)),'укажите название квартиры');
    for(const k of ['services','meters','readings','consumption','tariffs','bills','payments','climate','tasks','rules','completions']){must(Array.isArray(a[k])&&a[k].length<=100000,'слишком много записей или некорректный список');for(const r of a[k]){must(r&&typeof r==='object','некорректная запись');id(r.id);}}
    const services=new Map(a.services.map(s=>[s.id,s])),meters=new Map(a.meters.map(s=>[s.id,s])),bills=new Map(a.bills.map(s=>[s.id,s])),rules=new Map(a.rules.map(s=>[s.id,s]));
    const service=(r,optional=false)=>must(optional&&!r.serviceId||services.has(r.serviceId),'услуга не найдена');
    for(const s of a.services)must(text(s.name,200,true)&&text(s.unit,30,true)&&text(s.glyph,40,true)&&/^#[0-9a-f]{6}$/i.test(s.color)&&['meter','consumption','fixed'].includes(s.mode)&&text(s.provider,500)&&text(s.account,200)&&text(s.note,5000)&&moneyOK(s.openingCents,true)&&typeof s.archived==='boolean','некорректная услуга');
    for(const m of a.meters){service(m);must(text(m.name,200,true)&&text(m.serial,200)&&ZONES[m.scheme],'некорректный счётчик');date(m.installedAt,true);date(m.retiredAt,true);date(m.verificationDate,true);must(!m.installedAt||!m.retiredAt||m.retiredAt>=m.installedAt,'дата снятия раньше установки');}
    for(const r of a.readings){service(r);date(r.date);const meter=meters.get(r.meterId);must(meter&&meter.serviceId===r.serviceId,'счётчик не найден');must(r.values&&Object.keys(r.values).length===ZONES[meter.scheme].length&&ZONES[meter.scheme].every(([key])=>numberOK(r.values[key])),'проверьте показания всех зон');must((!meter.installedAt||r.date>=meter.installedAt)&&(!meter.retiredAt||r.date<=meter.retiredAt),'показания вне периода работы счётчика');must(text(r.note,5000),'слишком длинная заметка');}
    for(const r of a.consumption){service(r);date(r.date);must(validMonth(r.period)&&numberOK(r.amount)&&text(r.note,5000),'некорректный расход');}
    for(const r of a.tariffs){service(r);date(r.date);must(text(r.name,200,true)&&['total','day','night','peak','half','fixed'].includes(r.zone)&&moneyOK(r.rateCents)&&text(r.note,5000),'некорректный тариф');}
    for(const b of a.bills){service(b);date(b.date);date(b.dueDate,true);must(validMonth(b.period)&&moneyOK(b.amountCents)&&moneyOK(b.adjustmentCents,true)&&text(b.note,5000)&&Array.isArray(b.attachments)&&b.attachments.length<=8,'некорректный счёт');for(const f of b.attachments){id(f.id);must(text(f.name,300,true)&&typeof f.data==='string'&&/^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/]+=*$/.test(f.data)&&f.data.length<=3000000,'некорректное вложение (JPG, PNG, WebP или PDF, до 2 МБ)');attachmentBytes+=f.data.length;}}
    must(attachmentBytes<=50000000,'вложения занимают слишком много места');
    for(const p of a.payments){date(p.date);must(bills.has(p.billId)&&moneyOK(p.amountCents)&&p.amountCents>0&&text(p.note,5000),'некорректная оплата');}
    for(const c of a.climate){date(c.date);must((c.temperature!=null||c.humidity!=null)&&(c.temperature==null||numberOK(c.temperature,true)&&c.temperature>=-60&&c.temperature<=80)&&(c.humidity==null||numberOK(c.humidity)&&c.humidity<=100)&&text(c.note,5000),'проверьте температуру и влажность');}
    for(const t of a.tasks){service(t,true);date(t.dueDate);date(t.completedAt,true);must(text(t.name,200,true)&&TASK_KINDS.some(([key])=>key===t.kind)&&text(t.note,5000)&&(t.costCents==null||moneyOK(t.costCents)),'некорректная работа');}
    for(const r of a.rules){service(r,true);must(text(r.name,200,true)&&TASK_KINDS.some(([key])=>key===r.kind)&&Number.isInteger(r.day)&&r.day>=1&&r.day<=31&&typeof r.enabled==='boolean','проверьте ежемесячное напоминание');}
    const occurrences=new Set();for(const c of a.completions){date(c.date);must(rules.has(c.ruleId)&&!occurrences.has(c.ruleId+':'+c.date),'некорректное выполнение напоминания');occurrences.add(c.ruleId+':'+c.date);}
    must(a.settings&&typeof a.settings.remindersEnabled==='boolean'&&Number.isInteger(a.settings.leadDays)&&a.settings.leadDays>=0&&a.settings.leadDays<=365,'проверьте настройки напоминаний');
    const amounts=[...a.services.map(s=>s.openingCents),...a.bills.flatMap(b=>[b.amountCents,b.adjustmentCents]),...a.payments.map(p=>p.amountCents)];
    must(Number.isSafeInteger(amounts.reduce((total,v)=>total+Math.abs(v),0)),'общая сумма превышает допустимую точность');
  }
}
