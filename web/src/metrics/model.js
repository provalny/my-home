const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SCORE_KEYS = ['mood','energy','tension','productivity'];

export function today(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

export function validDay(value) {
  if (typeof value !== 'string' || !DAY.test(value)) return false;
  const date = new Date(value+'T12:00:00');
  return !Number.isNaN(date.getTime()) && today(date) === value;
}

export function data(doc) {
  return doc.personalMetrics || {version:1,entries:[],health:[],settings:{dailyPrompt:true,skippedOn:null}};
}

export function ensure(doc) {
  doc.personalMetrics ??= {version:1,entries:[],health:[],settings:{dailyPrompt:true,skippedOn:null}};
  return doc.personalMetrics;
}

export const entryOn = (doc, day) => data(doc).entries.find(item => item.date === day) || null;
export const healthOn = (doc, day) => data(doc).health.find(item => item.date === day) || null;
export const recentEntries = (doc, limit = 30) => [...data(doc).entries].sort((a,b) => b.date.localeCompare(a.date)).slice(0,limit);

function score(value) { return value === null || Number.isInteger(value) && value >= 1 && value <= 5; }
function minutes(value) { return value === null || Number.isInteger(value) && value >= 0 && value <= 1440; }
function count(value) { return value === null || Number.isInteger(value) && value >= 0 && value <= 200000; }

export function validateEntry(item) {
  if (!item || !validDay(item.date) || SCORE_KEYS.some(key => !score(item[key] ?? null)) || !minutes(item.busyMinutes ?? null)
      || typeof item.note !== 'string' || item.note.length > 1000
      || typeof item.updatedAt !== 'string' || Number.isNaN(Date.parse(item.updatedAt))) throw Error('Некорректная личная отметка');
  if (SCORE_KEYS.every(key => item[key] == null) && item.busyMinutes == null && !item.note.trim()) throw Error('Выберите хотя бы один ответ или добавьте заметку');
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
      || !section.settings || typeof section.settings.dailyPrompt !== 'boolean'
      || section.settings.skippedOn != null && !validDay(section.settings.skippedOn)) throw Error('Некорректный раздел личных метрик');
  for (const [rows,validate] of [[section.entries,validateEntry],[section.health,validateHealth]]) {
    const dates = new Set();
    for (const row of rows) {
      validate(row);
      if (dates.has(row.date)) throw Error('Повторяющаяся дата личных метрик');
      dates.add(row.date);
    }
  }
  return true;
}

export function putEntry(doc, values, now = new Date()) {
  const section = ensure(doc), previous = section.entries.find(item => item.date === values.date);
  const item = {
    date: values.date,
    mood: values.mood ?? null, energy: values.energy ?? null,
    tension: values.tension ?? null, productivity: values.productivity ?? null,
    busyMinutes: values.busyMinutes ?? null, note: String(values.note ?? '').trim(),
    updatedAt: now.toISOString(),
  };
  validateEntry(item);
  if (previous) Object.assign(previous,item); else section.entries.push(item);
  if (section.settings.skippedOn === item.date) section.settings.skippedOn = null;
  return item;
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
