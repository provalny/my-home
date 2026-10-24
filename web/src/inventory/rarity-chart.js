import { h } from '../ui/dom.js';
import { rarityDistribution } from './rarity.js';

const svg=(tag,attributes={},...children)=>{
  const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,value] of Object.entries(attributes))el.setAttribute(key,value);
  el.append(...children);return el;
};
const percent=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(value)+'%';
export function rarityChart(doc) {
  const {rows,total}=rarityDistribution(doc);
  const chart=svg('svg',{viewBox:'0 0 200 200',class:'iv-rarity-ring',role:'img','aria-label':`Редкость предметов. Всего: ${total}. `+rows.map(r=>`${r.name}: ${r.count}, ${percent(r.percent)}`).join('. ')});
  const ring=svg('g',{transform:'rotate(-90 100 100)',fill:'none','stroke-width':20});
  ring.append(svg('circle',{cx:100,cy:100,r:70,class:'iv-rarity-track'}));
  let offset=0;
  for(const row of rows)if(row.count) {
    const gap=row.count===total?0:Math.min(.8,row.percent*.15);
    ring.append(svg('circle',{cx:100,cy:100,r:70,pathLength:100,'stroke-dasharray':`${row.percent-gap} ${100-row.percent+gap}`,'stroke-dashoffset':-offset,stroke:row.color,'data-rarity':row.id,class:'iv-rarity-segment'},svg('title',{},document.createTextNode(`${row.name}: ${row.count} · ${percent(row.percent)}`))));
    offset+=row.percent;
  }
  chart.append(ring,svg('text',{x:100,y:99,'text-anchor':'middle',class:'iv-rarity-total'},document.createTextNode(String(total))),svg('text',{x:100,y:119,'text-anchor':'middle',class:'iv-rarity-total-label'},document.createTextNode('в учёте')));
  const legend=h('ul.iv-rarity-legend',...rows.map(row=>h('li',{'data-rarity':row.id},h('span.iv-rarity-label',row.name),h('strong',String(row.count)),h('small',percent(row.percent)))));
  return h('section.iv-card.iv-rarity-summary',h('h2','Редкость предметов'),h('div.iv-rarity-chart',chart,legend),h('p.iv-muted.iv-rarity-note',total?'Активные вещи во всех пространствах':'Добавьте вещи — здесь появится распределение по редкости.'));
}
