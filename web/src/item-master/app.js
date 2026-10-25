import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import * as M from './model.js';
import { lookup } from './client.js';
import './style.css';

const btn=(label,action,glyph,primary=false)=>h('button.iv-btn'+(primary?'.primary':''),{type:'button',onclick:action},glyph?icon(glyph,15):null,label);
const disabled=(button,value)=>{button.disabled=Boolean(value);return button;};
const date=value=>new Date(value).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const value=(key,v)=>v==null||v===''?'—':typeof v==='number'?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(v)+(key==='weightGrams'?' г':key==='transportLiters'?' л':''):v;
const sourceLink=(url,label)=>h('a',{href:M.safeURL(url),target:'_blank',rel:'noopener noreferrer',referrerpolicy:'no-referrer'},label||new URL(url).hostname);
const sourceKind=c=>c.sourceKind==='manufacturer'?'Производитель':c.sourceKind==='store'?'Страница товара':'Источник';

export function createItemMaster({getDocument,change,modal,say,isActive=()=>true}) {
  let host,filter='pending',query='',expanded=null,running=false,controller=null,progress='',lastMessage='',pageSize=60;
  const selected=new Set();
  const doc=()=>getDocument();
  const redraw=()=>{if(host&&isActive())render(host);};
  const mutate=(fn,action,undoable=true)=>change(fn,{action,undoable,retryable:false});

  async function search(ids,{repeat=false,url=null}={}) {
    if(running)return;
    const queue=[...new Set(ids)].filter(id=>{const n=doc().nodes.find(n=>n.id===id);return M.eligible(n)&&(repeat||!M.checked(n));});
    if(!queue.length){say('Все выбранные предметы уже проверены');return;}
    running=true;controller=new AbortController();lastMessage='';let completed=0;
    try{
      for(const id of queue) {
        controller.signal.throwIfAborted();const n=doc().nodes.find(n=>n.id===id);if(!M.eligible(n)||!repeat&&M.checked(n))continue;
        const fingerprint=M.fingerprint(n);progress=`${completed+1} из ${queue.length} · ${n.name}`;redraw();
        try{
          const result=url?await lookup.fromURL(url,M.searchInput(n),{signal:controller.signal}):await lookup.search(M.searchInput(n),{signal:controller.signal});
          controller.signal.throwIfAborted();
          await mutate(d=>M.saveResult(d,id,result,fingerprint),'Результат поиска предмета',false);completed++;expanded=id;
        }catch(e){
          if(e.name==='AbortError')throw e;
          try{await mutate(d=>M.saveError(d,id,e.message),'Ошибка поиска предмета',false);}catch{/* Main save error is already visible. */}
          throw e; // A blocked provider must not trigger a request storm for the rest of the queue.
        }
      }
      lastMessage=`Проверено предметов: ${completed}. Результаты сохранены; характеристики ещё не изменены.`;
      if(completed)filter='checked';
    }catch(e){lastMessage=e.name==='AbortError'?`Поиск остановлен. Завершённых проверок: ${completed}.`:`Поиск остановлен: ${e.message}`;}
    finally{running=false;controller=null;progress='';redraw();}
  }

  function addLink(n) {
    modal('Прочитать страницу товара',(body,close)=>{
      const input=h('input',{type:'url',placeholder:'https://…','aria-label':'Ссылка на товар'});
      const error=h('p.iv-form-error',{role:'alert'});
      body.append(h('p',n.name),h('p.iv-muted','Вставьте ссылку производителя или магазина. Будут предложены только распознанные характеристики с этой страницы.'),input,error,btn('Прочитать',()=>{
        const url=M.safeURL(input.value);if(!url){error.textContent='Укажите общедоступную ссылку https://';return;}
        close();search([n.id],{repeat:true,url});
      },'search',true));
    });
  }

  function compare(ids) {
    const entries=ids.map(id=>doc().nodes.find(n=>n.id===id)).filter(n=>M.eligible(n)&&M.chosen(n));
    if(!entries.length){say('Сначала выберите найденную модель');return;}
    modal('Сравнение характеристик',(body,close)=>{
      body.classList.add('im-comparison');
      body.append(h('p.iv-muted','Отметьте поля, которые хотите применить. Заполненные значения и ваше название по умолчанию сохраняются. Изменения можно отменить общей кнопкой «Отменить».'));
      const plans=[],error=h('p.iv-form-error',{role:'alert'});
      for(const n of entries){
        const c=M.chosen(n),choices=new Set();plans.push({id:n.id,candidateId:c.id,checkedAt:n.itemResearch.checkedAt,choices,node:structuredClone(n)});
        const section=h('section.im-compare-item',h('h3',n.name),h('p.iv-muted',c.title,' · ',sourceLink(c.url)));
        const table=h('table',h('thead',h('tr',...['Применить','Поле','Сейчас','Найдено'].map(t=>h('th',t))))),rows=h('tbody');
        for(const key of [...Object.keys(c.fields),...(c.fields.officialName?['name']:[])]) {
          const fact=c.fields[key==='name'?'officialName':key],before=M.currentValue(n,key),same=before===fact.value;
          const check=h('input',{type:'checkbox','aria-label':n.name+' · '+M.FIELDS[key]});check.disabled=same;
          check.checked=!same&&key!=='name'&&(before==null||before==='');if(check.checked)choices.add(key);
          check.onchange=()=>check.checked?choices.add(key):choices.delete(key);
          rows.append(h('tr',h('td',check),h('th',{scope:'row'},M.FIELDS[key]),h('td',value(key,before)),h('td',h('strong',value(key,fact.value)),h('small',fact.basis),sourceLink(fact.source,'Источник'))));
        }
        table.append(rows);section.append(h('div.im-table-scroll',table));body.append(section);
      }
      const save=btn('Применить выбранные поля',async()=>{
        save.disabled=true;error.textContent='';
        try{
          const updates=plans.filter(p=>p.choices.size).map(p=>({id:p.id,candidateId:p.candidateId,checkedAt:p.checkedAt,fields:M.planChanges(p.node,[...p.choices])})).filter(p=>p.fields.length);
          await mutate(d=>M.applyChanges(d,updates),'Мастер предметов: применение характеристик');close();say(`Обновлено предметов: ${updates.length}`);
        }catch(e){error.textContent=e.message;save.disabled=false;}
      },'check',true);
      body.append(error,h('div.iv-actions',btn('Отмена',close),save));
    });
  }

  function resultPanel(n) {
    const r=n.itemResearch,panel=h('div.im-results');
    if(r?.warning)panel.append(h('p.im-notice',r.warning));
    if(!r?.candidates.length)panel.append(h('p.iv-muted',M.checked(n)?'Подходящие характеристики не найдены. Эта вещь исключена из следующих общих поисков. Можно уточнить название и нажать «Искать заново» или добавить ссылку.':'Укажите точную модель в карточке или добавьте ссылку на страницу товара.'));
    if(r?.candidates.length) {
      panel.append(h('p.iv-muted','Выберите свою модель и комплектацию. Значения разных вариантов не объединяются.'));
      for(const c of r.candidates) {
        const radio=h('input',{type:'radio',name:'im-candidate-'+n.id,'aria-label':'Выбрать модель: '+c.title});radio.checked=r.chosen===c.id;radio.disabled=running;
        radio.onchange=async()=>{try{await mutate(d=>M.chooseCandidate(d,n.id,c.id),'Выбор модели предмета',false);}catch{redraw();}};
        const info=h('div.im-candidate-info',h('strong',c.title),h('small',sourceKind(c),' · ',sourceLink(c.url)),h('div.im-facts',...Object.entries(c.fields).filter(([k])=>k!=='officialName').map(([k,f])=>h('span',{title:f.basis},M.FIELDS[k]+': '+value(k,f.value)))));
        panel.append(h('label.im-candidate'+(radio.checked?'.is-chosen':''),radio,info));
      }
    }
    const actions=h('div.iv-actions',disabled(btn('Добавить ссылку',()=>addLink(n),'link'),running));
    if(M.checked(n))actions.append(disabled(btn('Искать заново',()=>search([n.id],{repeat:true}),'rotate'),running));
    if(M.chosen(n))actions.append(disabled(btn('Сравнить и применить',()=>compare([n.id]),'sliders',true),running));
    panel.append(actions);return panel;
  }

  function render(container) {
    host=container;
    const all=M.items(doc()),unseen=all.filter(n=>!M.checked(n)),seen=all.filter(M.checked),ready=all.filter(n=>M.chosen(n));
    for(const id of selected)if(!all.some(n=>n.id===id))selected.delete(id);
    const selection=all.filter(n=>selected.has(n.id)),selectedPending=selection.filter(n=>!M.checked(n));
    const header=h('div.im-header',h('div',h('div.im-eyebrow',icon('sparkles',14),'КАТАЛОГ БЕЗ ПРОПУСКОВ'),h('h1','Мастер предметов'),h('p','Находим названия и характеристики ваших вещей')),
      disabled(btn('Найти для непроверенных',()=>search(unseen.map(n=>n.id)),'search',true),running||!unseen.length));
    const stats=h('div.im-stats',...[['В разделе',all.length,'Вещи, мебель и хранилища'],['Не проверено',unseen.length,'Только они входят в общий поиск'],['Проверено',seen.length,'Повторно — только по вашей команде'],['Модель выбрана',ready.length,'Можно сравнить характеристики']].map(([label,count,note])=>h('div.im-stat',h('small',label),h('strong',String(count)),h('span',note))));
    const tabs=h('nav.im-tabs',{'aria-label':'Фильтры мастера предметов'},...[['pending','Не проверено'],['checked','Проверено'],['all','Все предметы']].map(([key,label])=>h('button',{type:'button',class:filter===key?'active':'','aria-pressed':String(filter===key),onclick:()=>{filter=key;pageSize=60;redraw();}},label)));
    const searchBox=h('input',{type:'search',value:query,placeholder:'Найти предмет…','aria-label':'Поиск в мастере предметов'});
    const list=h('div.im-list');
    const controls=h('div.im-controls',h('span',`Выбрано: ${selection.length}`),disabled(btn('Искать выбранные',()=>search(selectedPending.map(n=>n.id)),'search'),running||!selectedPending.length),disabled(btn('Сравнить выбранные',()=>compare(selection.map(n=>n.id)),'sliders'),running||!selection.some(M.chosen)));
    function paintList(){
      const visible=all.filter(n=>(filter==='all'||(filter==='checked'?M.checked(n):!M.checked(n)))&&n.name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
      const shown=visible.slice(0,pageSize);
      const mark=h('input',{type:'checkbox','aria-label':'Выбрать показанные предметы'});mark.checked=shown.length>0&&shown.every(n=>selected.has(n.id));mark.indeterminate=shown.some(n=>selected.has(n.id))&&!mark.checked;mark.onchange=()=>{shown.forEach(n=>mark.checked?selected.add(n.id):selected.delete(n.id));redraw();};
      list.replaceChildren(h('div.im-list-heading',h('label',mark,'Выбрать показанные'),h('small',`Показано ${shown.length} из ${visible.length}`)));
      for(const n of shown){
        const r=n.itemResearch,check=h('input',{type:'checkbox','aria-label':'Выбрать: '+n.name});check.checked=selected.has(n.id);check.onchange=()=>{check.checked?selected.add(n.id):selected.delete(n.id);redraw();};
        const status=n.itemResearchError?'Ошибка поиска':!r?'Не проверено':r.appliedAt&&r.appliedCandidateId===r.chosen?'Данные применены':r.status==='not_found'?'Не найдено':r.chosen?'Модель выбрана':'Выберите модель';
        const copy=btn(n.name,()=>{expanded=expanded===n.id?null:n.id;redraw();});copy.classList.add('im-item-name');copy.setAttribute('aria-expanded',String(expanded===n.id));
        const row=h('div.im-item-row',check,h('div.im-item-copy',copy,h('small',r?`Проверено ${date(r.checkedAt)}`:'Название · артикул · вес · транспортный объём')),h('span.im-status',{class:'im-status '+(n.itemResearchError?'is-error':r?'is-done':'')},status),btn(expanded===n.id?'Скрыть':'Открыть',()=>{expanded=expanded===n.id?null:n.id;redraw();},expanded===n.id?'back':'next'));
        const card=h('article.im-item',{'data-research-id':n.id},row);
        if(n.itemResearchError)card.append(h('p.im-error',n.itemResearchError));
        if(expanded===n.id)card.append(resultPanel(n));list.append(card);
      }
      if(!visible.length)list.append(h('div.iv-empty',icon('check',28),h('h3',filter==='pending'&&!query?'Все предметы уже проверены':'Предметов не найдено'),h('p',filter==='pending'&&!query?'Результаты доступны во вкладке «Проверено».':'Измените фильтр или поисковый запрос.')));
      if(visible.length>shown.length)list.append(btn('Показать ещё',()=>{pageSize+=60;paintList();},'next'));
    }
    searchBox.oninput=()=>{query=searchBox.value;pageSize=60;paintList();};
    const notice=h('div.im-info',icon('bulb',16),h('p','Бесплатный поиск по открытым страницам. Сначала производитель, затем магазины. Передаются только название, бренд и модель. Результаты сохраняются отдельно от карточки.'));
    container.replaceChildren(header,stats,notice);
    if(running)container.append(h('div.im-progress',{role:'status'},h('span.im-pulse'),h('div',h('strong','Ищем характеристики'),h('small',progress)),btn('Остановить',()=>{controller?.abort();},'close')));
    if(lastMessage)container.append(h('p.im-notice',{role:'status'},lastMessage));
    container.append(h('div.im-filterbar',tabs,searchBox),controls,list);paintList();
  }
  return {render,stop:()=>controller?.abort()};
}
