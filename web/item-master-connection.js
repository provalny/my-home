import {USAGE_URL,validateKey,freeUsage,searchFailure} from './src/item-master/search-provider.js';

// Dev/preview only: keep credentials in server memory, outside inventory and browser storage.
export function createTavilyConnection({fetcher=fetch,now=Date.now}={}) {
  let key='',budget=null,checkedAt=0,generation=0,checking=null;
  const status=()=>({connected:Boolean(key),canManage:true,storage:'server-session',budget:budget?{...budget}:null});
  async function inspect(candidate) {
    let response;
    try{response=await fetcher(USAGE_URL,{headers:{Authorization:'Bearer '+candidate},redirect:'error',signal:AbortSignal.timeout(15000)});}
    catch{throw Error('Не удалось проверить Tavily. Проверьте интернет и попробуйте снова.');}
    if(!response.ok){await response.body?.cancel();throw Error(searchFailure(response.status,true));}
    const raw=await response.text();if(raw.length>32000)throw Error('Не удалось проверить тариф Tavily');
    let data;try{data=JSON.parse(raw);}catch{throw Error('Не удалось проверить тариф Tavily');}
    return freeUsage(data);
  }
  async function connection({action='status',apiKey}={}) {
    if(action==='status')return status();
    if(action==='disconnect'){generation++;key='';budget=null;checkedAt=0;return status();}
    if(!['connect','check'].includes(action))throw Error('Неизвестное действие подключения');
    const candidate=action==='connect'?validateKey(apiKey):key;
    if(!candidate)throw Error('Сначала подключите API-ключ Tavily');
    const revision=++generation,next=await inspect(candidate);
    if(generation!==revision)throw Error('Настройки подключения изменились. Повторите проверку.');
    key=candidate;budget=next;checkedAt=now();return status();
  }
  async function authorize() {
    if(!key)return '';
    const candidate=key,revision=generation;
    if(!budget||now()-checkedAt>=120000){
      if(!checking)checking=inspect(candidate).then(next=>{if(generation===revision){budget=next;checkedAt=now();}}).finally(()=>{checking=null;});
      await checking;
    }
    if(key!==candidate||generation!==revision)throw Error('Подключение Tavily изменилось. Запустите поиск снова.');
    if(!budget||budget.remaining<1)throw Error('Бесплатные запросы Tavily закончились. Обновите остаток в настройках поиска.');
    budget.remaining--;budget.used++; // Reserve before sending; concurrent requests cannot exceed this budget.
    return candidate;
  }
  return {connection,authorize};
}
