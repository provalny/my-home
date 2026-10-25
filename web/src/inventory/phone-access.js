import { h } from '../ui/dom.js';

export function phoneAccessCard({native, remote, status = {}, call, error}) {
  const card = h('section.iv-card.iv-phone-access', h('h2','Доступ с телефона'));
  if (remote) {
    card.append(h('p','Телефон подключён к общей базе на Mac.'),h('p.iv-muted','Изменения сохраняются на Mac. Оставьте его включённым, Life Assistant — запущенным, а оба устройства — в одной домашней сети Wi-Fi.'));
    return card;
  }
  if (!native) {
    card.append(h('p','Откройте настройки в приложении Life Assistant на Mac и нажмите «Подключить телефон».'));
    return card;
  }
  const action = (text, payload, style = '') => h('button.iv-btn'+style,{type:'button',onclick:async e=>{
    const button=e.currentTarget;button.disabled=true;
    try { await call('inventoryPhoneAccess',payload); } catch (failure) { error(failure.message); }
    finally { button.disabled=false; }
  }},text);
  card.append(h('p','Все пространства и вещи будут доступны в браузере телефона. Установка приложения не требуется.'));
  if (status.enabled) {
    card.append(h('p.iv-phone-state',status.state==='ready'?'Доступ по Wi-Fi включён':'Запускаем подключение…'));
    const links=status.links||[];
    if (links.length) {
      const preview=h('div.iv-phone-code'), selector=h('select',{'aria-label':'Адрес Mac в домашней сети'});
      for(const link of links)selector.append(h('option',{value:link.address},link.address));
      const show=()=>{
        const link=links.find(x=>x.address===selector.value)||links[0];
        const address=h('input',{type:'text',value:link.url,readOnly:true,'aria-label':'Ссылка для телефона',onclick:e=>e.target.select()});
        preview.replaceChildren(...(link.qr?[h('img',{src:link.qr,alt:'QR-код подключения к Life Assistant',width:232,height:232})]:[]),
          h('p','Наведите камеру телефона на QR-код и откройте ссылку.'),h('label.iv-field',h('span','Ссылка для телефона'),address));
      };
      selector.onchange=show;selector.value=links[0].address;show();
      if(links.length>1)card.append(h('label.iv-field',h('span','Сеть Mac'),selector));
      card.append(preview,h('p.iv-muted','Если телефон не подключается, проверьте общую Wi-Fi сеть и разрешение локальной сети для Life Assistant в настройках macOS. Гостевая сеть может блокировать связь между устройствами.'));
    } else if(status.state==='ready')card.append(h('p.iv-form-error','Не найден адрес домашней сети. Подключите Mac к Wi-Fi и снова откройте настройки.'));
    card.append(h('div.iv-actions',action('Обновить QR-код',{action:'renew'}),action('Выключить доступ',{on:false},'.danger')),
      h('small.iv-muted','QR-код даёт доступ к вашим вещам. При обновлении кода прежние подключения отключаются. Доступ выключится при полном выходе из Life Assistant.'));
  } else {
    if(status.error)card.append(h('p.iv-form-error',status.error));
    card.append(action('Подключить телефон',{on:true},'.primary'));
  }
  card.append(h('p.iv-muted','Mac должен оставаться включённым, приложение — запущенным. Подключение работает в домашней сети.'));
  return card;
}
