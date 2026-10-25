import {call,isNative} from '../bridge.js';
import {isLAN} from '../inventory/lan-client.js';
export {minutesForEvents} from './calendar-model.js';

async function lan(path,body) {
  const response=await fetch('/api/metrics/calendar/'+path,{method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json','X-Life-Assistant':'1'},body:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Не удалось прочитать календари на Mac');
  return result;
}

export async function listCalendars() {
  if(isNative)return (await call('metricsCalendarList')).calendars;
  if(isLAN)return (await lan('list',{})).calendars;
  throw Error('Календари доступны в приложении Life Assistant на Mac; в браузере время можно выбрать карточками');
}

export async function eventsOn(day,calendarIds) {
  if(!calendarIds.length)return [];
  if(isNative)return (await call('metricsCalendarDay',{day,calendarIds})).events;
  if(isLAN)return (await lan('day',{day,calendarIds})).events;
  return [];
}
