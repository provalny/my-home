import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import * as M from './model.js';
import * as I from './insights.js';
import {listCalendars,eventsOn,minutesForEvents} from './calendar.js';
import { parseAppleHealthXML } from './health-import.js';
import './metrics.css';

const TABS = [['overview','Обзор','home'],['history','История','clock'],['sources','Источники','link']];
const QUESTIONS = [
  {key:'mood',title:'Какое у вас сегодня настроение?',options:[['1','Очень тяжело'],['2','Не очень'],['3','Нейтрально'],['4','Хорошо'],['5','Отлично']]},
  {key:'energy',title:'Сколько у вас энергии?',options:[['1','Очень мало'],['2','Мало'],['3','Средне'],['4','Много'],['5','Очень много']]},
  {key:'tension',title:'Насколько вы напряжены?',options:[['1','Совсем нет'],['2','Немного'],['3','Средне'],['4','Сильно'],['5','Очень сильно']]},
  {key:'productivity',title:'Как прошёл день по продуктивности?',options:[['1','Очень трудно'],['2','Немного сделал'],['3','Средне'],['4','Хорошо'],['5','Отлично']]},
  {key:'timeBreakdown',title:'На что ушло занятое время?'},
  {key:'loadScore',title:'Как ощущалась нагрузка?',options:[['1','Очень легко'],['2','Легко'],['3','Умеренно'],['4','Тяжело'],['5','Очень тяжело']]},
  {key:'rest',title:'Удалось ли восстановиться?',options:[['1','Совсем нет'],['2','Немного'],['3','Частично'],['4','Хорошо'],['5','Полностью']]},
];
const TIME_LABELS={work:'Работа',chores:'Быт',commute:'Дорога',other:'Другое'};
const TIME_OPTIONS=[[0,'0'],[30,'до 1 ч'],[90,'1–2 ч'],[180,'2–4 ч'],[300,'4–6 ч'],[420,'6–8 ч'],[540,'8+ ч']];
const CAUSE_LABELS={work:'Работа',sleep:'Сон',health:'Здоровье',people:'Общение',money:'Деньги',other:'Другое'};
const RECOVERY_LABELS={sleep:'Сон',walk:'Прогулка',exercise:'Движение',quiet:'Тишина',people:'Общение',hobby:'Хобби',other:'Другое'};
const METRIC_LABELS={mood:'Настроение',energy:'Энергия',tension:'Напряжение',productivity:'Продуктивность',busyMinutes:'Занятость',loadScore:'Нагрузка',rest:'Восстановление',sleepMinutes:'Сон',steps:'Шаги',activityMinutes:'Движение',weightKg:'Масса тела'};
const btn = (label,action,glyph,cls='') => h('button.iv-btn'+(cls?'.'+cls:''),{type:'button',onclick:action},glyph?icon(glyph,14):null,label);
const field = (label,control) => h('label.iv-field',h('span',label),control);
const inp = (value='',props={}) => h('input',{value:value ?? '',...props});
const dayLabel = value => new Date(value+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
const shortDay = value => new Date(value+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
const numberLabel = value => value == null ? '—' : new Intl.NumberFormat('ru-RU').format(value);

export function createPersonalMetrics({getDocument,change,say}) {
  const state={tab:'overview',promptSeen:null,importing:false,survey:null,trendDays:7,calendarList:null,calendarDraft:null,calendarError:null,calendarLoading:false,datePicker:false,weightEditor:null,healthEditor:null};
  let host=null;
  const doc=()=>getDocument();
  const redraw=()=>{if(host?.isConnected)render(host);};
  const mutate=(fn,label)=>change(fn,{action:label});

  const oneDecimal=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(value);
  const compactHours=value=>value==null?'—':`${oneDecimal(value/60)} ч`;
  const metricDisplay=(key,value)=>value==null?'—':['busyMinutes','sleepMinutes'].includes(key)?compactHours(value):key==='weightKg'?`${oneDecimal(value)} кг`:['steps','activityMinutes'].includes(key)?`${numberLabel(Math.round(value))}${key==='activityMinutes'?' мин':''}`:`${oneDecimal(value)} / 5`;

  function trend(metric) {
    const rows=I.series(doc(),metric,state.trendDays),known=rows.map(row=>row.value).filter(Number.isFinite);
    const high=['mood','energy','tension','productivity','loadScore','rest'].includes(metric)?5:
      metric==='busyMinutes'?720:metric==='sleepMinutes'?600:metric==='steps'?12000:metric==='activityMinutes'?120:Math.max(...known,1);
    const low=metric==='weightKg'&&known.length?Math.max(0,Math.min(...known)-2):0;
    return h('div.pm-trend',{'aria-label':`${METRIC_LABELS[metric]} за ${state.trendDays} дней`},
      ...rows.map(row=>h('i',{class:row.value==null?'missing':'',title:`${row.date}: ${metricDisplay(metric,row.value)}`,style:{height:row.value==null?'2px':`${Math.max(6,Math.min(100,(row.value-low)/(high-low||1)*100))}%`}})));
  }

  function card(label,value,sub,glyph,metric) {
    return h('article.pm-card',h('div.pm-card-top',icon(glyph,14),h('span',label)),h('strong',value),trend(metric),h('small',sub));
  }

  function weeklySummary(body) {
    const week=I.summary(doc(),7),labels={...METRIC_LABELS};
    const values=I.METRICS.map(key=>{
      const row=week.metrics[key],delta=row.delta!=null&&row.count>=2&&row.previousCount>=2?row.delta:null;
      const suffix=delta==null?'':` · ${delta>0?'↑':delta<0?'↓':'→'}${metricDisplay(key,Math.abs(delta))}`;
      return h('div.pm-week-metric',h('span',labels[key]),h('strong',metricDisplay(key,row.value)),h('small',row.count?`${row.count} дн.${suffix}`:'Нет записей'));
    });
    const time=M.TIME_KEYS.map(key=>h('span.pm-time-chip',`${TIME_LABELS[key]} · ${week.time[key].minutes==null?'—':'≈ '+compactHours(week.time[key].minutes)}`));
    const context=[];
    if(week.causes.length)context.push(h('span',`Отмечали как влияние: ${week.causes.slice(0,3).map(([tag,count])=>`${CAUSE_LABELS[tag]} ${count}`).join(' · ')}`));
    if(week.recovery.length)context.push(h('span',`Помогало: ${week.recovery.slice(0,3).map(([tag,count])=>`${RECOVERY_LABELS[tag]} ${count}`).join(' · ')}`));
    body.append(h('section.pm-week',h('div.pm-week-heading',h('div',h('h2','Последние 7 дней'),h('p','Средние по заполненным дням; пропуски не считаются нулём.')),h('span',`${shortDay(week.periodStart)} — ${shortDay(week.periodEnd)}`)),h('div.pm-week-grid',...values),h('div.pm-week-time',...time),context.length?h('div.pm-week-context',...context):null));
  }

  function overview(body) {
    const day=M.today(),entry=M.entryOn(doc(),day),health=M.healthOn(doc(),day),weight=M.weightOn(doc(),day);
    if(state.survey)body.append(surveyPanel());
    else if(state.weightEditor)body.append(weightPanel());
    else if(!entry)body.append(h('div.pm-checkin.pm-checkin-top',icon('documents',14),h('strong','Ежедневная отметка'),h('span','7 коротких вопросов'),h('div.pm-grow'),btn('Начать',()=>openSurvey(day),'plus','primary')));
    body.append(h('div.pm-trend-toolbar',h('span','Динамика карточек'),...([7,30].map(days=>h('button',{type:'button',class:state.trendDays===days?'active':'',onclick:()=>{state.trendDays=days;redraw();}},`${days} дней`)))));
    body.append(h('div.pm-cards',
      card('Настроение',M.moodLabel(entry?.mood),entry?.causes?.length?entry.causes.map(tag=>CAUSE_LABELS[tag]).join(' · '):'Моя отметка','sun','mood'),
      card('Энергия',entry?.energy==null?'—':`${entry.energy} из 5`,'Моя отметка','power','energy'),
      card('Напряжение',entry?.tension==null?'—':`${entry.tension} из 5`,'Моя отметка','activity','tension'),
      card('Продуктивность',entry?.productivity==null?'—':`${entry.productivity} из 5`,'Моя отметка','list','productivity'),
      card('Занятое время',entry?.busyMinutes==null?'—':'≈ '+M.hoursLabel(entry.busyMinutes),entry?.timeSource==='calendar'?'Календарь и ответы':'По ответам','clock','busyMinutes'),
      card('Нагрузка',entry?.loadScore==null?'—':`${entry.loadScore} из 5`,'Ощущение за день','activity','loadScore'),
      card('Восстановление',entry?.rest==null?'—':`${entry.rest} из 5`,entry?.recovery?.length?entry.recovery.map(tag=>RECOVERY_LABELS[tag]).join(' · '):'Оценка за день','heart','rest'),
      card('Сон',M.hoursLabel(health?.sleepMinutes),health?`${numberLabel(health.steps)} шагов · ${health.source==='manual'?'вручную':'Apple Health'}`:'Нет данных','moon','sleepMinutes'),
      card('Масса тела',weight?`${oneDecimal(weight.kg)} кг`:'—',weight?'Ручная запись':'По желанию','sliders','weightKg')
    ));
    body.append(h('div.pm-bottom-link',btn(weight?'Изменить массу':'Записать массу',()=>openWeight(day),'plus'),btn('Посмотреть историю',()=>switchTab('history'),'next')));
    weeklySummary(body);
  }

  function history(body) {
    const dates=[...new Set([...M.data(doc()).entries,...M.data(doc()).health,...(M.data(doc()).weight||[])].map(row=>row.date))].sort().reverse().slice(0,90);
    body.append(h('div.pm-section-title',h('div',h('h2','История отметок'),h('p','Самочувствие, время, сон, движение и масса тела по дням.')),btn('Добавить запись',()=>{state.datePicker=!state.datePicker;redraw();},'plus','primary')));
    if(state.datePicker){
      const date=inp(M.today(),{type:'date',max:M.today(),'aria-label':'Дата записи'});
      body.append(h('section.pm-date-picker',h('strong','Выберите день для опроса'),h('div',...[[0,'Сегодня'],[-1,'Вчера'],[-2,'Позавчера']].map(([offset,label])=>btn(label,()=>{state.datePicker=false;openSurvey(I.dayShift(M.today(),offset));},'clock')),date,btn('Начать',()=>{if(!M.validDay(date.value)||date.value>M.today()){say('Выберите прошедшую дату',true);return;}state.datePicker=false;openSurvey(date.value);},'next','primary'))));
    }
    if(!dates.length){body.append(h('div.pm-empty','Записей пока нет. Начните с короткого опроса или добавьте запись вручную.'));return;}
    body.append(h('div.pm-history',...dates.map(day=>{
      const row=M.entryOn(doc(),day),health=M.healthOn(doc(),day),weight=M.weightOn(doc(),day),values=[];
      if(row)values.push(M.moodLabel(row.mood),row.energy==null?'Энергия —':`Энергия ${row.energy}/5`,row.tension==null?'Напряжение —':`Напряжение ${row.tension}/5`,row.productivity==null?'Продуктивность —':`Продуктивность ${row.productivity}/5`,row.busyMinutes==null?'Время —':`Занято ≈ ${M.hoursLabel(row.busyMinutes)}`,row.loadScore==null?'Нагрузка —':`Нагрузка ${row.loadScore}/5`,row.rest==null?'Отдых —':`Отдых ${row.rest}/5`);
      if(row?.timeBreakdown)for(const key of M.TIME_KEYS)if(row.timeBreakdown[key])values.push(`${TIME_LABELS[key]} ≈ ${M.hoursLabel(row.timeBreakdown[key])}`);
      if(row?.causes?.length)values.push(`Влияло: ${row.causes.map(tag=>CAUSE_LABELS[tag]).join(', ')}`);
      if(row?.recovery?.length)values.push(`Помогло: ${row.recovery.map(tag=>RECOVERY_LABELS[tag]).join(', ')}`);
      if(health)values.push(health.sleepMinutes==null?'Сон —':`Сон ${M.hoursLabel(health.sleepMinutes)}`,health.steps==null?'Шаги —':`${numberLabel(health.steps)} шагов`,health.activityMinutes==null?'Движение —':`Движение ${health.activityMinutes} мин`);
      if(weight)values.push(`Масса ${oneDecimal(weight.kg)} кг`);
      return h('div.pm-history-row',h('strong',dayLabel(day)),h('span',values.join(' · ')),h('div.pm-history-actions',btn(row?'Отметка':'Опрос',()=>openSurvey(day),'sliders'),health?btn('Здоровье',()=>openHealth(day),'heart'):null,weight?btn('Масса',()=>openWeight(day),'sliders'):null));
    })));
  }

  function sources(body) {
    if(state.healthEditor)body.append(healthPanel());
    const records=M.data(doc()).health;
    const latest=[...records].sort((a,b)=>b.date.localeCompare(a.date))[0];
    const picker=inp('',{type:'file',accept:'.xml,text/xml,application/xml','aria-label':'Файл export.xml из Apple Health'});
    picker.className='pm-file';
    picker.onchange=async()=>{
      const file=picker.files?.[0];if(!file)return;
      state.importing=true;redraw();
      try{
        const rows=await parseAppleHealthXML(file);
        if(!rows.length)throw Error('За последний год не найдено данных сна и движения');
        await mutate(d=>{for(const row of rows)if(M.healthOn(d,row.date)?.source!=='manual')M.putHealth(d,row);},'Импорт данных Apple Health');
        say(`Из Apple Health загружено дней: ${rows.length}`);
      }catch(error){say(error.message,true);}finally{state.importing=false;picker.value='';redraw();}
    };
    const health=h('section.pm-source-card',h('div.pm-source-heading',icon('heart',14),h('h2','Apple Health')),
      h('p',latest?`Последние данные: ${dayLabel(latest.date)} · ${latest.source==='manual'?'вручную':'из экспорта'}`:'Данные ещё не импортированы'),
      h('div.pm-source-row',icon('moon',14),'Сон'),h('div.pm-source-row',icon('shoes',14),'Шаги'),h('div.pm-source-row',icon('activity',14),'Минуты движения'),
      h('div.pm-source-actions',btn(state.importing?'Импорт…':'Импортировать export.xml',()=>picker.click(),'upload',state.importing?'':'primary'),btn('Внести вручную',()=>openHealth(M.today()),'plus')),
      h('small','На iPhone: Здоровье → профиль → Экспорт всех данных. Распакуйте ZIP и выберите export.xml. Сохраняются только дневные итоги за последний год.'),picker);
    const manual=h('section.pm-source-card',h('div.pm-source-heading',icon('sliders',14),h('h2','Мои отметки')),
      h('p','Настроение и продуктивность оцениваете только вы.'),
      ...['Настроение','Энергия','Напряжение','Продуктивность','Время по категориям','Ощущение нагрузки','Восстановление'].map(x=>h('div.pm-source-row',icon('check',13),x,h('span','Опрос'))),
      h('div.pm-source-actions',btn('Заполнить сегодня',()=>openSurvey(M.today()),'plus'),btn('Записать массу',()=>openWeight(M.today()),'sliders')));
    const selected=M.data(doc()).settings.calendarIds||[];
    const calendar=h('section.pm-source-card',h('div.pm-source-heading',icon('clock',14),h('h2','Календарь')),
      h('p',selected.length?`Выбрано календарей: ${selected.length}. События предлагаются в опросе и сохраняются только после подтверждения.`:'Выберите календари для подсказки о занятости.'),
      h('div.pm-source-actions',btn(state.calendarLoading?'Загрузка…':'Выбрать календари',async()=>{
        state.calendarLoading=true;state.calendarError=null;redraw();
        try{state.calendarList=await listCalendars();state.calendarDraft={ids:[...selected],mappings:{...(M.data(doc()).settings.calendarMappings||{})}};}
        catch(error){state.calendarError=error.message;}
        finally{state.calendarLoading=false;redraw();}
      },'clock','primary')),
      state.calendarError?h('p.iv-form-error',{role:'alert'},state.calendarError):null,
      h('small','Для доступа на Mac потребуется разрешение системы. При открытии опроса можно исключить отдельные события; их названия в метриках не сохраняются.'));
    if(state.calendarList&&state.calendarDraft){
      const choices=h('div.pm-calendar-list',...state.calendarList.map(item=>{
        const check=inp('',{type:'checkbox',checked:state.calendarDraft.ids.includes(item.id),'aria-label':`Учитывать ${item.title}`});
        check.onchange=()=>{const ids=new Set(state.calendarDraft.ids);if(check.checked)ids.add(item.id);else ids.delete(item.id);state.calendarDraft.ids=[...ids];};
        const category=h('select',{'aria-label':`Категория календаря ${item.title}`},...M.TIME_KEYS.map(key=>h('option',{value:key},TIME_LABELS[key])));
        category.value=state.calendarDraft.mappings[item.id]||'work';
        category.onchange=()=>{state.calendarDraft.mappings[item.id]=category.value;};
        return h('div.pm-calendar-choice',h('label',check,h('span',item.title)),category);
      }));
      calendar.append(choices,h('div.pm-source-actions',btn('Сохранить выбор',async()=>{
        try{const ids=state.calendarDraft.ids.slice(0,30),mappings=Object.fromEntries(ids.map(id=>[id,state.calendarDraft.mappings[id]||'work']));await mutate(d=>{const settings=M.ensure(d).settings;settings.calendarIds=ids;settings.calendarMappings=mappings;},'Выбор календарей личных метрик');say('Календари сохранены');state.calendarList=null;state.calendarDraft=null;redraw();}
        catch(error){state.calendarError=error.message;redraw();}
      },'check','primary')));
    }
    body.append(h('div.pm-sources',health,manual,calendar));
    const enabled=inp('',{type:'checkbox',checked:M.data(doc()).settings.dailyPrompt});
    enabled.onchange=async()=>{try{await mutate(d=>{M.ensure(d).settings.dailyPrompt=enabled.checked;},'Настройки ежедневного опроса');}catch{enabled.checked=!enabled.checked;}};
    body.append(h('section.pm-prompt-setting',icon('documents',14),h('div',h('strong','Вечерний опрос'),h('small','Предлагать при первом входе после 18:00')),h('label',enabled,h('span','Включено'))));
    body.append(h('p.pm-provenance','Оценки настроения и напряжения — ваши личные отметки, не медицинский диагноз. Импорт Apple Health не определяет настроение или продуктивность. Данные сохраняются в общей базе Life Assistant.'));
  }

  function switchTab(tab){state.tab=tab;redraw();host.scrollTop=0;}

  function render(container) {
    host=container;container.classList.add('pm-content');
    const header=h('div.pm-header',h('div',h('div.pm-eyebrow',icon('activity',13),'ЛИЧНЫЕ МЕТРИКИ'),h('h1','Личные метрики'),h('p','Самочувствие, продуктивность и время')),
      h('div.pm-header-actions',h('span.pm-date',dayLabel(M.today())),btn(M.entryOn(doc(),M.today())?'Изменить отметку':'Заполнить за сегодня',()=>openSurvey(M.today()),'plus','primary')));
    const tabs=h('nav.pm-tabs',{'aria-label':'Вкладки личных метрик'},...TABS.map(([key,label,glyph])=>h('button',{type:'button',class:state.tab===key?'active':'','aria-current':state.tab===key?'page':null,onclick:()=>switchTab(key)},icon(glyph,13),label)));
    const body=h('div.pm-body');
    container.replaceChildren(header,tabs,body);
    ({overview,history,sources}[state.tab]||overview)(body);
  }

  function maybePrompt() {
    const day=M.today(),section=M.data(doc());
    if(new Date().getHours()<18 || !section.settings.dailyPrompt || section.settings.skippedOn===day || M.entryOn(doc(),day) || state.promptSeen===day)return;
    state.promptSeen=day;
    openSurvey(day);
  }

  function openSurvey(day) {
    const previous=M.entryOn(doc(),day);
    const draft={mood:previous?.mood??null,energy:previous?.energy??null,tension:previous?.tension??null,productivity:previous?.productivity??null,
      busyMinutes:previous?.busyMinutes??null,timeBreakdown:Object.fromEntries(M.TIME_KEYS.map(key=>[key,previous?.timeBreakdown?.[key]??(previous?null:0)])),
      timeSource:previous?.timeSource||'survey',loadScore:previous?.loadScore??null,rest:previous?.rest??null,
      causes:[...(previous?.causes||[])],recovery:[...(previous?.recovery||[])],note:previous?.note??''};
    state.tab='overview';state.weightEditor=null;
    const survey={day,draft,step:0,saving:false,calendarLoading:false,calendarEvents:[],calendarSelected:new Set(),calendarError:null};
    state.survey=survey;redraw();host?.scrollTo({top:0,behavior:'smooth'});
    const ids=M.data(doc()).settings.calendarIds||[];
    if(ids.length){survey.calendarLoading=true;eventsOn(day,ids).then(events=>{
      if(state.survey!==survey)return;survey.calendarEvents=events;survey.calendarSelected=new Set(events.map(event=>event.id));survey.calendarLoading=false;redraw();
    }).catch(error=>{if(state.survey!==survey)return;survey.calendarLoading=false;survey.calendarError=error.message;redraw();});}
  }

  function surveyPanel() {
    const survey=state.survey,panel=h('section.pm-survey.pm-survey-inline',{'aria-label':'Ежедневная отметка'});
    const next=()=>{survey.step=Math.min(QUESTIONS.length,survey.step+1);paint();};
    const previous=()=>{survey.step=Math.max(0,survey.step-1);paint();};
    const finish=async(skip=false)=>{
      if(survey.saving)return;survey.saving=true;panel.classList.add('is-closing');
      if(!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)await new Promise(resolve=>setTimeout(resolve,260));
      try{if(skip)await mutate(d=>M.skipPrompt(d,survey.day),'Пропуск ежедневного опроса');else await mutate(d=>M.putEntry(d,{date:survey.day,...survey.draft}),'Личная отметка за '+survey.day);state.survey=null;redraw();if(!skip)say('Отметка сохранена');}
      catch(error){survey.saving=false;panel.classList.remove('is-closing');say(error.message,true);}
    };
    const toggle=(field,tag)=>{const tags=new Set(survey.draft[field]);if(tags.has(tag))tags.delete(tag);else tags.add(tag);survey.draft[field]=[...tags];paint();};
    const tagChoices=(field,labels)=>h('div.pm-tag-group',h('strong',field==='causes'?'Что повлияло?':'Что помогло восстановиться?'),h('div.pm-tag-list',...Object.entries(labels).map(([key,label])=>h('button.pm-tag'+(survey.draft[field].includes(key)?'.active':''),{type:'button',onclick:()=>toggle(field,key)},label))));
    const calendarTotals=()=>{
      const mappings=M.data(doc()).settings.calendarMappings||{};
      return Object.fromEntries(M.TIME_KEYS.map(key=>[key,minutesForEvents(survey.calendarEvents.filter(event=>(mappings[event.calendarId]||'work')===key),survey.calendarSelected)]));
    };
    const timeCard=()=>{
      const rows=M.TIME_KEYS.map(key=>h('div.pm-time-choice',h('strong',TIME_LABELS[key]),h('div.pm-time-options',...TIME_OPTIONS.map(([minutes,label])=>h('button'+(survey.draft.timeBreakdown[key]===minutes?'.active':''),{type:'button',onclick:()=>{survey.draft.timeBreakdown[key]=minutes;survey.draft.timeSource='survey';paint();}},label))),
        survey.draft.timeBreakdown[key]!=null&&!TIME_OPTIONS.some(([minutes])=>minutes===survey.draft.timeBreakdown[key])?h('small',`Из календаря: ${M.hoursLabel(survey.draft.timeBreakdown[key])}`):null));
      const calendar=survey.calendarLoading?h('p.pm-calendar-hint','Читаю выбранные календари…'):survey.calendarError?h('p.pm-calendar-hint',survey.calendarError):survey.calendarEvents.length?
        h('div.pm-calendar-suggestion',h('div.pm-calendar-suggestion-title',icon('clock',14),h('strong','Подсказка календаря'),h('span',`${survey.calendarEvents.length} событий`)),
          h('div.pm-calendar-events',...survey.calendarEvents.map(event=>{
            const check=inp('',{type:'checkbox',checked:survey.calendarSelected.has(event.id)});
            check.onchange=()=>{if(check.checked)survey.calendarSelected.add(event.id);else survey.calendarSelected.delete(event.id);paint();};
            const start=new Date(event.start).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}),end=new Date(event.end).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
            return h('label.pm-calendar-event',check,h('span',event.title),h('small',`${start}–${end}`));
          })),btn('Применить подсказку',()=>{const totals=calendarTotals(),mappings=M.data(doc()).settings.calendarMappings||{};
            const keys=new Set(survey.calendarEvents.map(event=>mappings[event.calendarId]||'work'));
            survey.draft.timeBreakdown={...survey.draft.timeBreakdown,...Object.fromEntries([...keys].map(key=>[key,totals[key]]))};
            survey.draft.timeSource='calendar';paint();},'check')):null;
      const hasSplit=M.TIME_KEYS.some(key=>survey.draft.timeBreakdown[key]!=null);
      return h('div.pm-time-survey',h('p',hasSplit?'Выберите примерный диапазон. Пустые категории оставьте на нуле.':'Прежняя запись не разделена по категориям. Можно оставить её как есть.'),calendar,...rows,
        h('div.pm-time-total',hasSplit?`Итого ≈ ${M.hoursLabel(M.TIME_KEYS.reduce((sum,key)=>sum+(survey.draft.timeBreakdown[key]||0),0))}`:`Ранее: ${M.hoursLabel(survey.draft.busyMinutes)} без разбивки`));
    };
    const paint=()=>{
      const tags=survey.step===QUESTIONS.length,q=QUESTIONS[survey.step];
      panel.replaceChildren(h('div.pm-survey-progress',h('strong',dayLabel(survey.day)),h('span',tags?'Необязательно':`Вопрос ${survey.step+1} из ${QUESTIONS.length}`),h('div.pm-survey-steps',...QUESTIONS.map((_,i)=>h('i',{class:i<=survey.step?'active':''})))),
        h('h3',tags?'Контекст дня':q.title),
        tags?h('div.pm-survey-tags',h('p','Метки можно пропустить. Они помогут понять записи в истории.'),tagChoices('causes',CAUSE_LABELS),tagChoices('recovery',RECOVERY_LABELS)):q.key==='timeBreakdown'?timeCard():
          h('div.pm-answers',...q.options.map(([value,label])=>h('button.pm-answer'+(survey.draft[q.key]===Number(value)?'.active':''),{type:'button',onclick:()=>{survey.draft[q.key]=Number(value);next();}},label))),
        h('div.pm-survey-actions',btn(survey.step?'Назад':'Не сегодня',()=>survey.step?previous():finish(true),survey.step?'back':'close'),h('div.pm-grow'),
          tags?btn('Сохранить отметку',()=>finish(),'check','primary'):q.key==='timeBreakdown'?btn('Далее',()=>{if(M.TIME_KEYS.reduce((sum,key)=>sum+(survey.draft.timeBreakdown[key]||0),0)>1440){say('Занятое время не может превышать 24 часа',true);return;}next();},'next','primary'):null));
    };
    paint();return panel;
  }

  function openWeight(day) {
    const existing=M.weightOn(doc(),day);
    state.tab='overview';state.survey=null;state.weightEditor={day,originalDate:existing?.date||null,kg:existing?.kg??null,saving:false};redraw();host?.scrollTo({top:0,behavior:'smooth'});
  }

  function weightPanel() {
    const editor=state.weightEditor,day=inp(editor.day,{type:'date',max:M.today(),'aria-label':'Дата измерения'}),kg=inp(editor.kg??'',{type:'number',min:1,max:500,step:0.1,inputmode:'decimal','aria-label':'Масса тела в килограммах'});
    const error=h('p.iv-form-error',{role:'alert'});
    const save=async()=>{
      if(editor.saving)return;
      if(!M.validDay(day.value)||day.value>M.today()){error.textContent='Выберите прошедшую дату';return;}
      editor.saving=true;
      try{await mutate(d=>{if(editor.originalDate&&editor.originalDate!==day.value)M.removeWeight(d,editor.originalDate);M.putWeight(d,{date:day.value,kg:Number(kg.value)});},'Запись массы тела');state.weightEditor=null;redraw();say('Масса тела сохранена');}
      catch(e){editor.saving=false;error.textContent=e.message;}
    };
    return h('section.pm-survey.pm-weight-panel',{'aria-label':'Запись массы тела'},h('div.pm-survey-progress',h('strong','Масса тела'),h('span','По желанию')),
      h('h3','Какую массу тела записать?'),h('div.pm-weight-fields',field('Дата',day),field('Килограммы',kg)),error,
      h('div.pm-survey-actions',btn('Отмена',()=>{state.weightEditor=null;redraw();},'close'),editor.originalDate?btn('Удалить',async()=>{try{await mutate(d=>M.removeWeight(d,editor.originalDate),'Удаление массы тела');state.weightEditor=null;redraw();}catch(e){error.textContent=e.message;}},'trash','danger'):null,h('div.pm-grow'),btn('Сохранить',save,'check','primary')));
  }

  function openHealth(day) {
    const row=M.healthOn(doc(),day);
    state.tab='sources';state.survey=null;state.healthEditor={day,originalDate:row?.date||null,step:0,saving:false,
      values:{sleepMinutes:row?.sleepMinutes??null,steps:row?.steps??null,activityMinutes:row?.activityMinutes??null}};
    redraw();host?.scrollTo({top:0,behavior:'smooth'});
  }

  function healthPanel() {
    const editor=state.healthEditor,keys=['sleepMinutes','steps','activityMinutes'],key=keys[editor.step];
    const options={sleepMinutes:[[null,'Нет данных'],[0,'0 ч'],[300,'5 ч'],[360,'6 ч'],[420,'7 ч'],[480,'8 ч'],[540,'9 ч'],[600,'10 ч']],
      steps:[[null,'Нет данных'],[0,'0'],[2500,'2 500'],[5000,'5 000'],[7500,'7 500'],[10000,'10 000'],[15000,'15 000']],
      activityMinutes:[[null,'Нет данных'],[0,'0'],[15,'15 мин'],[30,'30 мин'],[45,'45 мин'],[60,'60 мин'],[90,'90 мин'],[120,'120 мин']]};
    const titles={sleepMinutes:'Сколько было сна?',steps:'Сколько было шагов?',activityMinutes:'Сколько минут движения?'};
    const date=inp(editor.day,{type:'date',max:M.today(),'aria-label':'Дата данных здоровья'});
    date.onchange=()=>{editor.day=date.value;};
    const exact=inp(editor.values[key]??'',{type:'number',min:0,max:key==='steps'?200000:1440,step:key==='sleepMinutes'?15:1,inputmode:'numeric','aria-label':`Точное значение: ${METRIC_LABELS[key]}${key==='sleepMinutes'?' в минутах':''}`});
    const error=h('p.iv-form-error',{role:'alert'});
    const next=()=>{if(editor.step<2){editor.step++;redraw();}else save();};
    const save=async()=>{
      if(editor.saving)return;
      if(!M.validDay(date.value)||date.value>M.today()){error.textContent='Выберите прошедшую дату';return;}
      editor.saving=true;
      try{await mutate(d=>{if(editor.originalDate&&editor.originalDate!==date.value)M.removeHealth(d,editor.originalDate);M.putHealth(d,{date:date.value,...editor.values,source:'manual'});},'Ручные данные сна и активности');state.healthEditor=null;redraw();say('Данные здоровья сохранены');}
      catch(e){editor.saving=false;error.textContent=e.message;}
    };
    const choices=h('div.pm-health-choices',...options[key].map(([value,label])=>h('button.pm-answer'+(editor.values[key]===value?'.active':''),{type:'button',onclick:()=>{editor.values[key]=value;next();}},label)));
    const panel=h('section.pm-survey.pm-health-panel',{'aria-label':'Ручная запись здоровья'},h('div.pm-survey-progress',h('strong','Сон и активность'),h('span',`Карточка ${editor.step+1} из 3`)),h('h3',titles[key]),
      h('p','Обычно эти данные приходят из Apple Health. Ручное значение заменит импорт за этот день.'),field('Дата',date),choices,
      h('div.pm-health-exact',exact,btn('Применить точное значение',()=>{const value=exact.value===''?null:Number(exact.value);if(value!=null&&(!Number.isInteger(value)||value<0||value>(key==='steps'?200000:1440)||key==='sleepMinutes'&&value%15)){error.textContent='Проверьте точное значение';return;}editor.values[key]=value;next();},'check')),
      error,h('div.pm-survey-actions',btn(editor.step?'Назад':'Отмена',()=>{if(editor.step){editor.step--;redraw();}else{state.healthEditor=null;redraw();}},editor.step?'back':'close'),editor.originalDate?btn('Удалить день',async()=>{try{await mutate(d=>M.removeHealth(d,editor.originalDate),'Удаление данных здоровья');state.healthEditor=null;redraw();}catch(e){error.textContent=e.message;}},'trash','danger'):null,h('div.pm-grow'),btn(editor.step===2?'Сохранить':'Далее',next,'next','primary')));
    return panel;
  }

  return {render,maybePrompt,openSurvey};
}
