import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { AWARD_GROUPS, AWARD_RARITIES } from './awards.js';
import './awards.css';

const rarityOf=a=>AWARD_RARITIES.find(r=>r.id===a.rarity);
const option=(value,label)=>h('option',{value},label);
const count=value=>new Intl.NumberFormat('ru-RU').format(value);
const dateLabel=value=>new Date(value).toLocaleDateString('ru-RU');

// A small heraldic badge with tier-specific metalwork, built from vector UI assets.
export function awardBadge(award,concealed=false) {
  const rarity=concealed?AWARD_RARITIES[0]:rarityOf(award),rank=rarity.rank;
  return h(`div.aw-badge.aw-tier-${rank}${award.earned?'.aw-lit':''}`,{vars:{'--award-color':rarity.color},'aria-hidden':'true'},
    rank>=3?h('span.aw-wings',icon('leaf',24),icon('leaf',24)):null,
    h('span.aw-ribbon'),h('span.aw-medal',icon(concealed?'key':award.glyph,26,1.7)),
    h('span.aw-stars',...Array.from({length:rank>=4?3:rank>=2?2:1},()=>h('i'))));
}

export function renderAwards(host,awards,state={}) {
  state.group??='all';state.status??='all';state.rarity??='all';state.query??='';
  const earned=awards.filter(a=>a.earned),hidden=awards.filter(a=>a.hidden&&!a.earned).length;
  const summary=h('div.aw-summary',
    h('div.aw-summary-main',awardBadge({rarity:'legendary',glyph:'trophy',earned:true}),h('div',h('span.aw-eyebrow','ВАША КОЛЛЕКЦИЯ'),h('strong',`${earned.length} / ${awards.length}`),h('p','Достижения во всех разделах Life Assistant'))),
    h('div.aw-rarity-totals',...AWARD_RARITIES.map(r=>h('div',{vars:{'--award-color':r.color}},h('span.aw-color-dot'),h('span',r.name),h('strong',String(earned.filter(a=>a.rarity===r.id).length))))));
  const tabs=h('div.aw-tabs',{'aria-label':'Разделы наград'});
  const status=h('select',{'aria-label':'Состояние наград'},...[
    ['all','Все награды'],['earned','Полученные'],['locked','В процессе'],['secret','Скрытые'],
  ].map(([v,l])=>option(v,l)));
  const rarity=h('select',{'aria-label':'Редкость наград'},option('all','Любая редкость'),...AWARD_RARITIES.map(r=>option(r.id,r.name)));
  const search=h('input',{type:'search',placeholder:'Найти награду','aria-label':'Найти награду',value:state.query});
  const grid=h('div.iv-awards-grid.aw-grid'),result=h('p.aw-result',{'aria-live':'polite'});
  function card(a){
    const concealed=a.hidden&&!a.earned,r=concealed?AWARD_RARITIES[0]:rarityOf(a),name=concealed?'Скрытая награда':a.name;
    const progress=a.earned?a.target:a.value;
    return h(`article.iv-award.aw-card${a.earned?'.earned':''}${concealed?'.aw-concealed':''}`,{vars:{'--award-color':r.color},'aria-label':name},
      awardBadge(a,concealed),h('div.iv-award-copy',
        h('div.aw-card-meta',h('span.aw-rarity',concealed?'Не раскрыта':r.name),h('span',AWARD_GROUPS.find(g=>g.id===a.group).name)),
        h('h2',name),h('p',concealed?'Особое достижение. Значок и условие откроются после получения.':a.description)),
      h('div.aw-card-bottom',h('div.iv-award-state',a.earned?icon('check',14):concealed?icon('key',14):null,
        a.earned?'Получена'+(a.earnedAt?' · '+dateLabel(a.earnedAt):''):concealed?'Условие скрыто':a.value===0?'Ещё впереди':'В процессе'),
        concealed?null:h('span.aw-fraction',a.earned?'100%':`${count(a.value)} / ${count(a.target)}`)),
      concealed?h('div.aw-secret-line'):h('progress',{max:a.target,value:progress,'aria-label':`${name}: ${count(progress)} из ${count(a.target)}`}));
  }
  function paint(){
    tabs.replaceChildren(...[{id:'all',name:'Все разделы',glyph:'trophy'},...AWARD_GROUPS].map(g=>h(`button.iv-btn${state.group===g.id?'.active':''}`,{type:'button','aria-pressed':state.group===g.id?'true':'false',onclick:()=>{state.group=g.id;paint();}},icon(g.glyph,15),g.name,h('small',String(awards.filter(a=>g.id==='all'||a.group===g.id).length)))));
    const query=state.query.trim().toLocaleLowerCase('ru');
    const list=awards.filter(a=>{
      const concealed=a.hidden&&!a.earned;
      return (state.group==='all'||a.group===state.group)&&
        (state.status==='all'||state.status==='earned'&&a.earned||state.status==='locked'&&!a.earned||state.status==='secret'&&a.hidden)&&
        (state.rarity==='all'||!concealed&&a.rarity===state.rarity)&&
        (!query||(concealed?'Скрытая награда':a.name+' '+a.description).toLocaleLowerCase('ru').includes(query));
    });
    result.textContent=`Показано ${list.length} · Получено ${earned.length} · Ещё скрыто ${hidden}`;
    grid.replaceChildren(...list.map(card));if(!list.length)grid.append(h('div.iv-empty',icon('search',28),h('p','Наград по этим условиям пока нет')));
  }
  status.value=state.status;rarity.value=state.rarity;
  status.onchange=()=>{state.status=status.value;paint();};rarity.onchange=()=>{state.rarity=rarity.value;paint();};search.oninput=()=>{state.query=search.value;paint();};
  const marathons=['active-180','active-flex-150','active-streak-180'].map(id=>awards.find(a=>a.id===id));
  host.replaceChildren(h('div.iv-heading',h('div',h('h1','Награды'),h('p','От первых шагов до легендарных привычек'))),summary,
    h('section.aw-marathons',{'aria-label':'Долгосрочные достижения'},...marathons.map(a=>h('div.aw-marathon',
      icon(a.glyph,18),h('div',h('strong',a.name),h('small',a.id==='active-flex-150'?'150 из 183 дней · с пропусками':a.id==='active-streak-180'?'Лучшая серия · 180 дней подряд':'180 активных дней · без срока')),
      h('b',`${a.earned?a.target:a.value} / ${a.target}`),h('progress',{max:a.target,value:a.earned?a.target:a.value,'aria-label':a.description})))),
    tabs,h('div.aw-toolbar',h('div.aw-search',icon('search',16),search),status,rarity),result,grid,
    h('p.aw-explainer','Награды сохраняются после удаления записей и отмены действий, входят в резервную копию. Демо не учитывается. Активный день — день открытия или действия в приложении; фоновая работа не продлевает серию. Учёт посещений начинается с этого обновления. Исторические записи учитываются в достижениях своих разделов, будущие записи журналов и личных метрик — после наступления их даты.'));
  paint();
}
