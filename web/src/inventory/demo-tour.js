import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import './demo-tour.css';

// This guide only stores its own progress on the device. Examples never enter the inventory.
export const TOUR_CARDS = [
  { title:'Всё важное — в одном месте', glyph:'home', section:'Общая сводка',
    intro:'Life Assistant помогает находить вещи, вести домашние дела и готовиться к поездкам. Начните с общей сводки.',
    steps:['Выбирайте разделы в боковом меню. На телефоне откройте кнопку «Меню».','В сводке смотрите стоимость имущества, пространства, последние вещи и важные даты.','Нажимайте на карточки, чтобы перейти к подробностям.'],
    example:['Ваш день','Квартира · вещи и места хранения','Важные даты · сроки и гарантии','Автомобили · общий обзор'], tip:'Это обзор из 10 карточек. Примеры вымышленные и не добавляются в ваши данные.' },
  { title:'Найдите вещь прямо в квартире', glyph:'map', section:'Пространство → Редактор пространства',
    intro:'У каждого пространства свой план, комнаты, мебель и места хранения. Их можно рассматривать в 3D или списком.',
    steps:['В «Пространстве» выберите квартиру, гараж или рабочее место.','Нажмите на мебель, затем на полку или ящик, чтобы увидеть содержимое.','В «Редакторе пространства» меняйте план, комнаты и расстановку мебели.'],
    example:['Пространство','Квартира → Спальня','Шкаф → Верхняя полка','Камера · на своём месте'], tip:'В карточке вещи кнопка «Показать на плане» подлетит к её месту хранения.' },
  { title:'У каждой вещи есть своя карточка', glyph:'box', section:'Все вещи → Добавить вещь',
    intro:'Каталог объединяет имущество из всех пространств. Поиск сверху помогает быстро найти вещь или место.',
    steps:['Нажмите «Добавить вещь», укажите название и выберите место хранения.','Добавьте фото, цену, вес, состояние, заметки, гарантию или срок годности.','Во «Всех вещах» переключайте таблицу и плитки, используйте поиск и фильтры; выделяйте несколько вещей для общих действий.'],
    example:['Карточка вещи','Камера · фото и характеристики','Место · Квартира / Шкаф','Цена · вес · гарантия'], tip:'Верхний поиск открывается также сочетанием ⌘K на Mac или Ctrl+K в браузере.' },
  { title:'Приведите каталог в порядок', glyph:'sparkles', section:'Категории → Мастер предметов',
    intro:'Категории описывают вещи, подборки объединяют их по занятиям, а мастер помогает уточнить характеристики.',
    steps:['В «Категориях» нажмите «Настроить категории» и выберите готовые наборы или нужные пункты по отдельности.','Назначайте категории, подборки и редкость в карточке вещи. Редкость также определяется по названию.','В «Мастере предметов» запустите поиск, сравните модели и источники, затем примените только подходящие поля.'],
    example:['Мастер предметов','Название → Найти варианты','Сравнить модель, вес и объём','Выбрать поля → Применить'], tip:'Поиск характеристик запускается вручную. Перед применением вы выбираете, что изменить.' },
  { title:'Добавляйте сейчас, раскладывайте потом', glyph:'unplaced', section:'Без места → Архив → Корзина',
    intro:'Чтобы начать учёт, необязательно сразу знать точный ящик. Все неразложенные вещи собраны в «Без места».',
    steps:['Добавляйте вещи в «Без места», а затем переносите в комнату, шкаф или другое хранилище.','Для большого списка используйте импорт Excel в «Без места»: достаточно столбца с названиями, перед добавлением проверьте совпадения.','Убирайте неиспользуемое в архив. Ошибочно удалённое можно восстановить из корзины.'],
    example:['Без места','Импорт Excel → Проверить список','Выделить вещи → Переместить','Шкаф → Ящик'], tip:'Не спешите очищать корзину: окончательное удаление лишает возможности восстановить записи.' },
  { title:'Держите домашние дела под контролем', glyph:'homeassistant', section:'Мониторинг квартиры',
    intro:'Отдельный раздел собирает коммунальные услуги, счета, климат и обслуживание. Здесь можно вести несколько квартир.',
    steps:['Выберите квартиру и настройте её услуги. План берётся из инвентаризации для просмотра.','Вносите показания, расход и суммы вручную; отмечайте счета и оплаты.','Смотрите историю и графики, ведите климат и задачи обслуживания с напоминаниями.'],
    example:['Мониторинг квартиры','Услуги · показания и расход','Счета · сроки и оплаты','Климат · обслуживание'], tip:'Расход и стоимость указываются вручную: показания и тарифы сами их не рассчитывают.' },
  { title:'Всё об автомобиле — в его разделе', glyph:'car', section:'Автомобиль',
    intro:'Для каждой машины можно вести эксплуатацию и хранить список вещей в салоне, багажнике и коробках.',
    steps:['Добавьте свой автомобиль или выберите его в меню раздела.','Записывайте поездки, одометр, заправки и расходы. Расход топлива задаётся вручную.','Планируйте ТО, отмечайте расходники и шины; размещайте вещи в хранилищах автомобиля.'],
    example:['Автомобиль','Пробег · поездки · заправки','ТО · расходники · шины','Багажник → Коробка → Вещи'], tip:'Вещи автомобиля связаны с общим каталогом: их не нужно заводить второй раз.' },
  { title:'Соберите поездку без забытых вещей', glyph:'outdoor', section:'Походы и отпуска',
    intro:'Планируйте маршрут и дни путешествия, распределяйте снаряжение по сумкам, контейнерам и автомобилям.',
    steps:['Создайте поездку, добавьте маршрут и события по дням.','Выберите вещи из каталога и разложите по хранилищам; следите за весом и заполнением.','Сохраняйте лодауты для повторных сборов и заранее подготовьте офлайн-схему маршрута.'],
    example:['Походы и отпуска','Маршрут → План по дням','Рюкзак · контейнер · автомобиль','Лодаут → Следующая поездка'], tip:'Исходное место вещи в квартире или автомобиле сохраняется, чтобы её было проще вернуть после поездки.' },
  { title:'Замечайте самочувствие и прогресс', glyph:'activity', section:'Личные метрики → Награды',
    intro:'Короткие ежедневные записи помогают видеть динамику, а награды отмечают освоенные возможности и привычки.',
    steps:['В «Личных метриках» пройдите ежедневный опрос или добавьте запись вручную.','Смотрите историю; для сна и активности можно импортировать дневные итоги из export.xml Apple Health.','Откройте «Награды»: фильтруйте достижения по разделам, редкости и получению, следите за прогрессом.'],
    example:['Личные метрики','Настроение · энергия · напряжение','История записей и дневные итоги','Награды · цели и серии'], tip:'Импорт Apple Health выполняется вручную. Прямого фонового обмена с iPhone пока нет.' },
  { title:'Настройте приложение под себя', glyph:'gear', section:'Настройки → Приложение → Демо-режим',
    intro:'После карточек откроется живая демонстрация: квартира, автомобиль и заполненные вкладки. Вы сможете попробовать интерфейс, затем убрать все примеры одной кнопкой.',
    steps:['В настройках выберите тему, палитру, анимации и интервал напоминаний.','В «Данные и копии» скачивайте полную резервную копию или таблицу вещей в Excel. Доступ с телефона настраивается на Mac.','Кнопки «Отменить» и «Повторить» находятся сверху, подробности — в «Истории». Новые функции описаны в «Что нового».'],
    example:['Начните с малого','Добавьте одну вещь','Укажите, где она лежит','Сохраните резервную копию'], tip:'Повторить эти 10 карточек можно в любое время: «Настройки» → «Приложение» → «Включить демо-режим».' },
];

export function createDemoTour({storage=localStorage, storageKey, onClose=()=>{}}) {
  const key=`${storageKey}:demo-tour-v1`;
  let state;
  try { state=JSON.parse(storage.getItem(key)||'null'); } catch { /* Start a fresh guide if progress is unreadable. */ }
  let dialog=null;
  const save=(status,step)=>{
    state={status,step};
    try { storage.setItem(key,JSON.stringify(state)); } catch { /* The guide still works without device storage. */ }
  };
  function open({automatic=false}={}) {
    if(dialog?.isConnected){dialog.focus();return;}
    if(document.querySelector('dialog[open]'))return;
    let step=automatic&&state?.status==='in-progress'&&Number.isInteger(state.step)?Math.max(0,Math.min(TOUR_CARDS.length-1,state.step)):0;
    const previousFocus=document.activeElement;
    dialog=h('dialog.iv-dialog.dt-dialog',{'aria-labelledby':'dt-title','aria-describedby':'dt-intro'});
    const currentDialog=dialog;
    let completed=false;
    const close=(finished=false)=>{
      completed=finished;
      save(completed?'completed':'skipped',step);
      currentDialog.close();
    };
    const heading=h('h2',{id:'dt-title',tabindex:-1});
    const counter=h('span.dt-counter',{'aria-live':'polite','aria-atomic':'true'});
    const progress=h('nav.dt-progress',{'aria-label':'Карточки демо-режима'});
    const body=h('div.dt-body');
    const back=h('button.iv-btn',{type:'button',onclick:()=>move(step-1)},icon('back',16),'Назад');
    const next=h('button.iv-btn.primary',{type:'button',onclick:()=>step===TOUR_CARDS.length-1?close(true):move(step+1)});
    const skip=h('button.iv-btn',{type:'button',onclick:()=>close()},'Пропустить обзор');
    currentDialog.append(h('header.dt-header',h('div',h('span.dt-eyebrow','ЗНАКОМСТВО С LIFE ASSISTANT'),h('strong','Демо-режим')),skip),
      progress,body,h('footer.dt-footer',counter,h('div.dt-actions',back,next)));
    function move(index){step=Math.max(0,Math.min(TOUR_CARDS.length-1,index));render();}
    function render(){
      const card=TOUR_CARDS[step];save('in-progress',step);
      heading.textContent=card.title;
      counter.textContent=`Карточка ${step+1} из ${TOUR_CARDS.length}`;
      back.disabled=step===0;next.textContent=step===TOUR_CARDS.length-1?'Посмотреть живое демо':'Далее';
      progress.replaceChildren(...TOUR_CARDS.map((item,i)=>h('button.dt-step',{type:'button','aria-label':`Карточка ${i+1}: ${item.title}`,'aria-current':i===step?'step':null,title:item.title,onclick:()=>move(i)},String(i+1))));
      body.replaceChildren(h('div.dt-copy',h('div.dt-glyph',icon(card.glyph,28)),heading,h('p.dt-intro',{id:'dt-intro'},card.intro),
        h('p.dt-location',icon('map',15),card.section),h('ol.dt-instructions',...card.steps.map(text=>h('li',text)))),
        h('aside.dt-example',h('span.dt-eyebrow','ПРИМЕР ИНТЕРФЕЙСА'),h('div.dt-preview',h('div.dt-preview-title',icon(card.glyph,20),card.example[0]),
          ...card.example.slice(1).map((text,i)=>h('div.dt-preview-row',icon(['box','list','check'][i],17),h('span',text)))),h('p.dt-tip',icon('book',18),h('span',card.tip))));
      body.scrollTop=0;heading.focus({preventScroll:true});
    }
    currentDialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    currentDialog.addEventListener('keydown',e=>{
      e.stopPropagation();
      if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
      // Preserve native button navigation within the numbered progress bar.
      if(progress.contains(e.target))return;
      if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(step+(e.key==='ArrowRight'?1:-1));}
    });
    currentDialog.addEventListener('close',()=>{
      currentDialog.remove();dialog=null;
      if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
      onClose({automatic,completed});
    },{once:true});
    document.body.append(currentDialog);currentDialog.showModal();render();
  }
  return {open,markShowcase:()=>save('showcase',TOUR_CARDS.length-1),completeShowcase:()=>save('completed',TOUR_CARDS.length-1),
    get shouldResumeShowcase(){return state?.status==='showcase';},get shouldAutoStart(){return !['completed','skipped','showcase'].includes(state?.status);}};
}
