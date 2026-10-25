import {h} from '../ui/dom.js';
import {icon} from '../ui/icons.js';
import {tavilyConnection} from './client.js';
import {validateKey} from './search-provider.js';

const button=(label,action,primary=false)=>h('button.iv-btn'+(primary?'.primary':''),{type:'button',onclick:action},label);
const accountLink=()=>h('a',{href:'https://app.tavily.com/home',target:'_blank',rel:'noopener noreferrer',referrerpolicy:'no-referrer'},'Открыть кабинет Tavily');
const budgetText=b=>b?`Доступно запросов: ${b.remaining} · лимит тарифа: ${b.limit} в месяц`:'Остаток можно обновить в настройках подключения';

export function createTavilySettings({modal,onChange}) {
  let state=null,error='',loading=false;
  async function refresh() {
    if(loading)return;loading=true;
    try{state=await tavilyConnection();error='';}catch(e){error=e.message;}
    finally{loading=false;onChange();}
  }
  function open() {
    modal('Подключение Tavily',(body,close)=>{
      let busy=false,message='';
      const input=h('input',{type:'password',autocomplete:'off',spellcheck:false,placeholder:'tvly-…','aria-label':'API-ключ Tavily'});
      async function act(action) {
        let apiKey;
        try{if(action==='connect')apiKey=validateKey(input.value);}catch(e){message=e.message;draw();return;}
        busy=true;message='';draw();
        try{
          state=await tavilyConnection({action,...(apiKey?{apiKey}:{})});error='';input.value='';
          message=action==='disconnect'?'Ключ удалён. Теперь доступен поиск без регистрации.':action==='check'?'Подключение проверено.':'Tavily подключён. Можно продолжать поиск непроверенных предметов.';
          onChange();
        }catch(e){message=e.message;}
        finally{busy=false;draw();}
      }
      function draw() {
        const controls=h('div.iv-actions');
        body.replaceChildren(h('div.im-connection-form',
          h('p',state?.connected?'Ваш ключ Tavily подключён. Поиск использует запросы вашего бесплатного аккаунта.':'Подключите ключ бесплатного аккаунта Tavily, чтобы продолжить поиск после ограничения доступа без регистрации.'),
          h('p.iv-muted','В кабинете Tavily скопируйте API-ключ и вставьте его сюда. Поддерживается бесплатный тариф с отключённым Pay as you go.'),accountLink(),
          h('p.im-connection-budget',state?.connected?budgetText(state.budget):'Ключ ещё не подключён.')));
        const form=body.firstElementChild;
        if(state?.canManage!==false){
          input.disabled=busy;form.append(h('label.im-key-label','API-ключ Tavily',input));
          controls.append(button(busy?'Проверяем…':state?.connected?'Проверить и заменить ключ':'Проверить и подключить',()=>act('connect'),true));
          if(state?.connected)controls.append(button('Обновить остаток',()=>act('check')),button('Отключить Tavily',()=>act('disconnect')));
          form.append(h('p.iv-muted',state?.storage==='keychain'?'Ключ сохраняется в Связке ключей этого Mac. В копии базы вещей он не попадает.':'В браузерной версии ключ хранится в памяти локального сервера. После перезапуска сервера его потребуется подключить снова.'),
            h('p.iv-muted','Проверка подключения не запускает поиск предметов. На один предмет может потребоваться до двух запросов.'));
        }else form.append(h('p.iv-muted',state.storage==='demo'?'Подключение ключей недоступно в обзорном демо.':'Подключите или замените ключ в приложении на Mac. Поиск с телефона использует подключение Mac.'));
        for(const control of controls.children)control.disabled=busy;
        if(message||error)form.append(h('p.im-notice',{role:'status'},message||error));
        controls.append(button('Готово',close));form.append(controls);
      }
      draw();
    });
  }
  function panel(running) {
    if(!state&&!loading&&!error)refresh();
    const control=button(state?.connected?'Настроить Tavily':'Подключить Tavily',open);control.disabled=running||loading;
    return h('div.im-connection',icon('link',17),h('div',h('strong',state?.connected?'Tavily подключён':'Поиск Tavily'),
      h('small',error||(!state?'Проверяем подключение…':state.connected?budgetText(state.budget):'Сейчас используется ограниченный поиск без регистрации'))),control);
  }
  return {panel,refresh};
}
