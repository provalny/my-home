import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { safeURL } from './src/item-master/model.js';
import {SEARCH_URL,SEARCH_HEADERS,searchRequest,searchFailure} from './src/item-master/search-provider.js';

export async function searchPublicProducts(input,domains=[]) {
  const body=JSON.stringify(searchRequest(input,domains));
  const response=await fetch(SEARCH_URL,{method:'POST',headers:SEARCH_HEADERS,body,redirect:'error',signal:AbortSignal.timeout(35000)});
  if(!response.ok){await response.body?.cancel();throw Error(searchFailure(response.status));}
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>2_000_000)throw Error('Ответ поиска слишком большой');chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('Не удалось прочитать ответ поиска');}
}

export function publicIPv4(address) {
  const a=address.split('.').map(Number);
  return a.length===4&&a.every(n=>Number.isInteger(n)&&n>=0&&n<=255)&&a[0]>0&&a[0]<224&&![10,127].includes(a[0])&&!(a[0]===169&&a[1]===254)&&!(a[0]===172&&a[1]>=16&&a[1]<=31)&&!(a[0]===192&&(a[1]===168||a[1]===0||a[1]===2))&&!(a[0]===100&&a[1]>=64&&a[1]<=127)&&!(a[0]===198&&(a[1]===18||a[1]===19||a[1]===51))&&!(a[0]===203&&a[1]===0&&a[2]===113);
}
export async function fetchPublicPage(raw,redirects=0) {
  if(!safeURL(raw))throw Error('Разрешены только общедоступные страницы HTTPS');
  const url=new URL(raw),addresses=await lookup(url.hostname,{all:true,family:4});
  if(!addresses.length||addresses.some(a=>!publicIPv4(a.address)))throw Error('Локальные и служебные адреса недоступны');
  const result=await new Promise((resolve,reject)=>{
    // Pin the checked address: no second DNS lookup or private redirect target.
    const req=https.get(url,{lookup:(_host,options,cb)=>options.all?cb(null,[addresses[0]]):cb(null,addresses[0].address,4),headers:{'User-Agent':'LifeAssistant-ItemMaster/1.0','Accept':'text/html,application/xhtml+xml','Accept-Language':'ru,en;q=0.8'},timeout:15000},res=>{
      if(res.statusCode>=300&&res.statusCode<400){res.resume();resolve({redirect:res.headers.location});return;}
      if(res.statusCode!==200){res.resume();reject(Error(res.statusCode===202||res.statusCode===403||res.statusCode===429?'Источник временно ограничил запросы. Попробуйте позже или добавьте ссылку на товар.':'Сайт не ответил: '+res.statusCode));return;}
      if(!/^(text\/(html|plain)|application\/(xhtml\+xml|ld\+json))/i.test(res.headers['content-type']||'')){res.resume();reject(Error('Нужна HTML-страница товара'));return;}
      let size=0;const chunks=[];res.on('data',chunk=>{size+=chunk.length;if(size>2_000_000)req.destroy(Error('Страница слишком большая для чтения'));else chunks.push(chunk);});
      res.on('error',reject);res.on('end',()=>resolve({url:url.href,text:Buffer.concat(chunks).toString('utf8')}));
    });req.on('timeout',()=>req.destroy(Error('Сайт не ответил вовремя')));req.on('error',reject);
  });
  if(result.redirect){if(redirects>=3)throw Error('Слишком много перенаправлений');return fetchPublicPage(new URL(result.redirect,url).href,redirects+1);}
  return result;
}
export function itemMasterSearch() {
  let active=0;
  const install=server=>{server.middlewares.use(async(req,res,next)=>{
    const path=req.url?.split('?')[0];if(!['/api/item-master/page','/api/item-master/search'].includes(path))return next();
    const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    const origin=req.headers.origin;
    if(req.method!=='POST'||req.headers['x-life-assistant']!=='1'||origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`)return send(403,{error:'Откройте поиск из приложения'});
    if(active>=3)return send(429,{error:'Дождитесь завершения текущего запроса'});
    active++;
    try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)throw Error('Слишком большой запрос');}const body=JSON.parse(raw);send(200,path.endsWith('/search')?await searchPublicProducts(body.input,body.domains):await fetchPublicPage(body.url));}
    catch(e){send(502,{error:e.message||'Источник недоступен'});}finally{active--;}
  });};
  return {name:'item-master-free-search',configureServer:install,configurePreviewServer:install};
}
