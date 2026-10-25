import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box,at,rng } from './kit.js';
import { extraDimensions } from './furniture-info.js';

// Original geometry of the first-generation wagon. Metres, front +Z, width includes mirrors.
export const VESTA_SIZE=[2.045,1.537,4.424];
export const VESTA_PARTS=['frontLeft','frontRight','rearLeft','rearRight','tailgate','hood'];
const clamp=n=>Number.isFinite(Number(n))?THREE.MathUtils.clamp(Number(n),0,1):0;
const vec=p=>new THREE.Vector3(...p);
const mesh=(g,geo,mat,name='')=>{const o=new THREE.Mesh(geo,mat);o.name=name;g.add(o);return o;};
const block=(g,w,h,d,x,y,z,mat,r=.008,name='')=>{const o=at(box(w,h,d,mat,{r}),x,y,z);o.name=name;g.add(o);return o;};
function rod(g,a,b,r,mat,name='',sides=8){const v=vec(b).sub(vec(a)),o=mesh(g,new THREE.CylinderGeometry(r,r,v.length(),sides),mat,name);o.position.copy(vec(a).add(vec(b)).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;}
function face(g,points,mat,name=''){
 const normal=vec(points[1]).sub(vec(points[0])).cross(vec(points[2]).sub(vec(points[0]))),axis=Math.abs(normal.x)>Math.abs(normal.z)?0:2;
 const outline=points.map(p=>new THREE.Vector2(p[axis===0?2:0],p[1]));
 const indices=THREE.ShapeUtils.triangulateShape(outline,[]).flat(),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));geo.setIndex(indices);geo.computeVertexNormals();
 return mesh(g,geo,mat,name);
}
function quad(g,p,mat,name=''){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p.flat(),3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();return mesh(g,geo,mat,name);}
function line(g,p,r,m,name=''){for(let i=1;i<p.length;i++)rod(g,p[i-1],p[i],r,m,name);}
const bodyX=(y,z)=>y>.98?glassX(y):.824+.036*Math.sin(clamp((y-.32)/.67)*Math.PI)-.035*clamp((Math.abs(z)-1.65)/.56);
const glassX=y=>.822-(y-.98)*.39;
function side(g,outline,s,mat,name='',offset=0,thickness=.022){
 const shape=new THREE.Shape(outline.map(([z,y])=>new THREE.Vector2(z,y)));
 const source=new THREE.ExtrudeGeometry(shape,{depth:thickness,steps:1,bevelEnabled:false,curveSegments:1}),p=source.attributes.position,positions=[],normals=[];
 const emit=(a,b,c,flat)=>{const sources=s>0?[a,c,b]:[a,b,c],points=sources.map(v=>new THREE.Vector3(s*(bodyX(v.y,v.x)+offset+v.z-thickness),v.y,v.x)),normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
  points.forEach((point,i)=>{positions.push(...point.toArray());if(flat){const src=sources[i],dy=(bodyX(src.y+.0001,src.x)-bodyX(src.y-.0001,src.x))/.0002,dz=(bodyX(src.y,src.x+.0001)-bodyX(src.y,src.x-.0001))/.0002,n=new THREE.Vector3(s,-dy,-dz).normalize().multiplyScalar(src.z<thickness*.5?-1:1);normals.push(...n.toArray());}else normals.push(...normal.toArray());});};
 for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2),flat=Math.abs(a.z-b.z)<1e-6&&Math.abs(a.z-c.z)<1e-6;
  if(!flat){emit(a,b,c,false);continue;}const n=6,at=(u,v)=>a.clone().multiplyScalar(1-(u+v)/n).addScaledVector(b,u/n).addScaledVector(c,v/n);
  for(let u=0;u<n;u++)for(let v=0;v<n-u;v++){emit(at(u,v),at(u+1,v),at(u,v+1),true);if(u+v<n-1)emit(at(u+1,v),at(u+1,v+1),at(u,v+1),true);}
 }
 source.dispose();const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return mesh(g,geo,mat,name);
}
function batch(g){
 for(const c of [...g.children])if(c.isGroup)batch(c);
 const bins=new Map();for(const c of g.children)if(c.isMesh&&!c.material.transparent){const list=bins.get(c.material)||[];list.push(c);bins.set(c.material,list);}
 for(const [m,parts]of bins){if(parts.length<2)continue;const geos=parts.map(p=>{p.updateMatrix();const geo=p.geometry.index?p.geometry.toNonIndexed():p.geometry.clone();for(const key of Object.keys(geo.attributes))if(!['position','normal'].includes(key))geo.deleteAttribute(key);return geo.applyMatrix4(p.matrix);});const geo=mergeGeometries(geos);geos.forEach(g=>g.dispose());parts.forEach(p=>{g.remove(p);p.geometry.dispose();});mesh(g,geo,m,m.name);}
}
function dirtMap(){const w=128,h=64,data=new Uint8Array(w*h*4),random=rng(2019);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,t=y/h,noise=random(),dust=Math.max(0,1-t*1.8);data.set([111,94,70,Math.round(255*dust*(noise>.90?.9:noise*.18))],i);}const t=new THREE.DataTexture(data,w,h);t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;}
const LETTERS={L:['100','100','100','100','111'],A:['010','101','111','101','101'],D:['110','101','101','101','110'],V:['101','101','101','101','010'],E:['111','100','110','100','111'],S:['111','100','111','001','111'],T:['111','010','010','010','010'],W:['10101','10101','10101','10101','01010'],C:['111','100','100','100','111'],R:['110','101','110','101','101'],O:['111','101','101','101','111']};
function lettering(g,text,center,y,z,size,material,back=false){const width=[...text].reduce((sum,c)=>sum+(LETTERS[c]?.[0].length||2)+1,0)-1;let x=-width*size/2;for(const c of text){const rows=LETTERS[c];if(rows)rows.forEach((row,j)=>[...row].forEach((v,i)=>{if(v==='1')block(g,size*.86,size*.86,.002,center+(back?-1:1)*(x+i*size),y+(4-j)*size,z,material,0);}));x+=((rows?.[0].length||2)+1)*size;}}

export function buildVestaSwCross(shape={}){
 const root=new THREE.Group(),inner=new THREE.Group();root.name='LADA Vesta SW Cross 2019';root.add(inner);
 const standard=(color,name,roughness=.6,metalness=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness,side:THREE.DoubleSide});m.name=name;return m;};
 const paint=new THREE.MeshPhysicalMaterial({color:shape.color||'#d65b24',roughness:.40,metalness:.26,clearcoat:.35,clearcoatRoughness:.32,side:THREE.DoubleSide});paint.name='Краска кузова';
 const shade=paint.clone();shade.name='Углубления штамповки';const highlight=paint.clone();highlight.name='Кромки кузова';
 const trim=standard('#25282b','Матовый обвес Cross',.88),rubber=standard('#111519','Шины и уплотнители',.94),chrome=standard('#bdc5c9','Хром и диски',.26,.82),alloy=standard('#343b42','Тёмные грани дисков',.40,.66),inside=standard('#35383b','Обивка салона',.96),seatInsert=standard('#7a6357','Вставки сидений',.92),red=standard('#9e1420','Задние фонари',.24),white=standard('#c9d7dd','Отражатели',.24,.15),plate=standard('#e9e7dd','Номерная табличка',.64);
 const glass=new THREE.MeshPhysicalMaterial({color:'#273844',transparent:true,opacity:.68,roughness:.12,metalness:.12,clearcoat:.7,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true});glass.name='Тонированные стёкла';
 const lamp=standard('#e0e9ed','Передние фары',.20,.25);lamp.emissive.set('#e0edff');
 const dirt=new THREE.MeshStandardMaterial({map:dirtMap(),transparent:true,depthWrite:false,side:THREE.DoubleSide,roughness:1,polygonOffset:true,polygonOffsetFactor:-1});dirt.name='Дорожная пыль';
 const openings=[],headlights=[];
 function hinge(key,position,axis,angle,duration=1.1){const pivot=new THREE.Group(),body=new THREE.Group();pivot.name=key;pivot.position.set(...position);body.position.copy(pivot.position).negate();pivot.add(body);inner.add(pivot);openings.push({key,pivot,axis,angle,duration});return body;}
 function dusty(part,s){const geo=part.geometry.clone(),p=geo.attributes.position,uv=[];for(let i=0;i<p.count;i++){p.setX(i,p.getX(i)+s*.0015);uv.push((p.getZ(i)+2.212)/4.424,clamp((p.getY(i)-.28)/.75));}geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));mesh(part.parent,geo,dirt,'Пыль');}
 function panel(g,points,s,name,m=paint){const o=side(g,points,s,m,name);if(m===paint)dusty(o,s);return o;}
 function window(g,outline,s,name){
  const corners=outline.map(p=>new THREE.Vector2(...p)),rounded=[];
  for(let i=0;i<corners.length;i++){const c=corners[i],before=corners[(i+corners.length-1)%corners.length],after=corners[(i+1)%corners.length],r=Math.min(.033,c.distanceTo(before)*.20,c.distanceTo(after)*.20),a=c.clone().addScaledVector(before.clone().sub(c).normalize(),r),b=c.clone().addScaledVector(after.clone().sub(c).normalize(),r);for(let j=0;j<=4;j++){const t=j/4;rounded.push(a.clone().multiplyScalar((1-t)**2).addScaledVector(c,2*t*(1-t)).addScaledVector(b,t*t));}}
  const p=rounded.map(v=>[s*glassX(v.y),v.y,v.x]);face(g,p,glass,name);line(g,[...p,p[0]],.006,rubber,'Уплотнитель стекла');
 }
 // Hollow underbody, sills and body panels with actual wheel openings.
 block(inner,1.46,.055,3.45,0,.230,-.05,rubber,.018,'Днище');
 block(inner,1.49,.05,2.73,0,.345,-.55,inside,.015,'Пол салона');
 const arc=(z,r,a,b,n=12)=>Array.from({length:n+1},(_,i)=>{const t=a+(b-a)*i/n;return [z+r*Math.cos(t),.318+r*Math.sin(t)];});
 for(const s of [-1,1]){
  panel(inner,[[.786,.336],[.786,.986],[1.05,.964],[1.87,.941],[2.034,.888],[2.034,.336],...arc(1.350,.368,0,Math.PI)],s,'Переднее крыло');
  panel(inner,[[-1.17,.991],[-1.67,1.005],[-2.035,.978],[-2.025,.336],...arc(-1.285,.368,Math.PI,1.255)],s,'Заднее крыло');
  panel(inner,[[-1.86,1.059],[-1.49,1.384],[-1.69,1.410],[-2.075,1.040],[-2.035,.978]],s,'Задняя стойка');
  block(inner,.056,.100,1.74,s*.815,.251,-.08,trim,.015,'Накладка порога');
  block(inner,.012,.014,1.61,s*.848,.283,-.08,chrome,.003,'Серебристая линия порога');
  for(const z of [1.350,-1.285]){
   const points=[];for(let i=0;i<=20;i++){const a=-.045+i*(Math.PI+.09)/20;points.push([s*.875,.318+Math.sin(a)*.398,z+Math.cos(a)*.398]);}
   for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],aa=[s*.872,.318+(a[1]-.318)*.911,z+(a[2]-z)*.911],bb=[s*.872,.318+(b[1]-.318)*.911,z+(b[2]-z)*.911];quad(inner,[a,b,bb,aa],trim,'Арка Cross');}
   line(inner,points,.010,trim,'Наружная кромка арки');
   const arch=arc(z,.359,0,Math.PI,20).map(([zz,y])=>[s*.835,y,zz]);line(inner,arch,.013,rubber,'Внутренняя кромка арки');
  }
  // Each door carries its glass, handle and interior trim on a real hinge.
  const front=hinge(s<0?'frontLeft':'frontRight',[s*.806,.73,.778],'y',-s*1.15);
  panel(front,[[.771,.345],[.771,.978],[-.325,.982],[-.325,.345]],s,'Передняя дверь');
  const rear=hinge(s<0?'rearLeft':'rearRight',[s*.808,.74,-.351],'y',-s*1.12);
  panel(rear,[[-.345,.345],[-.345,.982],[-1.168,.984],[-1.172,.667],[-1.08,.625],[-.980,.514],[-.922,.345]],s,'Задняя дверь');
  for(const [g,isFront]of [[front,true],[rear,false]]){
   const z=isFront?-.21:-1.05;
   block(g,.035,.032,.145,s*(bodyX(.916,z)+.013),.902,z,paint,.012,'Ручка двери');
   block(g,.006,.013,.095,s*(bodyX(.916,z)+.033),.906,z,chrome,.004);
   block(g,.037,.37,isFront?.87:.60,s*.784,.46,isFront?.22:-.68,inside,.023,'Внутренняя обивка двери');
   block(g,.07,.045,.32,s*.743,.735,isFront?.16:-.72,trim,.009,'Подлокотник');
  }
  window(front,[[.735,1.005],[.123,1.401],[-.282,1.413],[-.282,1.001]],s,'Стекло передней двери');
  window(rear,[[-.373,1.001],[-.373,1.413],[-1.117,1.387],[-1.176,1.017]],s,'Стекло задней двери');
  window(inner,[[-1.224,1.021],[-1.174,1.383],[-1.507,1.374],[-1.892,1.069]],s,'Задняя форточка');
  const a=[[s*.823,.992,.785],[s*.661,1.424,.112]],b=[[s*.663,1.427,-.325],[s*.824,.986,-.325]];
  line(inner,a,.023,paint,'Передняя стойка');line(inner,b,.026,rubber,'Средняя стойка');
  line(front,[[s*.665,1.426,.113],[s*.665,1.435,-.307]],.018,paint,'Рамка передней двери');
  line(rear,[[s*.666,1.433,-.355],[s*.677,1.412,-1.137],[s*.812,1.015,-1.195]],.017,paint,'Рамка задней двери');
  line(front,[[s*.827,.990,.765],[s*.827,.990,-.315]],.006,chrome,'Окантовка переднего окна');line(rear,[[s*.827,.990,-.350],[s*.827,.990,-1.17]],.006,chrome,'Окантовка заднего окна');line(inner,[[s*.827,.990,-1.20],[s*.810,1.035,-1.93]],.006,chrome,'Окантовка форточки');
  // Two narrow pressed chevrons follow the curved door surface.
  for(const [g,path]of [[front,[[.735,.876],[.370,.723],[.719,.492]]],[rear,[[-1.135,.906],[-.803,.730],[-1.050,.542]]]]){
   for(let segment=1;segment<path.length;segment++)for(let i=0;i<12;i++){
    const a=path[segment-1],b=path[segment],za=a[0]+(b[0]-a[0])*i/12,zb=a[0]+(b[0]-a[0])*(i+1)/12,ya=a[1]+(b[1]-a[1])*i/12,yb=a[1]+(b[1]-a[1])*(i+1)/12;
    quad(g,[[s*(bodyX(ya,za)+.002),ya,za],[s*(bodyX(yb,zb)+.002),yb,zb],[s*(bodyX(yb-.018,zb)+.001),yb-.018,zb],[s*(bodyX(ya-.018,za)+.001),ya-.018,za]],shade,'X-выштамповка');
   }
  }
  // Mirror housings sit on triangular feet, on the opening front door.
  side(front,[[.745,1.009],[.603,1.102],[.547,1.009]],s,rubber,'Основание зеркала',.015,.02);
  rod(front,[s*.83,1.055,.610],[s*.943,1.06,.615],.022,trim);
  block(front,.160,.080,.180,s*.948,1.045,.621,paint,.032,'Зеркало');
  block(front,.145,.025,.178,s*.948,1.030,.621,rubber,.009,'Нижняя часть зеркала');
  block(front,.130,.060,.004,s*.948,1.057,.529,chrome,.007,'Зеркальное стекло');
  block(front,.144,.007,.005,s*.948,1.051,.709,white,.002,'Повторитель поворота');
 }
 for(const s of [-1,1])for(let i=0;i<12;i++){
  const p=[];for(const [j,outer]of [[i,0],[i,1],[i+1,1],[i+1,0]]){const t=j/12,z=.795+t*1.265,w=.792-.055*t,y=.987-.108*t;p.push(outer?[s*bodyX(y+.025,z),y+.025,z-.055*t]:[s*(w+.004),y,z-.055*t]);}quad(inner,p,paint,'Плечо переднего крыла');
 }
 // Curved roof strips and silver longitudinal rails. No roof box or other accessories.
 const roofSections=[[-1.710,.550,1.397],[-1.505,.648,1.458],[-.85,.663,1.477],[-.30,.663,1.476],[.115,.637,1.438]];
 for(let i=1;i<roofSections.length;i++)for(let j=0;j<8;j++){
  const p=[];for(const [row,col]of [[i-1,j],[i-1,j+1],[i,j+1],[i,j]]){const [z,w,y]=roofSections[row],t=col/4-1;p.push([w*t,y-.028*t*t,z]);}quad(inner,p,paint,'Панель крыши');
 }
 for(const s of [-1,1]){
  line(inner,roofSections.map(([z,w,y])=>[s*w,y-.024,z]),.012,paint,'Водосток крыши');
  for(const z of [.0,-1.42])block(inner,.043,.034,.12,s*.586,1.455,z,trim,.01,'Опора рейлинга');
  line(inner,[[s*.586,1.473,.09],[s*.592,1.516,-.10],[s*.601,1.521,-.90],[s*.582,1.482,-1.49]],.015,chrome,'Рейлинг');
 }
 face(inner,[[0,1.477,-1.27],[0,1.529,-1.29],[0,1.477,-1.38]],paint,'Антенна-плавник');
 const wind=[[-.798,1.010,.768],[.798,1.010,.768],[.622,1.414,.128],[-.622,1.414,.128]];
 quad(inner,wind,glass,'Лобовое стекло');line(inner,[...wind,wind[0]],.010,rubber,'Уплотнитель лобового стекла');
 for(const x of [-.40,.30]){rod(inner,[x-.20,1.025,.740],[x+.20,1.039,.720],.009,trim,'Дворник');rod(inner,[x-.17,1.010,.771],[x+.10,1.034,.724],.005,trim);}
 const hood=hinge('hood',[0,.994,.779],'x',-1.08,1.25);
 for(let i=0;i<6;i++)for(let j=0;j<10;j++){
  const p=[];for(const [row,col]of [[i,j],[i,j+1],[i+1,j+1],[i+1,j]]){const t=row/6,u=col/5-1,z=.795+t*1.265,w=.792-.055*t,y=.987-.108*t+.023*(1-u*u);p.push([u*w,y,z-.055*u*u*t]);}quad(hood,p,paint,'Капот');
 }
 for(const s of [-1,1])line(hood,[[s*.42,1.009,.82],[s*.48,.962,1.37],[s*.55,.911,2.03]],.004,highlight,'Ребро капота');
 quad(hood,[[-.64,.960,.86],[.64,.960,.86],[.58,.872,1.97],[-.58,.872,1.97]],trim,'Теплоизоляция капота');
 block(inner,1.42,.06,1.17,0,.442,1.39,trim,.01,'Моторный отсек');
 block(inner,1.41,.35,.045,0,.47,.795,trim,.01,'Моторный щит');
 block(inner,.64,.25,.55,0,.56,1.39,alloy,.023,'Двигатель');block(inner,.54,.045,.46,0,.81,1.39,trim,.023,'Крышка двигателя');
 for(let i=0;i<5;i++)block(inner,.36,.012,.015,0,.855,1.24+i*.07,chrome,.002);
 block(inner,.28,.22,.29,-.50,.61,1.11,trim,.01,'Аккумулятор');block(inner,.05,.02,.04,-.59,.83,1.15,red,.003);
 block(inner,.23,.17,.25,.54,.62,1.02,plate,.03,'Расширительный бачок');block(inner,.06,.02,.06,.54,.79,1.02,rubber,.01);
 block(inner,1.25,.27,.07,0,.54,1.989,alloy,.006,'Радиатор');
 // Original 2019 front fascia: swept halogen lamps and X-shaped chrome cheeks.
 const frontZ=x=>2.196-.17*(Math.abs(x)/.88)**2;
 const fascia=(pts,m,name,offset=0)=>{
  const geo=new THREE.ShapeGeometry(new THREE.Shape(pts.map(p=>new THREE.Vector2(...p)))),base=geo.index?geo.toNonIndexed():geo,src=base.attributes.position,positions=[],normals=[];
  const emit=p=>{const z=frontZ(p.x)+offset,n=new THREE.Vector3(.34*p.x/(.88*.88),0,1).normalize();positions.push(p.x,p.y,z);normals.push(...n.toArray());};
  for(let i=0;i<src.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(src,i),b=new THREE.Vector3().fromBufferAttribute(src,i+1),c=new THREE.Vector3().fromBufferAttribute(src,i+2),n=6,at=(u,v)=>a.clone().multiplyScalar(1-(u+v)/n).addScaledVector(b,u/n).addScaledVector(c,v/n);for(let u=0;u<n;u++)for(let v=0;v<n-u;v++){[at(u,v),at(u+1,v),at(u,v+1)].forEach(emit);if(u+v<n-1)[at(u+1,v),at(u+1,v+1),at(u,v+1)].forEach(emit);}}
  geo.dispose();if(base!==geo)base.dispose();const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));out.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return mesh(inner,out,m,name);
 };
 fascia([[-.84,.34],[-.86,.74],[-.74,.879],[.74,.879],[.86,.74],[.84,.34]],paint,'Передний бампер');
 fascia([[-.68,.359],[-.46,.652],[-.59,.755],[-.58,.870],[.58,.870],[.59,.755],[.46,.652],[.68,.359]],rubber,'X-решётка',.009);
 for(const y of [.779,.817,.850]){const p=[];for(let i=0;i<=12;i++){const x=-.55+i*1.10/12;p.push([x,y,frontZ(x)+.018]);}line(inner,p,.006,chrome,'Ламель решётки');}
 for(let i=0;i<19;i++){const x=-.54+i*.06;rod(inner,[x,.395,frontZ(x)+.012],[x,.535,frontZ(x)+.012],.0035,alloy,'Сетка воздухозаборника');}
 const oval=mesh(inner,new THREE.TorusGeometry(.055,.006,6,24),chrome,'Эмблема LADA');oval.scale.x=1.7;oval.position.set(0,.823,2.222);
 line(inner,[[.015,.862,2.225],[-.022,.835,2.225],[.021,.826,2.225],[-.028,.797,2.225],[.024,.797,2.225]],.005,chrome,'Ладья');
 block(inner,.520,.110,.012,0,.579,2.216,plate,.003,'Передний номер');lettering(inner,'VESTA SW',0,.600,2.224,.010,trim);
 for(const s of [-1,1]){
  const pts=[[.487,.777],[.529,.890],[.807,.905],[.846,.879],[.835,.790],[.673,.748]].map(([x,y])=>[s*x,y,frontZ(x)+.013]);
  face(inner,pts,alloy,'Корпус фары');quad(inner,[[s*.846,.900,frontZ(.846)+.014],[s*.851,.936,1.851],[s*.852,.863,1.875],[s*.847,.792,frontZ(.847)+.014]],alloy,'Боковой отражатель фары');const cover=glass.clone();cover.name='Прозрачная линза фары';cover.opacity=.18;cover.color.set('#c9dce6');const pane=face(inner,pts.map(([x,y,z])=>[x,y,z+.038]),cover,'Стекло фары');pane.userData.noShadow=true;
  for(const [x,y,r]of [[.621,.814,.050],[.754,.848,.046]]){const reflect=mesh(inner,new THREE.CircleGeometry(r,20),chrome,'Рефлектор');reflect.position.set(s*x,y,frontZ(x)+.024);const inset=mesh(inner,new THREE.CircleGeometry(r*.80,20),alloy,'Отражатель фары');inset.position.set(s*x,y,frontZ(x)+.027);const lens=mesh(inner,new THREE.CircleGeometry(r*.40,20),lamp,'Линза фары');lens.position.set(s*x,y,frontZ(x)+.029);}
  line(inner,[[s*.513,.778,frontZ(.513)+.030],[s*.669,.756,frontZ(.669)+.030],[s*.818,.792,frontZ(.818)+.030]],.009,lamp,'Дневной свет');
  line(inner,[[s*.49,.744,frontZ(.49)+.023],[s*.356,.656,frontZ(.356)+.023],[s*.499,.385,frontZ(.499)+.023],[s*.725,.371,frontZ(.725)+.023]],.016,chrome,'Хромированный X');
  fascia([[s*.523,.432],[s*.782,.442],[s*.781,.591],[s*.650,.592]],rubber,'Ниша противотуманки',.012);
  const fog=mesh(inner,new THREE.CircleGeometry(.034,16),lamp,'Противотуманная фара');fog.position.set(s*.715,.503,frontZ(.715)+.025);
  const light=new THREE.SpotLight('#e0edff',0,10,.36,.66,1.5);light.position.set(s*.65,.813,2.08);light.lookAt(s*.88,0,6.7);light.target.position.set(0,0,-1);light.add(light.target);inner.add(light);headlights.push(light);
 }
 fascia([[-.84,.33],[-.81,.400],[-.59,.373],[.59,.373],[.81,.400],[.84,.33],[.73,.270],[-.73,.270]],trim,'Нижняя защита бампера',.015);
 fascia([[-.54,.287],[-.54,.335],[.54,.335],[.54,.287]],chrome,'Передняя серебристая защита',.022);
 // Tailgate follows the roof taper, with wraparound lamps on both body and hatch.
 const hatch=hinge('tailgate',[0,1.410,-1.685],'x',1.50,1.3);
 const hatchGlass=[[-.574,1.382,-1.72],[.574,1.382,-1.72],[.722,1.066,-2.077],[-.722,1.066,-2.077]];
 quad(hatch,hatchGlass,glass,'Заднее стекло');line(hatch,[...hatchGlass,hatchGlass[0]],.013,rubber,'Рамка заднего стекла');
 quad(hatch,[[-.73,1.058,-2.077],[.73,1.058,-2.077],[.731,.548,-2.169],[-.731,.548,-2.169]],paint,'Дверь багажника');
 quad(hatch,[[-.70,1.045,-2.048],[.70,1.045,-2.048],[.70,.57,-2.138],[-.70,.57,-2.138]],inside,'Обшивка пятой двери');
 for(const s of [-1,1])quad(hatch,[[s*.73,1.058,-2.077],[s*.731,.548,-2.169],[s*.70,.57,-2.138],[s*.70,1.045,-2.048]],paint,'Торец пятой двери');
 for(const s of [-1,1])quad(hatch,[[s*.572,1.401,-1.699],[s*.646,1.397,-1.710],[s*.778,1.059,-2.067],[s*.721,1.059,-2.077]],paint,'Боковина багажника');
 block(hatch,1.23,.028,.135,0,1.394,-1.718,paint,.013,'Спойлер');block(hatch,.35,.013,.008,0,1.389,-1.815,red,.003,'Стоп-сигнал');
 rod(hatch,[-.23,1.104,-2.043],[.22,1.104,-2.043],.009,trim,'Задний дворник');
 lettering(hatch,'L A D A',0,.977,-2.104,.009,chrome,true);
 block(hatch,.520,.110,.013,0,.731,-2.143,plate,.003,'Задний номер');lettering(hatch,'VESTA SW',0,.755,-2.153,.0095,trim,true);
 block(hatch,.23,.020,.019,0,.858,-2.127,trim,.004,'Ручка пятой двери');
 for(const s of [-1,1]){
  const outer=[[s*.744,1.025,-2.105],[s*.849,1.011,-1.944],[s*.865,.914,-1.994],[s*.752,.854,-2.138]];
  quad(inner,outer,red,'Наружный задний фонарь');
  const inset=[[s*.735,1.022,-2.109],[s*.447,.984,-2.124],[s*.500,.861,-2.147],[s*.735,.854,-2.145]];
  quad(hatch,inset,red,'Фонарь на пятой двери');
  line(hatch,[[s*.717,.976,-2.133],[s*.484,.949,-2.137]],.014,white,'Светлая секция заднего фонаря');
  line(inner,[[s*.752,.976,-2.120],[s*.836,.974,-1.982]],.014,white);
  line(hatch,[[s*.719,.883,-2.155],[s*.531,.888,-2.151],[s*.482,.973,-2.138]],.008,red,'Рисунок заднего фонаря');
 }
 for(let j=0;j<24;j++)for(const [lo,hi,mat]of [[.23,.37,trim],[.37,.55,paint]]){
  const p=[];for(const [i,y]of [[j,lo],[j+1,lo],[j+1,hi],[j,hi]]){const x=-.86+i*1.72/24,z=-2.19+.19*(Math.abs(x)/.86)**4;p.push([x,y,z]);}quad(inner,p,mat,'Задний бампер');
 }
 for(const s of [-1,1])quad(inner,[[s*.733,.55,-2.169],[s*.733,.935,-2.100],[s*.80,.978,-2.035],[s*.831,.55,-2.025]],paint,'Закругление заднего крыла');
 block(inner,1.24,.08,.018,0,.243,-2.186,chrome,.019,'Задний диффузор');block(inner,.23,.027,.012,0,.303,-2.201,red,.004,'Задний отражатель');
 for(const x of [-.56,-.43]){const pipe=mesh(inner,new THREE.CylinderGeometry(.035,.035,.13,14),chrome,'Насадка выхлопа');pipe.rotation.x=Math.PI/2;pipe.position.set(x,.270,-2.157);const hole=mesh(inner,new THREE.CircleGeometry(.028,14),rubber);hole.rotation.y=Math.PI;hole.position.set(x,.270,-2.224);}
 // Visible passenger compartment and flat 480-litre luggage floor.
 for(const x of [-.42,.42]){
  block(inner,.45,.13,.49,x,.41,.0,inside,.045,'Переднее сиденье');const back=block(inner,.45,.48,.115,x,.51,-.24,inside,.036,'Спинка сиденья');back.rotation.x=-.10;
  block(inner,.29,.13,.09,x,1.00,-.28,inside,.022,'Подголовник');block(inner,.30,.019,.35,x,.543,.0,seatInsert,.018);block(inner,.28,.29,.018,x,.64,-.159,seatInsert,.014);
 }
 block(inner,1.28,.12,.46,0,.43,-.85,inside,.035,'Задний диван');block(inner,1.28,.43,.11,0,.54,-1.09,inside,.028,'Задняя спинка');
 for(const x of [-.43,0,.43])block(inner,.22,.12,.09,x,.978,-1.11,inside,.02,'Задний подголовник');
 block(inner,1.48,.18,.30,0,.78,.615,trim,.03,'Торпедо');block(inner,.29,.15,.02,0,.883,.454,alloy,.006,'Экран мультимедиа');block(inner,.24,.102,.005,0,.908,.442,rubber,.002);
 const wheel=mesh(inner,new THREE.TorusGeometry(.145,.018,8,28),rubber,'Руль');wheel.position.set(-.43,.910,.336);wheel.rotation.x=-.28;
 for(const x of [-.43]){rod(inner,[x-.13,.91,.34],[x+.13,.91,.34],.017,alloy);rod(inner,[x,.91,.34],[x,.79,.31],.018,alloy);}
 block(inner,.20,.15,.65,0,.37,.16,trim,.02,'Тоннель');rod(inner,[0,.52,.25],[0,.65,.22],.012,chrome);block(inner,.045,.035,.055,0,.64,.22,trim,.009,'Рычаг КПП');
 block(inner,1.42,.033,.89,0,.490,-1.618,inside,.008,'Пол багажника');for(const s of [-1,1])block(inner,.17,.22,.67,s*.68,.522,-1.58,trim,.025,'Обшивка колёсной ниши');
 // 205/50 R17 road tyres with five split two-tone spokes.
 for(const s of [-1,1])for(const z of [1.350,-1.285]){
  const g=new THREE.Group();g.name='Колесо 17 дюймов';g.userData.wheel=true;g.position.set(s*.762,.318,z);g.rotation.z=-s*Math.PI/2;inner.add(g);
  const profile=[[.213,-.095],[.277,-.104],[.310,-.081],[.318,-.056],[.318,.056],[.310,.081],[.277,.104],[.213,.095],[.213,-.095]].map(p=>new THREE.Vector2(...p));mesh(g,new THREE.LatheGeometry(profile,40),rubber,'Покрышка');
  for(const y of [-.039,0,.039]){const tread=mesh(g,new THREE.TorusGeometry(.318,.002,4,40),alloy,'Канавка протектора');tread.rotation.x=Math.PI/2;tread.position.y=y;}
  const rim=mesh(g,new THREE.CylinderGeometry(.216,.216,.170,40),alloy,'Обод');const brake=mesh(g,new THREE.CylinderGeometry(.176,.176,.014,28),chrome,'Тормозной диск');brake.position.y=.077;
  const recess=mesh(g,new THREE.CylinderGeometry(.200,.200,.016,40),rubber);recess.position.y=.090;
  const lip=mesh(g,new THREE.TorusGeometry(.207,.009,6,40),chrome);lip.rotation.x=Math.PI/2;lip.position.y=.104;
  for(let i=0;i<5;i++)for(const b of [-1,1]){
   const a=i/5*Math.PI*2,aa=a+b*.18,pa=[Math.sin(a)*.05,.107,Math.cos(a)*.05],pb=[Math.sin(aa)*.199,.107,Math.cos(aa)*.199];
   rod(g,pa,pb,.020,alloy,'Тёмная спица',4);rod(g,[pa[0],.119,pa[2]],[pb[0],.119,pb[2]],.014,chrome,'Полированная спица',4);
  }
  const hub=mesh(g,new THREE.CylinderGeometry(.046,.046,.023,16),chrome);hub.position.y=.111;const cap=mesh(g,new THREE.CylinderGeometry(.025,.025,.025,16),alloy);cap.position.y=.114;
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5,bolt=mesh(g,new THREE.CylinderGeometry(.007,.007,.012,6),rubber);bolt.position.set(Math.sin(a)*.036,.128,Math.cos(a)*.036);}
 }
 batch(inner);inner.traverse(o=>{if(o.isMesh&&o.material===glass)o.userData.noShadow=true;});
 const bounds=new THREE.Box3().setFromObject(inner),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());inner.position.set(-center.x,-bounds.min.y,-center.z);
 const dims=extraDimensions({type:'vestaSwCross2019',...shape})||VESTA_SIZE;root.scale.set(dims[0]/size.x,dims[1]/size.y,dims[2]/size.z);
 openings.sort((a,b)=>VESTA_PARTS.indexOf(a.key)-VESTA_PARTS.indexOf(b.key));
 const transitions=new Map();let time=null,lightingScale=1,lampsOn=false;
 const setOpen=(key,value)=>{const p=openings.find(p=>p.key===key);if(p)p.pivot.rotation[p.axis]=p.angle*clamp(value);transitions.delete(key);};
 const animateOpen=(key,value)=>{const p=openings.find(p=>p.key===key);if(!p)return;const from=p.pivot.rotation[p.axis],to=p.angle*clamp(value);if(Math.abs(to-from)<1e-6){setOpen(key,value);return;}transitions.set(key,{p,from,to,start:time,duration:p.duration*Math.max(.4,Math.abs((to-from)/p.angle))});};
 const animate=(now,{reduceMotion=false}={})=>{time=Number.isFinite(now)?now:time??0;for(const [key,t]of transitions){t.start??=time;const progress=reduceMotion?1:clamp((time-t.start)/t.duration);t.p.pivot.rotation[t.p.axis]=THREE.MathUtils.lerp(t.from,t.to,THREE.MathUtils.smootherstep(progress,0,1));if(progress===1)transitions.delete(key);}return transitions.size>0;};
 const setHeadlights=value=>{lampsOn=Boolean(value);for(const light of headlights){light.intensity=lampsOn?32*lightingScale**2:0;light.distance=10*lightingScale;}lamp.emissiveIntensity=lampsOn?2.8:.04;};
 const setLightingScale=value=>{lightingScale=Number.isFinite(value)&&value>0?value:1;setHeadlights(lampsOn);};
 const setColor=value=>{paint.color.set(value);shade.color.copy(paint.color).multiplyScalar(.94);highlight.color.copy(paint.color).lerp(new THREE.Color('#ffe2ba'),.045);};
 const setDirt=value=>{const n=clamp(value);dirt.opacity=n*.85;dirt.visible=n>0;rubber.color.set('#111519').lerp(new THREE.Color('#62523c'),n*.24);};
 root.userData.vehicle={inner,openings,headlights,setOpen,animateOpen,animate,setColor,setDirt,setHeadlights,setLightingScale,get lightingScale(){return lightingScale;},get moving(){return transitions.size>0;}};root.userData.wheelCount=4;root.userData.furnitureAnimate=animate;
 setColor(shape.color||'#d65b24');setDirt(shape.dirt??0);setHeadlights(shape.headlights!==false);for(const p of openings)setOpen(p.key,shape.vehicleOpen?.[p.key]);return root;
}
