import { h } from '../ui/dom.js';
import { RECT_CONTOUR, validateContour } from '../geometry/room.js';
export function roomContourForm(room, apply) {
  let points=(room.contour||RECT_CONTOUR).map(p=>[...p]);
  const root=h('div'),list=h('div'),error=h('p.note',{role:'alert'});
  const presets=h('select',{'aria-label':'Форма комнаты'},[['','Выберите форму…'],['rectangle','Прямоугольник'],['bevel','Срезанный угол'],['notch','Выступ вентиляции в углу'],['wallNotch','Выступ вентиляции у стены']].map(([value,label])=>h('option',{value},label)));
  presets.onchange=()=>{
    const forms={rectangle:RECT_CONTOUR,bevel:[[0,0],[.8,0],[1,.2],[1,1],[0,1]],notch:[[0,0],[.8,0],[.8,.2],[1,.2],[1,1],[0,1]],wallNotch:[[0,0],[.4,0],[.4,.15],[.6,.15],[.6,0],[1,0],[1,1],[0,1]]};
    if(forms[presets.value]){points=forms[presets.value].map(p=>[...p]);draw();}
  };
  function draw(){list.replaceChildren(...points.map((p,i)=>{
    const input=(axis)=>{const size=room.rect[axis+2],el=h('input',{type:'number',min:0,max:size,step:.01,value:Number((p[axis]*size).toFixed(3)),'aria-label':`Угол ${i+1}: ${axis?'Z':'X'}, м`});el.onchange=()=>{p[axis]=Number(el.value)/size;};return el;};
    return h('div',h('b',`Угол ${i+1}`),h('div.fields',h('label.field',h('span','X, м'),input(0)),h('label.field',h('span','Z, м'),input(1))),
      h('button.btn',{type:'button',disabled:points.length>=64,onclick:()=>{const next=points[(i+1)%points.length];points.splice(i+1,0,[(p[0]+next[0])/2,(p[1]+next[1])/2]);draw();}},'Добавить угол после'),
      h('button.btn',{type:'button',disabled:points.length<=3,onclick:()=>{points.splice(i,1);draw();}},'Убрать угол'));
  }));}
  root.append(h('p.note','Выберите заготовку и задайте углы по порядку вдоль стен. X и Z отсчитываются от верхнего левого угла габаритов комнаты. Размеры — в метрах.'),presets,list,error,
    h('button.btn.wide',{onclick:()=>{try{validateContour(points);apply(points.map(p=>[...p]));}catch(e){error.textContent=e.message;}}},'Применить форму комнаты'));
  draw();return root;
}
