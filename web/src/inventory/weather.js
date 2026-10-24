const FORECAST='https://api.open-meteo.com/v1/forecast';
const GEOCODING='https://geocoding-api.open-meteo.com/v1/search';
export const WEATHER_TTL=15*60*1000;
export function weatherKind(code){return [95,96,99].includes(code)?'storm':[71,73,75,77,85,86].includes(code)?'snow':[51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)?'rain':[45,48].includes(code)?'fog':[1,2,3].includes(code)?'clouds':'clear';}
export function weatherDescription(code){return {storm:'Гроза',snow:'Снег',rain:'Дождь',fog:'Туман',clouds:'Облачно',clear:'Ясно'}[weatherKind(code)];}
async function request(url,fetcher){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);try{const response=await fetcher(url,{signal:controller.signal});if(!response.ok)throw Error('Сервис погоды недоступен');const data=await response.json();if(data.error)throw Error('Не удалось получить погоду');return data;}finally{clearTimeout(timer);}}
export async function findWeatherCities(name,fetcher=fetch){
  const query=name.trim();if(query.length<2)return [];
  const url=new URL(GEOCODING);url.search=new URLSearchParams({name:query,count:'8',language:'ru',format:'json'});
  const data=await request(url,fetcher);
  return (data.results||[]).filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)).map(c=>({id:String(c.id),name:c.name,label:[...new Set([c.name,c.admin1,c.country].filter(Boolean))].join(', '),latitude:c.latitude,longitude:c.longitude}));
}
export function validWeatherCity(city){return Boolean(city&&typeof city.name==='string'&&city.name.trim()&&Number.isFinite(city.latitude)&&Math.abs(city.latitude)<=90&&Number.isFinite(city.longitude)&&Math.abs(city.longitude)<=180);}
export async function fetchCurrentWeather(city,fetcher=fetch){
  if(!validWeatherCity(city))throw Error('Выберите город для погоды');
  const url=new URL(FORECAST);url.search=new URLSearchParams({latitude:String(city.latitude),longitude:String(city.longitude),current:'temperature_2m,weather_code,is_day',timezone:'auto',forecast_days:'1'});
  const {current}=await request(url,fetcher);
  if(!current||!Number.isFinite(current.temperature_2m)||!Number.isInteger(current.weather_code))throw Error('Сервис вернул неполные данные погоды');
  return {temperature:current.temperature_2m,code:current.weather_code,day:current.is_day===1,time:current.time,fetchedAt:Date.now(),kind:weatherKind(current.weather_code)};
}
// Bounded device cache and shared in-flight requests avoid calls on every scene redraw.
export function createWeatherService({fetcher=fetch,storage=null,now=()=>Date.now()}={}){
  const pending=new Map(),cache=new Map();
  const key=c=>c.latitude.toFixed(3)+','+c.longitude.toFixed(3);
  function cached(city){const k=key(city);if(!cache.has(k)){try{const raw=JSON.parse(storage?.getItem('iv:weather:'+k)||'null');if(raw&&Number.isFinite(raw.temperature)&&Number.isFinite(raw.fetchedAt)&&Number.isInteger(raw.code))cache.set(k,raw);}catch{}}return cache.get(k)||null;}
  return {cached,async current(city,{refresh=false}={}){const k=key(city),old=cached(city);if(!refresh&&old&&now()-old.fetchedAt<WEATHER_TTL)return old;if(pending.has(k))return pending.get(k);
    const work=fetchCurrentWeather(city,fetcher).then(value=>{value.fetchedAt=now();cache.set(k,value);if(cache.size>20)cache.delete(cache.keys().next().value);try{storage?.setItem('iv:weather:'+k,JSON.stringify(value));}catch{}return value;}).finally(()=>pending.delete(k));pending.set(k,work);return work;
  }};
}
