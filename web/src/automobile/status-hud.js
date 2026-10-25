import {h} from '../ui/dom.js';
import {icon} from '../ui/icons.js';

export function createVehicleStatusHud(cards,onSelect){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('au-status-lines');svg.setAttribute('aria-hidden','true');
 const links=new Map(),row=h('div.au-status-row');
 for(const card of cards){
  const path=document.createElementNS(svg.namespaceURI,'path'),dot=document.createElementNS(svg.namespaceURI,'circle');dot.setAttribute('r','3');svg.append(path,dot);links.set(card.id,{path,dot});
  const tone=card.percent==null?'plain':card.percent>=75?'good':card.percent>=45?'warn':'low';
  const button=h('button.au-status-card',{type:'button','data-status':card.id,'data-tone':tone,'aria-label':`${card.label}: ${card.value} ${card.unit}. Изменить`,title:'Нажмите, чтобы изменить',onclick:()=>onSelect(card.id)},h('span.au-status-caption',icon(card.glyph,14),card.label),h('strong',card.value),card.percent!=null?h('span.au-status-track',h('i',{style:{width:card.percent+'%'}})):h('small',card.unit));
  row.append(button);
 }
 const element=h('div.au-status-hud',svg,row);let previous='';
 return {element,update(anchors,width,height){
  const heading=element.parentElement?.querySelector('.au-model-heading');
  const top=Math.max(width<420?88:94,heading?heading.offsetTop+heading.offsetHeight+10:0),cardHeight=width<420?60:66,padding=width<420?10:16,gap=6,cell=(width-padding*2-gap*3)/4;
  const key=[Math.round(width),Math.round(height),top,...cards.flatMap(c=>[Math.round(anchors[c.id]?.x??-1),Math.round(anchors[c.id]?.y??-1),anchors[c.id]?.visible])].join(':');if(key===previous)return;previous=key;
  row.style.top=top+'px';row.style.height=cardHeight+'px';row.style.left=row.style.right=padding+'px';svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  cards.forEach((card,i)=>{const p=anchors[card.id],{path,dot}=links.get(card.id),visible=Boolean(p?.visible);path.style.display=dot.style.display=visible?'':'none';if(!visible)return;const x=padding+cell/2+i*(cell+gap),y=top+cardHeight;path.setAttribute('d',`M${x} ${y} L${x} ${y+8} L${p.x} ${p.y}`);dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.y);});
 }};
}
