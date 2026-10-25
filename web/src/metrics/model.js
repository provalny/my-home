const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SCORE_KEYS = ['mood','energy','tension','productivity'];
export const TIME_KEYS = ['work','chores','commute','other'];
export const CAUSE_TAGS = ['work','sleep','health','people','money','other'];
export const RECOVERY_TAGS = ['sleep','walk','exercise','quiet','people','hobby','other'];

export function today(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

export function validDay(value) {
  if (typeof value !== 'string' || !DAY.test(value)) return false;
  const date = new Date(value+'T12:00:00');
  return !Number.isNaN(date.getTime()) && today(date) === value;
}

export function data(doc) {
  return doc.personalMetrics || {version:1,entries:[],health:[],weight:[],settings:{dailyPrompt:true,skippedOn:null,calendarIds:[],calendarMappings:{}}};
}

export function ensure(doc) {
  doc.personalMetrics ??= {version:1,entries:[],health:[],weight:[],settings:{dailyPrompt:true,skippedOn:null,calendarIds:[],calendarMappings:{}}};
  doc.personalMetrics.weight ??= [];
  doc.personalMetrics.settings.calendarIds ??= [];
  doc.personalMetrics.settings.calendarMappings ??= {};
  return doc.personalMetrics;
}

export const entryOn = (doc, day) => data(doc).entries.find(item => item.date === day) || null;
export const healthOn = (doc, day) => data(doc).health.find(item => item.date === day) || null;
export const weightOn = (doc, day) => (data(doc).weight || []).find(item => item.date === day) || null;
export const recentEntries = (doc, limit = 30) => [...data(doc).entries].sort((a,b) => b.date.localeCompare(a.date)).slice(0,limit);

function score(value) { return value === null || Number.isInteger(value) && value >= 1 && value <= 5; }
function minutes(value) { return value === null || Number.isInteger(value) && value >= 0 && value <= 1440; }
function count(value) { return value === null || Number.isInteger(value) && value >= 0 && value <= 200000; }
function tags(value, allowed) { return value == null || Array.isArray(value) && value.length <= allowed.length && new Set(value).size === value.length && value.every(tag => allowed.includes(tag)); }
function timeBreakdown(value) {
  return value == null || typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => TIME_KEYS.includes(key))
    && TIME_KEYS.every(key => minutes(value[key] ?? null))
    && TIME_KEYS.reduce((sum,key) => sum+(value[key] ?? 0),0) <= 1440;
}

export function validateEntry(item) {
  if (!item || !validDay(item.date) || SCORE_KEYS.some(key => !score(item[key] ?? null)) || !minutes(item.busyMinutes ?? null)
      || !score(item.rest ?? null) || !score(item.loadScore ?? null) || !timeBreakdown(item.timeBreakdown)
      || item.timeBreakdown != null && TIME_KEYS.some(key=>item.timeBreakdown[key]!=null)
        && item.busyMinutes !== TIME_KEYS.reduce((sum,key)=>sum+(item.timeBreakdown[key]??0),0)
      || !tags(item.causes,CAUSE_TAGS) || !tags(item.recovery,RECOVERY_TAGS)
      || item.timeSource != null && !['survey','calendar'].includes(item.timeSource)
      || typeof item.note !== 'string' || item.note.length > 1000
      || typeof item.updatedAt !== 'string' || Number.isNaN(Date.parse(item.updatedAt))) throw Error('Некорректная личная отметка');
  if (SCORE_KEYS.every(key => item[key] == null) && item.busyMinutes == null && item.rest == null && item.loadScore == null && !item.note.trim()) throw Error('Выберите хотя бы один ответ или добавьте заметку');
  return true;
}

export function validateHealth(item) {
  if (!item || !validDay(item.date) || !minutes(item.sleepMinutes ?? null) || !count(item.steps ?? null)
      || !minutes(item.activityMinutes ?? null) || !['apple-health-export','manual'].includes(item.source)
      || typeof item.updatedAt !== 'string' || Number.isNaN(Date.parse(item.updatedAt))) throw Error('Некорректные данные Apple Health');
  if (item.sleepMinutes == null && item.steps == null && item.activityMinutes == null) throw Error('Нет данных сна или активности');
  return true;
}

export function validatePersonalMetrics(doc) {
  const section = doc.personalMetrics;
  if (section == null) return true;
  if (section.version !== 1 || !Array.isArray(section.entries) || !Array.isArray(section.health)
      || section.entries.length > 3660 || section.health.length > 3660
      || section.weight != null && (!Array.isArray(section.weight) || section.weight.length > 3660)
      || !section.settings || typeof section.settings.dailyPrompt !== 'boolean'
      || section.settings.calendarIds != null && (!Array.isArray(section.settings.calendarIds) || section.settings.calendarIds.length > 30 || new Set(section.settings.calendarIds).size !== section.settings.calendarIds.length || section.settings.calendarIds.some(id => typeof id !== 'string' || !id || id.length > 180))
      || section.settings.calendarMappings != null && (typeof section.settings.calendarMappings !== 'object' || Array.isArray(section.settings.calendarMappings) || Object.keys(section.settings.calendarMappings).length > 30 || Object.entries(section.settings.calendarMappings).some(([id,key]) => !id || id.length > 180 || !TIME_KEYS.includes(key)))
      || section.settings.skippedOn != null && !validDay(section.settings.skippedOn)) throw Error('Некорректный раздел личных метрик');
  for (const [rows,validate] of [[section.entries,validateEntry],[section.health,validateHealth]]) {
    const dates = new Set();
    for (const row of rows) {
      validate(row);
      if (dates.has(row.date)) throw Error('Повторяющаяся дата личных метрик');
      dates.add(row.date);
    }
  }
  const weightDates = new Set();
  for (const row of section.weight || []) {
    if (!validDay(row?.date) || !Number.isFinite(row.kg) || row.kg < 1 || row.kg > 500 || Math.round(row.kg*10) !== row.kg*10
        || typeof row.updatedAt !== 'string' || Number.isNaN(Date.parse(row.updatedAt)) || weightDates.has(row.date)) throw Error('Некорректная запись массы тела');
    weightDates.add(row.date);
  }
  return true;
}

export function putEntry(doc, values, now = new Date()) {
  const section = ensure(doc), previous = section.entries.find(item => item.date === values.date);
  const breakdown=values.timeBreakdown==null?null:Object.fromEntries(TIME_KEYS.map(key=>[key,values.timeBreakdown[key]??null]));
  const item = {
    date: values.date,
    mood: values.mood ?? null, energy: values.energy ?? null,
    tension: values.tension ?? null, productivity: values.productivity ?? null,
    busyMinutes: breakdown&&TIME_KEYS.some(key=>breakdown[key]!=null)?TIME_KEYS.reduce((sum,key)=>sum+(breakdown[key]??0),0):values.busyMinutes ?? null,
    timeBreakdown:breakdown, timeSource:values.timeSource||null,
    rest:values.rest??null, loadScore:values.loadScore??null, causes:[...(values.causes||[])], recovery:[...(values.recovery||[])],
    note: String(values.note ?? '').trim(),
    updatedAt: now.toISOString(),
  };
  validateEntry(item);
  if (previous) Object.assign(previous,item); else section.entries.push(item);
  if (section.settings.skippedOn === item.date) section.settings.skippedOn = null;
  return item;
}

export function putWeight(doc, values, now = new Date()) {
  const section=ensure(doc), item={date:values.date,kg:Number(values.kg),updatedAt:now.toISOString()};
  if (!validDay(item.date) || !Number.isFinite(item.kg) || item.kg < 1 || item.kg > 500 || Math.round(item.kg*10) !== item.kg*10) throw Error('Массу тела укажите в кг с точностью до 0,1');
  const previous=section.weight.find(row=>row.date===item.date);
  if(previous)Object.assign(previous,item);else section.weight.push(item);
  return item;
}

export function removeWeight(doc, day) {
  const section=ensure(doc);
  section.weight=section.weight.filter(row=>row.date!==day);
}

export function removeEntry(doc, day) {
  const section = ensure(doc);
  section.entries = section.entries.filter(item => item.date !== day);
}

export function skipPrompt(doc, day) {
  if (!validDay(day)) throw Error('Некорректная дата');
  ensure(doc).settings.skippedOn = day;
}

export function putHealth(doc, values, now = new Date()) {
  const section = ensure(doc), previous = section.health.find(item => item.date === values.date);
  const item = {
    date:values.date, sleepMinutes:values.sleepMinutes ?? null,
    steps:values.steps ?? null, activityMinutes:values.activityMinutes ?? null,
    source:values.source || 'manual', updatedAt:now.toISOString(),
  };
  validateHealth(item);
  if (previous) Object.assign(previous,item); else section.health.push(item);
  return item;
}

export function removeHealth(doc, day) {
  const section = ensure(doc);
  section.health = section.health.filter(item => item.date !== day);
}

export const moodLabel = value => ({1:'Очень тяжело',2:'Не очень',3:'Нейтрально',4:'Хорошо',5:'Отлично'})[value] || '—';
export const hoursLabel = value => value == null ? '—' : `${Math.floor(value/60)} ч${value%60 ? ' '+String(value%60).padStart(2,'0')+' мин' : ''}`;
