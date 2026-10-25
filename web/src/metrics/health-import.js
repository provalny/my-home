import { validDay } from './model.js';

const TYPES = {
  HKQuantityTypeIdentifierStepCount:'steps',
  HKQuantityTypeIdentifierAppleExerciseTime:'activityMinutes',
  HKCategoryTypeIdentifierSleepAnalysis:'sleepMinutes',
};

function timestamp(raw) {
  const match = /^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d) ([+-]\d\d)(\d\d)$/.exec(raw || '');
  return match ? new Date(`${match[1]}T${match[2]}${match[3]}:${match[4]}`).getTime() : NaN;
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([A-Za-z]+)="([^"]*)"/g)].map(([,key,value]) => [key,value]));
}

function add(rows, date, field, source, value) {
  if (!validDay(date) || !Number.isFinite(value) || value < 0) return;
  const day = rows.get(date) || new Map(), bySource = day.get(field) || new Map();
  bySource.set(source,(bySource.get(source) || 0)+value);
  day.set(field,bySource); rows.set(date,day);
}

function record(rows, tag, since) {
  const a = attributes(tag), field = TYPES[a.type];
  if (!field) return;
  const date = (field === 'sleepMinutes' ? a.endDate : a.startDate)?.slice(0,10);
  if (!validDay(date) || date < since) return;
  const source = a.sourceName || 'Другой источник';
  if (field === 'sleepMinutes') {
    if (!/^HKCategoryValueSleepAnalysisAsleep(?:Core|Deep|REM|Unspecified)?$/.test(a.value || '')) return;
    const value = (timestamp(a.endDate)-timestamp(a.startDate))/60000;
    add(rows,date,field,source,value);
  } else {
    const raw = Number(a.value);
    if (!Number.isFinite(raw)) return;
    const value = field === 'activityMinutes' && a.unit === 'hr' ? raw*60 : raw;
    add(rows,date,field,source,value);
  }
}

export async function parseAppleHealthXML(file, {since} = {}) {
  if (!file || typeof file.stream !== 'function') throw Error('Выберите файл export.xml из экспорта Apple Health');
  if (!/\.xml$/i.test(file.name || '')) throw Error('Распакуйте экспорт Apple Health и выберите файл export.xml');
  const start = since || new Date(Date.now()-365*86400000).toISOString().slice(0,10);
  if (!validDay(start)) throw Error('Некорректное начало периода импорта');
  const rows = new Map(), decoder = new TextDecoder();
  let buffer = '', seen = 0;
  for await (const chunk of file.stream()) {
    buffer += decoder.decode(chunk,{stream:true});
    while (true) {
      const begin = buffer.indexOf('<Record');
      if (begin < 0) { buffer = buffer.slice(-6); break; }
      const end = buffer.indexOf('>',begin);
      if (end < 0) { buffer = buffer.slice(begin); if (buffer.length > 8192) throw Error('Некорректный экспорт Apple Health'); break; }
      record(rows,buffer.slice(begin,end+1),start); seen++;
      buffer = buffer.slice(end+1);
    }
  }
  if (!seen) throw Error('В файле не найдены записи Apple Health');
  return [...rows].sort(([a],[b]) => a.localeCompare(b)).map(([date,fields]) => {
    const best = key => {
      const totals = [...(fields.get(key)?.values() || [])];
      return totals.length ? Math.max(...totals) : null;
    };
    return {
      date,
      sleepMinutes:best('sleepMinutes') == null ? null : Math.min(1440,Math.round(best('sleepMinutes'))),
      steps:best('steps') == null ? null : Math.min(200000,Math.round(best('steps'))),
      activityMinutes:best('activityMinutes') == null ? null : Math.min(1440,Math.round(best('activityMinutes'))),
      source:'apple-health-export',
    };
  }).filter(row => row.sleepMinutes != null || row.steps != null || row.activityMinutes != null);
}
