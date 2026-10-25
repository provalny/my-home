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
test('weather includes the city UTC offset and local solar times for seasonal scenery',async()=>{
 const weather={...response,timezone:'Europe/Moscow',utc_offset_seconds:10800,daily:{sunrise:['2026-10-25T07:30'],sunset:['2026-10-25T17:00']}};let url;
 const result=await fetchCurrentWeather(city,async u=>{url=u;return {ok:true,json:async()=>weather};});
 assert.equal(url.searchParams.get('daily'),'sunrise,sunset');assert.equal(result.utcOffsetSeconds,10800);assert.equal(result.timezone,'Europe/Moscow');assert.equal(result.sunrise,'2026-10-25T07:30');assert.equal(result.sunset,'2026-10-25T17:00');
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

function exteriorFixture(){
  const calls=[],flags=new Map(),pending=new Map();let sequence=0,removed=false;
  const makeContext=tag=>{
    const ctx={};for(const method of ['clearRect','setTransform','fillRect','save','restore','beginPath','rect','moveTo','lineTo','closePath','clip','drawImage','arc','fill','ellipse','stroke'])ctx[method]=(...args)=>calls.push([tag,method,...args]);
    for(const method of ['createLinearGradient','createRadialGradient'])ctx[method]=()=>({addColorStop(){}});return ctx;
  };
  const main=makeContext('main'),back=makeContext('back');let created=0;
  const host={prepend(){},getBoundingClientRect:()=>({width:320,height:180}),classList:{toggle:(key,on)=>flags.set(key,on)}};
  const saved={document:globalThis.document,ResizeObserver:globalThis.ResizeObserver,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  globalThis.document={createElement:()=>{const context=created++?back:main;return {setAttribute(){},getContext:()=>context,remove(){removed=true;}};}};
  globalThis.ResizeObserver=class{observe(){}disconnect(){}};
  globalThis.requestAnimationFrame=fn=>{pending.set(++sequence,fn);return sequence;};globalThis.cancelAnimationFrame=id=>pending.delete(id);
  return {host,calls,flags,pending,get removed(){return removed;},restore(){for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}};
}
test('cozy scenery exists without a city and is clipped outside the live apartment mask',async()=>{
  const {createWeatherScene}=await import('./weather-scene.js'),fixture=exteriorFixture();
  try{
    const effect=createWeatherScene(fixture.host,{reducedMotion:true});
    assert.equal(fixture.flags.get('has-environment'),true);assert.ok(fixture.calls.some(c=>c[0]==='main'&&c[1]==='drawImage'));
    fixture.calls.length=0;effect.setMask([[20,20],[300,20],[300,160],[20,160]]);
    const operations=fixture.calls.filter(c=>c[0]==='main').map(c=>c[1]);assert.ok(operations.indexOf('clip')<operations.indexOf('drawImage'));
    assert.ok(fixture.calls.some(c=>c[1]==='clip'&&c[2]==='evenodd'));
    const count=fixture.calls.length;effect.setMask([[20,20],[300,20],[300,160],[20,160]]);assert.equal(fixture.calls.length,count);
    effect.setWeather({day:true,kind:'snow'});assert.equal(fixture.flags.get('has-weather'),true);
    effect.setWeather(null);assert.equal(fixture.flags.get('has-weather'),false);assert.equal(fixture.flags.get('has-environment'),true);
    assert.equal(fixture.pending.size,0);effect.dispose();assert.equal(fixture.flags.get('has-environment'),false);assert.equal(fixture.removed,true);
  }finally{fixture.restore();}
});
test('ambient animation stops while hidden and releases its frame on disposal',async()=>{
  const {createWeatherScene}=await import('./weather-scene.js'),fixture=exteriorFixture();
  try{const effect=createWeatherScene(fixture.host);assert.equal(fixture.pending.size,1);effect.setRunning(false);assert.equal(fixture.pending.size,0);effect.setRunning(true);assert.equal(fixture.pending.size,1);effect.dispose();assert.equal(fixture.pending.size,0);}finally{fixture.restore();}
});
test('outside light follows weather day/night, with a theme fallback before city selection',async()=>{
  const {cozyAtmosphere}=await import('./cozy-exterior.js');
  assert.equal(cozyAtmosphere(null,'light').day,true);assert.equal(cozyAtmosphere(null,'dark').day,false);
  assert.equal(cozyAtmosphere({day:false,kind:'rain'},'light').day,false);
  assert.notDeepEqual(cozyAtmosphere({day:true,kind:'snow'}).sky,cozyAtmosphere({day:false,kind:'snow'}).sky);
});
