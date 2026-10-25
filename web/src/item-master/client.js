import { call, isNative } from '../bridge.js';
import { createLookup } from './lookup.js';

export async function fetchPage(url,signal) {
  signal?.throwIfAborted();
  if(isNative){
    return new Promise((resolve,reject)=>{
      let timer;
      const abort=()=>finish(new DOMException('Остановлено','AbortError'));
      const finish=(error,value)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
      signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>finish(Error('Источник не ответил вовремя')),65000);
      call('inventoryItemMasterPage',{url}).then(r=>finish(null,r),e=>finish(e));
    });
  }
  const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,65000);signal?.addEventListener('abort',abort,{once:true});
  try{
    const response=await fetch('/api/item-master/page',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Life-Assistant':'1'},body:JSON.stringify({url}),signal:controller.signal});
    const type=response.headers.get('content-type')||'';
    if(!type.includes('application/json'))throw Error('Для поиска откройте приложение через локальный сервер или обновлённую версию Mac');
    const result=await response.json();if(!response.ok||result.error)throw Error(result.error||'Поиск временно недоступен');return result;
  }catch(e){if(signal?.aborted)throw new DOMException('Остановлено','AbortError');if(e.name==='AbortError')throw Error('Источник не ответил вовремя');throw e;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export const lookup=createLookup(fetchPage);
