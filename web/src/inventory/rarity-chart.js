import { h } from '../ui/dom.js';
import { rarityDistribution } from './rarity.js';

const svg=(tag,attributes={},...children)=>{
  const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,value] of Object.entries(attributes))el.setAttribute(key,value);
  el.append(...children);return el;
};
const percent=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(value)+'%';
let chartSequence=0;
export function rarityChart(doc) {
  const {rows,total}=rarityDistribution(doc);
  const glowId='iv-rarity-bloom-'+(++chartSequence);
  const chart=svg('svg',{viewBox:'0 0 200 200',class:'iv-rarity-ring',role:'img','aria-label':`Редкость предметов. Всего: ${total}. `+rows.map(r=>`${r.name}: ${r.count}, ${percent(r.percent)}`).join('. ')});
  // Native SVG filters also work in the Mac WebView, without CSS color-mix filters.
  chart.append(svg('defs',{},svg('filter',{id:glowId,x:-60,y:-60,width:320,height:320,filterUnits:'userSpaceOnUse','color-interpolation-filters':'sRGB'},
    svg('feGaussianBlur',{in:'SourceGraphic',stdDeviation:7,result:'wide'}),
    svg('feGaussianBlur',{in:'SourceGraphic',stdDeviation:3,result:'near'}),
    svg('feMerge',{},svg('feMergeNode',{in:'wide'}),svg('feMergeNode',{in:'wide'}),svg('feMergeNode',{in:'near'}),svg('feMergeNode',{in:'SourceGraphic'})))));
  const ring=svg('g',{transform:'rotate(-90 100 100)',fill:'none','stroke-width':20});
  const halos=svg('g',{'aria-hidden':'true',filter:`url(#${glowId})`}),cores=svg('g',{'aria-hidden':'true'});
  ring.append(svg('circle',{cx:100,cy:100,r:70,class:'iv-rarity-track'}));
  ring.append(halos);
  let offset=0;
  for(const row of rows)if(row.count) {
    const gap=row.count===total?0:Math.min(.8,row.percent*.15);
    const arc={cx:100,cy:100,r:70,pathLength:100,'stroke-dasharray':`${row.percent-gap} ${100-row.percent+gap}`,'stroke-dashoffset':-offset};
    const special=['epic','legendary'].includes(row.id);
    ring.append(svg('circle',{...arc,stroke:row.color,'data-rarity':row.id,class:'iv-rarity-segment'},svg('title',{},document.createTextNode(`${row.name}: ${row.count} · ${percent(row.percent)}`))));
    if(special){
      halos.append(svg('circle',{...arc,stroke:row.color,'stroke-width':25,class:'iv-rarity-halo'}));
      cores.append(svg('circle',{...arc,r:79,'stroke-width':2.5,stroke:row.id==='epic'?'#f1c7ff':'#fff0b6'}));
    }
    offset+=row.percent;
  }
  ring.append(cores);
  chart.append(ring,svg('text',{x:100,y:99,'text-anchor':'middle',class:'iv-rarity-total'},document.createTextNode(String(total))),svg('text',{x:100,y:119,'text-anchor':'middle',class:'iv-rarity-total-label'},document.createTextNode('в учёте')));
  const legend=h('ul.iv-rarity-legend',...rows.map(row=>h('li',{'data-rarity':row.id},h('span.iv-rarity-label',row.name),h('strong',String(row.count)),h('small',percent(row.percent)))));
  return h('section.iv-card.iv-rarity-summary',h('h2','Редкость предметов'),h('div.iv-rarity-chart',chart,legend),h('p.iv-muted.iv-rarity-note',total?'Активные вещи во всех пространствах':'Добавьте вещи — здесь появится распределение по редкости.'));
}
