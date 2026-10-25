import {h} from '../ui/dom.js';
import {icon} from '../ui/icons.js';
import './showcase.css';

export const SHOWCASE_STOPS=[
  ['space','Демо-квартира в 3D','Откройте шкаф или ящик и посмотрите вещи внутри. Можно вращать и приближать квартиру.'],
  ['overview','Общая сводка','Заполненные карточки показывают стоимость имущества, пространства и важные даты.'],
  ['catalog','Все вещи','Попробуйте поиск, фильтры, таблицу и плитки. Нажмите на вещь, чтобы открыть её карточку.'],
  ['categories','Категории и подборки','Посмотрите дерево категорий и настройку наборов под разные занятия.'],
  ['unplaced','Без места','Здесь находятся вещи, которым пока не выбрали хранилище, и кнопка импорта Excel.'],
  ['item-master','Мастер предметов','Есть учебный результат для сравнения характеристик. Пометка «учебный» означает вымышленные значения.'],
  ...[
    ['Обзор','Мониторинг: квартира','Обзор услуг, климата, ближайших оплат и плана квартиры.'],
    ['Показания','Мониторинг: показания','Заполненная история счётчиков и расхода за два года.'],
    ['Счета и оплата','Мониторинг: счета','Примеры оплаченных, частично оплаченных счетов и сроков. Платить по ним не нужно.'],
    ['Аналитика','Мониторинг: аналитика','Сравните месяцы и услуги на графиках.'],
    ['Обслуживание','Мониторинг: обслуживание','Примеры домашних работ и напоминаний.'],
    ['Настройки мониторинга','Мониторинг: настройки','Услуги, поставщики, тарифы и параметры демонстрационной квартиры.'],
  ].map(([tab,name,description])=>['monitoring',name,description,'.mn-tabs',tab]),
  ...[
    ['Обзор','Демо-автомобиль в 3D','Заполненная машина с пробегом, расходами и ближайшим обслуживанием.'],
    ['Хранение','Автомобиль: вещи','Откройте багажник, салон и коробки с вещами.'],
    ['Журнал','Автомобиль: журнал','Полгода вымышленных поездок, пробега и заправок.'],
    ['Заправки и расходы','Автомобиль: расходы','Посмотрите категории трат и записи о заправках.'],
    ['ТО','Автомобиль: обслуживание','Работы, расходники, шины и история ТО. Внутренние вкладки можно переключать самостоятельно.'],
    ['Статистика','Автомобиль: статистика','Графики эксплуатации по данным демонстрационной машины.'],
  ].map(([tab,name,description])=>['automobile',name,description,'.au-tabs',tab]),
  ...[
    ['Маршрут','Поездка: маршрут','Пример путешествия с точками на карте.'],
    ['По дням','Поездка: план','События и остановки на каждый день поездки.'],
    ['Инвентарь','Поездка: вещи и сумки','Рюкзак, сумка и автомобиль с распределёнными вещами. Посмотрите вес, заполнение и лодауты.'],
  ].map(([tab,name,description])=>['travel',name,description,'.tr-tabs',tab]),
  ...[
    ['Обзор','Личные метрики: сегодня','Вымышленные отметки самочувствия, сон и активность.'],
    ['История','Личные метрики: история','Три недели ежедневных записей для просмотра динамики.'],
    ['Источники','Личные метрики: источники','Ручной ввод и импорт Apple Health. В демонстрации подключать личные данные не требуется.'],
  ].map(([tab,name,description])=>['personal-metrics',name,description,'.pm-tabs',tab]),
  ['awards','Награды','Посмотрите коллекцию достижений, условия и фильтры. Демо не приносит наград в вашей базе.'],
  ['archive','Архив','Пример вещи, которой больше не пользуются. Архив сохраняет её карточку и историю.'],
  ['trash','Корзина','Пример удалённой вещи, которую можно восстановить.'],
  ['history','История действий','Посмотрите, как записываются добавление, перемещение и другие действия.'],
  ['editor','Редактор пространства','Попробуйте расстановку мебели и редактирование плана на демонстрационной квартире.'],
  ...['Внешний вид','Напоминания','Данные и копии','Доступ с телефона','Приложение'].map(tab=>['settings',`Настройки: ${tab.toLocaleLowerCase('ru')}`,'Настройки показаны на вымышленном примере. Изменения в демо исчезнут при выходе.','.iv-settings-tabs',tab]),
];

export function openShowcase({theme='dark',onClose=()=>{}}={}){
  if(document.querySelector('dialog[open]'))return;
  const previousFocus=document.activeElement;
  const dialog=h('dialog.sc-dialog',{'aria-label':'Живое демо приложения'});
  let step=0,ready=false,closed=false;
  const frame=h('iframe.sc-frame',{title:'Демонстрационная квартира, автомобиль и разделы',src:`./index.html?demo=showcase&theme=${encodeURIComponent(theme)}`,referrerpolicy:'no-referrer'});
  const caption=h('p.sc-caption',{'aria-live':'polite'}),status=h('span.sc-status',{role:'status'},'Загружаем вымышленные примеры…');
  const select=h('select',{'aria-label':'Раздел демонстрации',onchange:e=>navigate(Number(e.target.value))},...SHOWCASE_STOPS.map(([,title],i)=>h('option',{value:i},`${i+1}. ${title}`)));
  const close=()=>{if(!closed){closed=true;dialog.close();}};
  const back=h('button.iv-btn',{type:'button',onclick:()=>navigate(step-1)},icon('back',16),'Назад');
  const next=h('button.iv-btn.primary',{type:'button',onclick:()=>step===SHOWCASE_STOPS.length-1?close():navigate(step+1)},'Дальше');
  const exit=h('button.iv-btn',{type:'button',onclick:close},'Завершить демо');
  function navigate(index){
    step=Math.max(0,Math.min(SHOWCASE_STOPS.length-1,index));select.value=String(step);
    const [section,,description,selector,tab]=SHOWCASE_STOPS[step];caption.textContent=description;
    back.disabled=!ready||step===0;next.disabled=!ready;
    next.textContent=step===SHOWCASE_STOPS.length-1?'Убрать примеры и начать':'Дальше';
    if(ready){
      try{frame.contentWindow.__inventory.showcaseGo({section,selector,tab});status.textContent=`Экран ${step+1} из ${SHOWCASE_STOPS.length} · можно изучать вкладки самостоятельно`;}
      catch{status.textContent='Экран не открылся. Выберите другой раздел или завершите демо.';}
    }
  }
  const timer=setTimeout(()=>{if(!ready){status.textContent='Не удалось загрузить демо. Закройте его и повторите запуск в настройках.';}},20000);
  const message=e=>{
    if(e.source!==frame.contentWindow||e.data?.type!=='life-assistant-showcase-ready')return;
    ready=true;clearTimeout(timer);select.disabled=false;navigate(step);
  };
  window.addEventListener('message',message);
  dialog.append(h('header.sc-header',h('div',h('strong','ДЕМО · все данные вымышлены'),h('small','Примеры удалятся при выходе. Ваша база остаётся отдельно.')),exit),
    h('div.sc-guide',select,caption),frame,h('footer.sc-footer',status,h('div.sc-actions',back,next)));
  select.disabled=true;back.disabled=true;next.disabled=true;
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.addEventListener('close',()=>{
    closed=true;clearTimeout(timer);window.removeEventListener('message',message);
    // Destroy the browsing context, along with its memory-only document and storage.
    frame.remove();dialog.remove();
    if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
    onClose();
  },{once:true});
  document.body.append(dialog);dialog.showModal();navigate(0);exit.focus();return dialog;
}
