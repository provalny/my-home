import { routeKey } from './model.js';
import {isShowcase} from '../inventory/demo-runtime.js';
const showcaseMaps=new Map();

export const DEFAULT_SERVICES={search:'https://photon.komoot.io/api/',routing:'https://routing.openstreetmap.de',overpass:'https://overpass-api.de/api/interpreter',tiles:'https://tile.openstreetmap.org/{z}/{x}/{y}.png'};
let queue=Promise.resolve(),lastRequest=0;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(url,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.timeout||45000);
  const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
  try{const r=await fetch(url,{...options,signal:controller.signal});if(!r.ok)throw Error('Сервис карты ответил '+r.status);return await r.json();}
  catch(e){if(e.name==='AbortError')throw Error('Запрос карты отменён или превысил время ожидания');throw new Error(e.message||'Сервис карты недоступен');}
  finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}
function limited(fn){const run=queue.catch(()=>{}).then(async()=>{await delay(Math.max(0,1100-(Date.now()-lastRequest)));lastRequest=Date.now();return fn();});queue=run;return run;}
export function endpoints(custom={}){return {...DEFAULT_SERVICES,...custom};}
export function validateEndpoint(value,{tiles=false}={}){const u=new URL(value);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('Адрес сервиса должен использовать HTTPS');if(tiles&&!['{z}','{x}','{y}'].every(k=>value.includes(k)))throw Error('В адресе плиток нужны {z}, {x}, {y}');return value;}
export async function searchPlaces(query,services={},signal){
  const q=query.trim();if(q.length<2)throw Error('Введите хотя бы два символа');const key='iv:travel-search:'+JSON.stringify([endpoints(services).search,q.toLowerCase()]);
  try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&Date.now()-saved.at<7*86400000)return saved.rows;}catch{}
  const u=new URL(endpoints(services).search);u.searchParams.set('q',q);u.searchParams.set('limit','6');
  const data=await limited(()=>request(u,{signal}));
  const rows=(data.features||[]).filter(f=>f.geometry?.type==='Point'&&f.geometry.coordinates.every(Number.isFinite)).map(f=>({lon:f.geometry.coordinates[0],lat:f.geometry.coordinates[1],name:f.properties?.name||f.properties?.street||q,description:[f.properties?.city,f.properties?.state,f.properties?.country].filter(Boolean).join(', ')}));
  try{localStorage.setItem(key,JSON.stringify({at:Date.now(),rows}));}catch{}return rows;
}
export function haversine(a,b){const r=Math.PI/180,p1=a.lat*r,p2=b.lat*r,dl=(b.lon-a.lon)*r,dp=(b.lat-a.lat)*r;return 6371000*2*Math.atan2(Math.sqrt(Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2),Math.sqrt(1-(Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2)));}
export async function calculateRoutes(trip,services={},onProgress=()=>{},signal){
  const result={};for(let i=1;i<trip.stops.length;i++){
    if(signal?.aborted)throw Error('Расчёт отменён');const a=trip.stops[i-1],b=trip.stops[i],signature=routeKey(a,b);onProgress(i,trip.stops.length-1);
    if(b.route?.signature===signature){result[b.id]=b.route;continue;}
    if(b.manual||['manual','train','plane'].includes(b.mode)){result[b.id]={coordinates:[[a.lon,a.lat],[b.lon,b.lat]],distanceM:haversine(a,b),durationS:null,manual:true,signature};continue;}
    const profile={car:'car',foot:'foot',bike:'bike'}[b.mode],base=endpoints(services).routing.replace(/\/$/,'');
    const url=`${base}/routed-${profile}/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson&steps=false`;
    const data=await limited(()=>request(url,{signal})),route=data.routes?.[0];
    if(data.code!=='Ok'||!route?.geometry?.coordinates?.length)throw Error('Путь не найден: '+a.name+' → '+b.name+'. Можно задать этот участок вручную.');
    result[b.id]={coordinates:route.geometry.coordinates,distanceM:route.distance,durationS:route.duration,manual:false,signature};
  }return result;
}

function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('life-assistant-trip-maps',1);r.onupgradeneeded=()=>r.result.createObjectStore('maps',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function readMap(id){if(isShowcase)return showcaseMaps.get(id)||null;const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('maps').objectStore('maps').get(id);r.onsuccess=()=>{db.close();resolve(r.result||null);};r.onerror=()=>{db.close();reject(r.error);};});}
export async function writeMap(value){if(isShowcase){showcaseMaps.set(value.id,value);return value;}const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('maps','readwrite');tx.objectStore('maps').put(value);tx.oncomplete=()=>{db.close();resolve(value);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error||Error('Карту не удалось сохранить'));};});}
export async function deleteMap(id){if(isShowcase){showcaseMaps.delete(id);return;}const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('maps','readwrite');tx.objectStore('maps').delete(id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
export function overpassFeatures(data){
  if(data.remark)throw Error('Сервис не смог отдать полную область: '+data.remark);
  const features=[];for(const el of data.elements||[]){
    const properties={...el.tags,osmId:`${el.type}/${el.id}`};
    if(el.type==='node'&&Number.isFinite(el.lon)&&Number.isFinite(el.lat)){features.push({type:'Feature',properties,geometry:{type:'Point',coordinates:[el.lon,el.lat]}});continue;}
    if(!Array.isArray(el.geometry)||el.geometry.length<2)continue;
    const coordinates=el.geometry.filter(p=>Number.isFinite(p.lon)&&Number.isFinite(p.lat)).map(p=>[p.lon,p.lat]);if(coordinates.length<2)continue;
    const closed=coordinates.length>3&&coordinates[0][0]===coordinates.at(-1)[0]&&coordinates[0][1]===coordinates.at(-1)[1],area=closed&&!properties.highway&&!properties.waterway;
    features.push({type:'Feature',properties,geometry:{type:area?'Polygon':'LineString',coordinates:area?[coordinates]:coordinates}});
  }return {type:'FeatureCollection',features};
}
export async function downloadArea(id,bounds,services={},signal){
  const [south,west,north,east]=bounds;if(!bounds.every(Number.isFinite)||north<=south||east<=west)throw Error('Некорректная область карты');
  const area=haversine({lat:south,lon:west},{lat:north,lon:west})*haversine({lat:(south+north)/2,lon:west},{lat:(south+north)/2,lon:east})/1e6;
  if(area>25000)throw Error('Приблизьте карту: можно сохранить область до 25 000 км²');
  const bb=bounds.join(','),roads=area<500?'["highway"]':'["highway"~"^(motorway|trunk|primary|secondary|tertiary)(_link)?$"]';
  const query=`[out:json][timeout:50];(way${roads}(${bb});way["waterway"~"river|canal"](${bb});way["natural"="water"](${bb});way["railway"="rail"](${bb});node["place"~"city|town|village"](${bb}););out geom;`;
  const data=await limited(()=>request(endpoints(services).overpass,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}),signal,timeout:65000}));
  const geojson=overpassFeatures(data);if(!geojson.features.length)throw Error('Для этой области не получены объекты карты');
  const bytes=new Blob([JSON.stringify(geojson)]).size;if(bytes>30000000)throw Error('Область слишком подробная. Приблизьте карту и повторите.');
  const map={id,bounds,geojson,bytes,createdAt:new Date().toISOString(),detail:area<500?'Подробная схема':'Основные дороги, железные дороги, водоёмы и населённые пункты'};
  await writeMap(map);return map;
}
