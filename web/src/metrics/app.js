import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import * as M from './model.js';
import { parseAppleHealthXML } from './health-import.js';
import './metrics.css';

const TABS = [['overview','Обзор','home'],['history','История','clock'],['sources','Источники','link']];
const QUESTIONS = [
  {key:'mood',title:'Какое у вас сегодня настроение?',options:[['1','Очень тяжело'],['2','Не очень'],['3','Нейтрально'],['4','Хорошо'],['5','Отлично']]},
  {key:'energy',title:'Сколько у вас энергии?',options:[['1','Очень мало'],['2','Мало'],['3','Средне'],['4','Много'],['5','Очень много']]},
  {key:'tension',title:'Насколько вы напряжены?',options:[['1','Совсем нет'],['2','Немного'],['3','Средне'],['4','Сильно'],['5','Очень сильно']]},
  {key:'productivity',title:'Как прошёл день по продуктивности?',options:[['1','Очень трудно'],['2','Немного сделал'],['3','Средне'],['4','Хорошо'],['5','Отлично']]},
  {key:'busyMinutes',title:'Сколько времени сегодня было занято?',options:[['0','0 ч'],['120','2 ч'],['240','4 ч'],['360','6 ч'],['480','8 ч'],['600','10 ч']]},
];
const btn = (label,action,glyph,cls='') => h('button.iv-btn'+(cls?'.'+cls:''),{type:'button',onclick:action},glyph?icon(glyph,14):null,label);
const field = (label,control) => h('label.iv-field',h('span',label),control);
const inp = (value='',props={}) => h('input',{value:value ?? '',...props});
const dayLabel = value => new Date(value+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
const numberLabel = value => value == null ? '—' : new Intl.NumberFormat('ru-RU').format(value);

function scoreSelect(value) {
  const el=h('select',h('option',{value:''},'Не указано'),...[1,2,3,4,5].map(n=>h('option',{value:n},`${n} из 5`)));
  el.value=value == null ? '' : String(value);
  return el;
}

export function createPersonalMetrics({getDocument,change,modal,say}) {
  const state={tab:'overview',promptSeen:null,importing:false,survey:null};
  let host=null;
  const doc=()=>getDocument();
  const redraw=()=>{if(host?.isConnected)render(host);};
  const mutate=(fn,label)=>change(fn,{action:label});

  function card(label,value,sub,glyph,tone='') {
    return h('article.pm-card'+(tone?'.'+tone:''),h('div.pm-card-top',icon(glyph,14),h('span',label)),h('strong',value),h('small',sub));
  }

  function overview(body) {
    const today=M.today(),entry=M.entryOn(doc(),today),health=M.healthOn(doc(),today);
    if(state.survey)body.append(surveyPanel());
    else if(!entry)body.append(h('div.pm-checkin.pm-checkin-top',icon('documents',14),h('strong','Ежедневная отметка'),h('span','5 коротких вопросов'),h('div.pm-grow'),btn('Начать',()=>openSurvey(today),'plus','primary')));
    body.append(h('div.pm-cards',
      card('Настроение',M.moodLabel(entry?.mood),entry?'Моя отметка':'Нет отметки','sun'),
      card('Энергия',entry?.energy == null?'—':`${entry.energy} из 5`,entry?'Моя отметка':'Нет отметки','power'),
      card('Напряжение',entry?.tension == null?'—':`${entry.tension} из 5`,entry?'Моя отметка':'Нет отметки','activity'),
      card('Продуктивность',entry?.productivity == null?'—':`${entry.productivity} из 5`,entry?'Моя отметка':'Нет отметки','list'),
      card('Занятое время',M.hoursLabel(entry?.busyMinutes),entry?'Внесено вручную':'Нет отметки','clock'),
      card('Сон и активность',health?.sleepMinutes!=null?M.hoursLabel(health.sleepMinutes):health?.steps!=null?`${numberLabel(health.steps)} шагов`:health?.activityMinutes!=null?`${health.activityMinutes} мин`:'—',health?`${health.sleepMinutes!=null&&health.steps!=null?`${numberLabel(health.steps)} шагов · `:''}${health.source==='manual'?'вручную':'из Apple Health'}`:'Нет данных','moon')
    ));
    body.append(h('div.pm-bottom-link',btn('Посмотреть историю',()=>switchTab('history'),'next')));
  }

  function history(body) {
    const dates=[...new Set([...M.data(doc()).entries,...M.data(doc()).health].map(row=>row.date))].sort().reverse().slice(0,90);
    body.append(h('div.pm-section-title',h('div',h('h2','История отметок'),h('p','Самочувствие, занятое время, сон и движение по дням.')),btn('Добавить запись',()=>entryForm(),'plus','primary')));
    if(!dates.length){body.append(h('div.pm-empty','Записей пока нет. Начните с короткого опроса или добавьте запись вручную.'));return;}
    body.append(h('div.pm-history',...dates.map(day=>{
      const row=M.entryOn(doc(),day),health=M.healthOn(doc(),day),values=[];
      if(row)values.push(M.moodLabel(row.mood),row.energy==null?'Энергия —':`Энергия ${row.energy}/5`,row.tension==null?'Напряжение —':`Напряжение ${row.tension}/5`,row.productivity==null?'Продуктивность —':`Продуктивность ${row.productivity}/5`,row.busyMinutes==null?'Время —':`Занято ${M.hoursLabel(row.busyMinutes)}`);
      if(health)values.push(health.sleepMinutes==null?'Сон —':`Сон ${M.hoursLabel(health.sleepMinutes)}`,health.steps==null?'Шаги —':`${numberLabel(health.steps)} шагов`,health.activityMinutes==null?'Движение —':`Движение ${health.activityMinutes} мин`);
      return h('div.pm-history-row',h('strong',dayLabel(day)),h('span',values.join(' · ')),h('div.pm-history-actions',row?btn('Отметка',()=>entryForm(row),'sliders'):null,health?btn('Здоровье',()=>healthForm(health),'heart'):null));
    })));
  }

  function sources(body) {
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
      h('div.pm-source-actions',btn(state.importing?'Импорт…':'Импортировать export.xml',()=>picker.click(),'upload',state.importing?'':'primary'),btn('Внести вручную',()=>healthForm(),'plus')),
      h('small','На iPhone: Здоровье → профиль → Экспорт всех данных. Распакуйте ZIP и выберите export.xml. Сохраняются только дневные итоги за последний год.'),picker);
    const manual=h('section.pm-source-card',h('div.pm-source-heading',icon('sliders',14),h('h2','Мои отметки')),
      h('p','Настроение и продуктивность оцениваете только вы.'),
      ...['Настроение','Энергия','Напряжение','Продуктивность','Занятое время'].map(x=>h('div.pm-source-row',icon('check',13),x,h('span','Вручную'))),
      h('div.pm-source-actions',btn('Заполнить сегодня',()=>openSurvey(M.today()),'plus')));
    body.append(h('div.pm-sources',health,manual));
    const enabled=inp('',{type:'checkbox',checked:M.data(doc()).settings.dailyPrompt});
    enabled.onchange=async()=>{try{await mutate(d=>{M.ensure(d).settings.dailyPrompt=enabled.checked;},'Настройки ежедневного опроса');}catch{enabled.checked=!enabled.checked;}};
    body.append(h('section.pm-prompt-setting',icon('documents',14),h('div',h('strong','Ежедневный опрос'),h('small','Показывать при первом входе в раздел за день')),h('label',enabled,h('span','Включено'))));
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
    if(!section.settings.dailyPrompt || section.settings.skippedOn===day || M.entryOn(doc(),day) || state.promptSeen===day)return;
    state.promptSeen=day;
    openSurvey(day);
  }

  function openSurvey(day) {
    const previous=M.entryOn(doc(),day),draft={mood:previous?.mood??null,energy:previous?.energy??null,tension:previous?.tension??null,productivity:previous?.productivity??null,busyMinutes:previous?.busyMinutes??null,note:previous?.note??''};
    state.tab='overview';state.survey={day,draft,step:0,saving:false};redraw();host?.scrollTo({top:0,behavior:'smooth'});
  }

  function surveyPanel() {
    const survey=state.survey,panel=h('section.pm-survey.pm-survey-inline',{'aria-label':'Ежедневная отметка'});
    const finish=async(skip=false)=>{
      if(survey.saving)return;survey.saving=true;panel.classList.add('is-closing');
      if(!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)await new Promise(resolve=>setTimeout(resolve,260));
      try{if(skip)await mutate(d=>M.skipPrompt(d,survey.day),'Пропуск ежедневного опроса');else await mutate(d=>M.putEntry(d,{date:survey.day,...survey.draft}),'Личная отметка за '+survey.day);state.survey=null;redraw();if(!skip)say('Отметка сохранена');}
      catch(error){survey.saving=false;panel.classList.remove('is-closing');say(error.message,true);}
    };
    const paint=()=>{
      const q=QUESTIONS[survey.step];
      panel.replaceChildren(h('div.pm-survey-progress',h('strong','Ежедневная отметка'),h('span',`Вопрос ${survey.step+1} из ${QUESTIONS.length}`),h('div.pm-survey-steps',...QUESTIONS.map((_,i)=>h('i',{class:i<=survey.step?'active':''})))),
        h('h3',q.title),h('div.pm-answers',...q.options.map(([value,label])=>h('button.pm-answer'+(survey.draft[q.key]===Number(value)?'.active':''),{type:'button',onclick:()=>{survey.draft[q.key]=Number(value);if(survey.step<QUESTIONS.length-1){survey.step++;paint();}else finish();}},label))),
        h('div.pm-survey-actions',btn(survey.step?'Назад':'Не сегодня',()=>{if(survey.step){survey.step--;paint();}else finish(true);},survey.step?'back':'close'),h('div.pm-grow'),btn('Пропустить вопрос',()=>{if(survey.step<QUESTIONS.length-1){survey.step++;paint();}else finish(Object.values(survey.draft).every(v=>v==null||v===''));},'next')));
    };
    paint();return panel;
  }

  function entryForm(existing=null) {
    modal(existing?'Изменить отметку':'Добавить отметку',(body,close)=>{
      const day=inp(existing?.date||M.today(),{type:'date',required:true}),mood=scoreSelect(existing?.mood),energy=scoreSelect(existing?.energy),tension=scoreSelect(existing?.tension),productivity=scoreSelect(existing?.productivity),busy=inp(existing?.busyMinutes==null?'':String(existing.busyMinutes/60),{type:'number',min:0,max:24,step:0.5,inputmode:'decimal'}),note=h('textarea',{rows:3,maxlength:1000},existing?.note||''),error=h('p.iv-form-error',{role:'alert'});
      const form=h('form.pm-edit-form',h('div.pm-form-grid',field('Дата',day),field('Настроение',mood),field('Энергия',energy),field('Напряжение',tension),field('Продуктивность',productivity),field('Занято, ч',busy)),field('Заметка',note),error,h('div.iv-dialog-actions',h('button.iv-btn.primary',{type:'submit'},'Сохранить'),existing?btn('Удалить',async()=>{try{await mutate(d=>M.removeEntry(d,existing.date),'Удаление личной отметки');close();}catch(e){error.textContent=e.message;}},'trash','danger'):null,btn('Отмена',close)));
      form.onsubmit=async event=>{event.preventDefault();error.textContent='';try{
        const hours=busy.value.trim()===''?null:Number(busy.value);
        if(hours!=null&&(!Number.isFinite(hours)||hours<0||hours>24||!Number.isInteger(hours*2)))throw Error('Занятое время укажите с шагом 30 минут');
        await mutate(d=>{if(existing&&existing.date!==day.value)M.removeEntry(d,existing.date);M.putEntry(d,{date:day.value,mood:mood.value?Number(mood.value):null,energy:energy.value?Number(energy.value):null,tension:tension.value?Number(tension.value):null,productivity:productivity.value?Number(productivity.value):null,busyMinutes:hours==null?null:Math.round(hours*60),note:note.value});},'Личная отметка за '+day.value);close();
      }catch(e){error.textContent=e.message;}};
      body.append(form);
    },{wide:true});
  }

  function healthForm(existing=null) {
    const row=existing||M.healthOn(doc(),M.today());
    modal('Сон и активность вручную',(body,close)=>{
      const day=inp(row?.date||M.today(),{type:'date',required:true}),sleep=inp(row?.sleepMinutes==null?'':String(row.sleepMinutes/60),{type:'number',min:0,max:24,step:0.25}),steps=inp(row?.steps??'',{type:'number',min:0,max:200000,step:1}),activity=inp(row?.activityMinutes??'',{type:'number',min:0,max:1440,step:1}),error=h('p.iv-form-error',{role:'alert'});
      const form=h('form.pm-edit-form',h('div.pm-form-grid',field('Дата',day),field('Сон, ч',sleep),field('Шаги',steps),field('Движение, мин',activity)),h('p.pm-form-hint','Ручная запись за выбранный день заменит импортированные значения этого дня.'),error,h('div.iv-dialog-actions',h('button.iv-btn.primary',{type:'submit'},'Сохранить'),row?btn('Удалить',async()=>{try{await mutate(d=>M.removeHealth(d,row.date),'Удаление данных здоровья');close();}catch(e){error.textContent=e.message;}},'trash','danger'):null,btn('Отмена',close)));
      form.onsubmit=async event=>{event.preventDefault();error.textContent='';try{
        const hours=sleep.value===''?null:Number(sleep.value),stepCount=steps.value===''?null:Number(steps.value),movement=activity.value===''?null:Number(activity.value);
        if(hours!=null&&(!Number.isInteger(hours*4)||hours<0||hours>24))throw Error('Сон укажите с шагом 15 минут');
        await mutate(d=>{if(row&&row.date!==day.value)M.removeHealth(d,row.date);M.putHealth(d,{date:day.value,sleepMinutes:hours==null?null:Math.round(hours*60),steps:stepCount,activityMinutes:movement,source:'manual'});},'Ручные данные сна и активности');close();
      }catch(e){error.textContent=e.message;}};
      body.append(form);
    },{wide:true});
  }

  return {render,maybePrompt,openSurvey};
}
