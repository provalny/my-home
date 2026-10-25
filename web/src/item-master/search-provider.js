import {safeURL} from './model.js';

export const SEARCH_URL='https://api.tavily.com/search';
export const SEARCH_HEADERS={'Content-Type':'application/json','X-Tavily-Access-Mode':'keyless'};
export const USAGE_URL='https://api.tavily.com/usage';
export function validateKey(raw) {
  const key=typeof raw==='string'?raw.trim():'';
  if(!/^tvly-[A-Za-z0-9_-]{10,240}$/.test(key))throw Error('Вставьте API-ключ Tavily целиком: он начинается с tvly-');
  return key;
}
export function freeUsage(data) {
  const a=data?.account,k=data?.key,number=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  if(!a||!['researcher','free'].includes(String(a.current_plan).toLowerCase())||!number(a.plan_limit)||a.plan_limit>1000||!number(a.plan_usage)||!(a.paygo_limit===0||a.paygo_limit===null&&a.paygo_usage===0))throw Error('Подключите бесплатный тариф Tavily с отключённой оплатой сверх лимита. Проверьте тариф и Pay as you go в кабинете Tavily.');
  let remaining=Math.max(0,a.plan_limit-a.plan_usage);
  if(number(k?.limit)&&number(k?.usage))remaining=Math.min(remaining,Math.max(0,k.limit-k.usage));
  return {limit:a.plan_limit,used:a.plan_usage,remaining};
}
export function searchRequest(input,domains=[]) {
  const clean={};
  for(const [key,max] of [['name',200],['brand',100],['model',100]]) {
    if(input?.[key]!=null&&typeof input[key]!=='string')throw Error('Некорректное название предмета');
    clean[key]=(input?.[key]||'').trim().slice(0,max);
  }
  if(!clean.name)throw Error('Укажите название предмета');
  if(!Array.isArray(domains)||domains.length>10||domains.some(d=>typeof d!=='string'||d.length>100||!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)))throw Error('Некорректные источники поиска');
  return {query:[clean.name,clean.brand,clean.model,'specifications weight manufacturer part number packed dimensions'].filter(Boolean).join(' '),include_domains:domains,search_depth:'basic',max_results:6,topic:'general',include_answer:false,include_raw_content:'markdown',include_images:false,auto_parameters:false};
}
export function searchFailure(status,keyed=false) {
  if(keyed&&[401,403].includes(status))return 'Tavily отклонил API-ключ. Проверьте или замените его в настройках поиска.';
  if(keyed&&[402,432,433].includes(status))return 'Бесплатные запросы Tavily закончились. Поиск остановлен; проверьте остаток в кабинете Tavily.';
  if(keyed&&status===429)return 'Слишком много запросов к Tavily. Поиск остановлен; попробуйте позже.';
  if([402,429,432,433].includes(status))return 'Достигнут лимит бесплатного поиска. Попробуйте позже. Платный поиск не включён.';
  if([401,403].includes(status))return 'Бесплатный поиск временно недоступен. Попробуйте позже или добавьте ссылку на товар.';
  return 'Сервис поиска не ответил. Проверка не завершена; попробуйте позже.';
}
export function searchResults(data) {
  // Provider error text can contain instructions. Never display or execute it.
  if(!data||!Array.isArray(data.results))throw Error('Сервис не вернул результаты поиска. Проверка не завершена.');
  return data.results.slice(0,8).filter(r=>r&&typeof r.title==='string'&&safeURL(r.url)).map(r=>({url:r.url,title:r.title.slice(0,300),text:typeof r.raw_content==='string'?r.raw_content.slice(0,150000):''}));
}
