import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weatherKind, fetchCurrentWeather, findWeatherCities, createWeatherService, WEATHER_TTL } from './weather.js';
import { convexHull } from './weather-scene.js';
const city={name:'Тестовый город',latitude:55,longitude:37};
const response={current:{temperature_2m:-2.4,weather_code:73,is_day:0,time:'2026-10-24T12:00'}};
test('weather uses current Celsius data, WMO precipitation and an explicit city',async()=>{
  for(const [code,kind] of [[0,'clear'],[3,'clouds'],[45,'fog'],[65,'rain'],[73,'snow'],[95,'storm']])assert.equal(weatherKind(code),kind);
  let address;const value=await fetchCurrentWeather(city,async url=>{address=url;return {ok:true,json:async()=>response};});
  assert.equal(value.temperature,-2.4);assert.equal(value.kind,'snow');assert.equal(value.day,false);assert.equal(address.searchParams.get('current'),'temperature_2m,weather_code,is_day');
  await assert.rejects(fetchCurrentWeather({...city,latitude:100}),/город/);await assert.rejects(fetchCurrentWeather(city,async()=>({ok:false})),/недоступен/);
  await assert.rejects(fetchCurrentWeather(city,async()=>({ok:true,json:async()=>({current:{}})})),/неполные/);
});
test('city search returns choices rather than silently selecting the first result',async()=>{
  let address;const result=await findWeatherCities('Тест',async url=>{address=url;return {ok:true,json:async()=>({results:[{id:1,name:'Тест',latitude:55,longitude:37,country:'Страна'},{id:2,name:'Тест',latitude:56,longitude:38,country:'Другая страна'}]})};});
  assert.equal(result.length,2);assert.equal(result[1].id,'2');assert.equal(address.searchParams.get('language'),'ru');assert.equal((await findWeatherCities('а')).length,0);
});
test('weather cache deduplicates calls, expires, and retains stale data on an offline error',async()=>{
  let clock=100,calls=0,offline=false;const entries=new Map(),storage={getItem:k=>entries.get(k),setItem:(k,v)=>entries.set(k,v)},service=createWeatherService({storage,now:()=>clock,fetcher:async()=>{calls++;if(offline)throw Error('offline');return {ok:true,json:async()=>response};}});
  await Promise.all([service.current(city),service.current(city)]);assert.equal(calls,1);await service.current(city);assert.equal(calls,1);
  clock+=WEATHER_TTL+1;offline=true;await assert.rejects(service.current(city));assert.equal(service.cached(city).temperature,-2.4);
  const reopened=createWeatherService({storage,now:()=>clock,fetcher:async()=>{throw Error('offline');}});assert.equal(reopened.cached(city).temperature,-2.4);
});
test('weather mask is a convex projected silhouette, excluding interior points and invalid coordinates',()=>{
  const mask=convexHull([[0,0],[10,0],[10,10],[0,10],[4,4],[NaN,2],[0,0]]);assert.deepEqual(mask,[[0,0],[10,0],[10,10],[0,10]]);
});
test('weather can receive cached conditions before the detached scene obtains its first size',async()=>{
  const {createWeatherScene}=await import('./weather-scene.js'),oldDocument=globalThis.document,oldObserver=globalThis.ResizeObserver;
  const canvas={className:'',setAttribute(){},getContext:()=>({clearRect(){},setTransform(){}}),remove(){}},host={prepend(){},getBoundingClientRect:()=>({width:0,height:0}),classList:{toggle(){}}};
  globalThis.document={createElement:()=>canvas};globalThis.ResizeObserver=class{observe(){}disconnect(){}};
  try{const effect=createWeatherScene(host,{reducedMotion:true});assert.doesNotThrow(()=>effect.setWeather({day:true,kind:'clouds'}));effect.dispose();}finally{globalThis.document=oldDocument;globalThis.ResizeObserver=oldObserver;}
});
