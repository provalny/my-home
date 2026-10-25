import { data, entryOn, healthOn, weightOn, today, TIME_KEYS } from './model.js';

export const METRICS = ['mood','energy','tension','productivity','busyMinutes','loadScore','rest','sleepMinutes','steps','activityMinutes','weightKg'];

export function dayShift(day, offset) {
  const date=new Date(day+'T12:00:00');
  date.setDate(date.getDate()+offset);
  return today(date);
}

export function valueOn(doc, day, metric) {
  if(metric==='weightKg')return weightOn(doc,day)?.kg ?? null;
  if(['sleepMinutes','steps','activityMinutes'].includes(metric))return healthOn(doc,day)?.[metric] ?? null;
  return entryOn(doc,day)?.[metric] ?? null;
}

export function series(doc, metric, days=7, end=today()) {
  if(!METRICS.includes(metric) || ![7,30].includes(days))throw Error('Некорректный период метрик');
  return Array.from({length:days},(_,i)=>{
    const date=dayShift(end,i-days+1);
    return {date,value:valueOn(doc,date,metric)};
  });
}

function average(values) {
  const known=values.filter(Number.isFinite);
  return known.length?known.reduce((sum,value)=>sum+value,0)/known.length:null;
}

export function summary(doc, days=7, end=today()) {
  const result={days,periodStart:dayShift(end,-days+1),periodEnd:end,metrics:{},time:{},causes:[],recovery:[]};
  for(const key of METRICS){
    const current=seriesRange(doc,key,days,end),previous=seriesRange(doc,key,days,dayShift(end,-days));
    const value=average(current),before=average(previous);
    result.metrics[key]={value,previous:before,count:current.filter(Number.isFinite).length,previousCount:previous.filter(Number.isFinite).length,
      delta:value!=null&&before!=null?value-before:null};
  }
  const entries=data(doc).entries.filter(row=>row.date>=result.periodStart&&row.date<=end);
  for(const key of TIME_KEYS){
    const values=entries.map(row=>row.timeBreakdown?.[key]).filter(Number.isFinite);
    result.time[key]={minutes:values.length?values.reduce((a,b)=>a+b,0):null,count:values.length};
  }
  for(const [field,target] of [['causes','causes'],['recovery','recovery']]){
    const counts=new Map();for(const entry of entries)for(const tag of entry[field]||[])counts.set(tag,(counts.get(tag)||0)+1);
    result[target]=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  }
  return result;
}

function seriesRange(doc,metric,days,end){return Array.from({length:days},(_,i)=>valueOn(doc,dayShift(end,i-days+1),metric));}
