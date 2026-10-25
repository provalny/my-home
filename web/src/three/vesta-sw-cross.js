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
const polygonNormal=points=>points.reduce((n,p,i)=>n.add(vec(p).cross(vec(points[(i+1)%points.length]))),new THREE.Vector3()).normalize();
function face(g,points,mat,name=''){
 const normal=polygonNormal(points),axis=[normal.x,normal.y,normal.z].map(Math.abs).indexOf(Math.max(Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z)));
 const outline=points.map(p=>new THREE.Vector2(p[axis===0?2:0],p[axis===1?2:1]));
 const indices=THREE.ShapeUtils.triangulateShape(outline,[]).flat(),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));geo.setIndex(indices);geo.computeVertexNormals();
 return mesh(g,geo,mat,name);
}
function quad(g,p,mat,name=''){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p.flat(),3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();return mesh(g,geo,mat,name);}
function line(g,p,r,m,name=''){for(let i=1;i<p.length;i++)rod(g,p[i-1],p[i],r,m,name);}
// Indexed patches share normals, so broad stamped panels have continuous reflections.
function surface(g,fn,nu,nv,material,name){
 const p=[],index=[];for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++)p.push(...fn(i/nu,j/nv));
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+2,d=a+nu+1;index.push(a,b,c,a,c,d);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(index);geo.computeVertexNormals();return mesh(g,geo,material,name);
}
function ribbon(g,points,width,material,name,normal=[0,0,1]){
 const curve=new THREE.CatmullRomCurve3(points.map(vec),false,'centripetal');
 return surface(g,(u,v)=>{const p=curve.getPoint(u),t=curve.getTangent(u),across=new THREE.Vector3().crossVectors(vec(normal),t).normalize();return p.addScaledVector(across,(v-.5)*width).toArray();},Math.max(16,points.length*6),2,material,name);
}
function shell(g,points,material,name,depth=.014){
 const n=polygonNormal(points),sign=Math.sign(points.reduce((sum,p)=>sum+p[2],0))||1;
 if(n.z*sign<0)n.negate();const back=points.map(p=>vec(p).addScaledVector(n,-depth).toArray());
 face(g,points,material,name);face(g,[...back].reverse(),material,name);
 for(let i=0;i<points.length;i++){const j=(i+1)%points.length;quad(g,[points[i],points[j],back[j],back[i]],material,name);}
}
const STAMPS=[[[.80,.88],[.33,.724],[.74,.48]],[[-1.23,.91],[-.80,.738],[-1.20,.52]]];
function stampDepth(y,z){let depth=0;for(const path of STAMPS)for(let i=1;i<path.length;i++){const [a,b]=[path[i-1],path[i]],dz=b[0]-a[0],dy=b[1]-a[1],t=clamp(((z-a[0])*dz+(y-a[1])*dy)/(dz*dz+dy*dy)),d=Math.hypot(z-a[0]-dz*t,y-a[1]-dy*t);depth=Math.max(depth,.010*Math.exp(-((d/.075)**2))*Math.sin(Math.PI*(.12+.76*t)));}return depth;}
const bodyX=(y,z)=>y>.98?glassX(y):.805+.055*Math.sin(clamp((y-.29)/.75)*Math.PI*.86)-.038*clamp((Math.abs(z)-1.65)/.56)-stampDepth(y,z);
const glassX=y=>.822-(y-.98)*.39+.009*Math.sin(clamp((y-.98)/.45)*Math.PI);
function side(g,outline,s,mat,name='',offset=0,thickness=.022){
 const shape=new THREE.Shape(outline.map(([z,y])=>new THREE.Vector2(z,y)));
 const source=new THREE.ExtrudeGeometry(shape,{depth:thickness,steps:1,bevelEnabled:false,curveSegments:1}),p=source.attributes.position,positions=[],normals=[];
 const emit=(a,b,c,flat)=>{const sources=s>0?[a,c,b]:[a,b,c],points=sources.map(v=>new THREE.Vector3(s*(bodyX(v.y,v.x)+offset+v.z-thickness),v.y,v.x)),normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
  points.forEach((point,i)=>{positions.push(...point.toArray());if(flat){const src=sources[i],dy=(bodyX(src.y+.0001,src.x)-bodyX(src.y-.0001,src.x))/.0002,dz=(bodyX(src.y,src.x+.0001)-bodyX(src.y,src.x-.0001))/.0002,n=new THREE.Vector3(s,-dy,-dz).normalize().multiplyScalar(src.z<thickness*.5?-1:1);normals.push(...n.toArray());}else normals.push(...normal.toArray());});};
 for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2),flat=Math.abs(a.z-b.z)<1e-6&&Math.abs(a.z-c.z)<1e-6;
  if(!flat){emit(a,b,c,false);continue;}const n=12,at=(u,v)=>a.clone().multiplyScalar(1-(u+v)/n).addScaledVector(b,u/n).addScaledVector(c,v/n);
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
// Continuous vector strokes keep badges crisp when the model is exported.
const LETTERS={L:[[[0,4],[0,0],[2,0]]],A:[[[0,0],[1,4],[2,0]],[[.35,1.4],[1.65,1.4]]],D:[[[0,0],[0,4],[1.2,4],[2,3.2],[2,.8],[1.2,0],[0,0]]],V:[[[0,4],[1,0],[2,4]]],E:[[[2,4],[0,4],[0,0],[2,0]],[[0,2],[1.6,2]]],S:[[[2,4],[.3,4],[0,3.6],[0,2.4],[2,1.6],[2,.4],[1.7,0],[0,0]]],T:[[[0,4],[2,4]],[[1,4],[1,0]]],W:[[[0,4],[.7,0],[2,3],[3.3,0],[4,4]]],C:[[[2,4],[.4,4],[0,3.6],[0,.4],[.4,0],[2,0]]],R:[[[0,0],[0,4],[1.6,4],[2,3.5],[2,2.5],[1.6,2],[0,2]],[[1,2],[2,0]]],O:[[[.4,0],[0,.4],[0,3.6],[.4,4],[1.6,4],[2,3.6],[2,.4],[1.6,0],[.4,0]]]};
function lettering(g,text,center,y,z,size,material,back=false){
 const width=c=>c==='W'?4:2,total=[...text].reduce((sum,c)=>sum+width(c)+1.3,0)-1.3;let x=-total*size/2;
 for(const c of text){for(const stroke of LETTERS[c]||[])line(g,stroke.map(([u,v])=>[center+(back?-1:1)*(x+u*size),y+v*size,z]),size*.13,material,'Шильдик '+text);x+=(width(c)+1.3)*size;}
}

export function buildVestaSwCross(shape={}){
 const root=new THREE.Group(),inner=new THREE.Group();root.name='LADA Vesta SW Cross 2019';root.add(inner);
 const standard=(color,name,roughness=.6,metalness=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness,side:THREE.DoubleSide});m.name=name;return m;};
 const paint=new THREE.MeshPhysicalMaterial({color:shape.color||'#d65b24',roughness:.29,metalness:.32,clearcoat:.65,clearcoatRoughness:.24,side:THREE.DoubleSide});paint.name='Краска кузова';
 const shade=paint.clone();shade.name='Углубления штамповки';const highlight=paint.clone();highlight.name='Кромки кузова';
 const trim=standard('#25282b','Матовый обвес Cross',.88),rubber=standard('#111519','Шины и уплотнители',.94),chrome=standard('#bdc5c9','Хром и диски',.26,.82),alloy=standard('#343b42','Тёмные грани дисков',.40,.66),inside=standard('#35383b','Обивка салона',.96),seatInsert=standard('#7a6357','Вставки сидений',.92),red=standard('#9e1420','Задние фонари',.24),white=standard('#c9d7dd','Отражатели',.24,.15),plate=standard('#e9e7dd','Номерная табличка',.64);
 const glass=new THREE.MeshPhysicalMaterial({color:'#344d5a',transparent:true,opacity:.76,roughness:.09,metalness:.20,clearcoat:.7,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true});glass.name='Тонированные стёкла';
 red.emissive.set('#6b0710');red.emissiveIntensity=.08;
 const lamp=standard('#e0e9ed','Передние фары',.20,.25);lamp.emissive.set('#e0edff');
 const dirt=new THREE.MeshStandardMaterial({map:dirtMap(),transparent:true,depthWrite:false,side:THREE.DoubleSide,roughness:1,polygonOffset:true,polygonOffsetFactor:-1});dirt.name='Дорожная пыль';
 const openings=[],headlights=[];
 function hinge(key,position,axis,angle,duration=1.1){const pivot=new THREE.Group(),body=new THREE.Group();pivot.name=key;pivot.position.set(...position);body.position.copy(pivot.position).negate();pivot.add(body);inner.add(pivot);openings.push({key,pivot,axis,angle,duration});return body;}
 function dusty(part,s){const geo=part.geometry.clone(),p=geo.attributes.position,uv=[];for(let i=0;i<p.count;i++){p.setX(i,p.getX(i)+s*.0015);uv.push((p.getZ(i)+2.212)/4.424,clamp((p.getY(i)-.28)/.75));}geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));mesh(part.parent,geo,dirt,'Пыль');}
 function panel(g,points,s,name,m=paint){const o=side(g,points,s,m,name);if(m===paint)dusty(o,s);return o;}
 function window(g,outline,s,name){
  const corners=outline.map(p=>new THREE.Vector2(...p)),rounded=[];
  for(let i=0;i<corners.length;i++){const c=corners[i],before=corners[(i+corners.length-1)%corners.length],after=corners[(i+1)%corners.length],r=Math.min(.033,c.distanceTo(before)*.20,c.distanceTo(after)*.20),a=c.clone().addScaledVector(before.clone().sub(c).normalize(),r),b=c.clone().addScaledVector(after.clone().sub(c).normalize(),r);for(let j=0;j<=4;j++){const t=j/4;rounded.push(a.clone().multiplyScalar((1-t)**2).addScaledVector(c,2*t*(1-t)).addScaledVector(b,t*t));}}
  const center=corners.reduce((sum,p)=>sum.add(p),new THREE.Vector2()).multiplyScalar(1/corners.length),p=rounded.map(v=>[s*glassX(v.y),v.y,v.x]);face(g,p,glass,name);
  const outer=rounded.map(v=>v.clone().sub(center).multiplyScalar(1.10).add(center));
  for(let i=0;i<p.length;i++){const j=(i+1)%p.length,a=outer[i],b=outer[j];quad(g,[p[i],p[j],[s*(glassX(b.y)+.005),b.y,b.x],[s*(glassX(a.y)+.005),a.y,a.x]],paint,'Цельная рамка окна');}
  line(g,[...p,p[0]],.0045,rubber,'Уплотнитель стекла');
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
  side(inner,[[.797,.99],[.815,1.016],[.140,1.448],[.100,1.432]],s,paint,'Передняя силовая стойка',-.018,.025);
  side(inner,[[-.355,.988],[-.355,1.435],[-.308,1.435],[-.308,.988]],s,rubber,'Чёрная средняя стойка',.004,.026);
  line(front,[[s*.827,.990,.765],[s*.827,.990,-.315]],.006,chrome,'Окантовка переднего окна');line(rear,[[s*.827,.990,-.350],[s*.827,.990,-1.17]],.006,chrome,'Окантовка заднего окна');line(inner,[[s*.827,.990,-1.20],[s*.810,1.035,-1.93]],.006,chrome,'Окантовка форточки');
  // The X stamp is part of the panel surface; it follows body colour and reflections.
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
 const roofSections=[[-1.710,.550,1.397],[-1.505,.648,1.458],[-.85,.663,1.477],[-.30,.663,1.476],[.115,.656,1.438]];
 const roofCurve=new THREE.CatmullRomCurve3(roofSections.map(([z,w,y])=>new THREE.Vector3(w,y,z)),false,'centripetal');
 surface(inner,(u,v)=>{const p=roofCurve.getPoint(v),t=u*2-1;return [p.x*t,p.y-.028*t*t,p.z];},20,36,paint,'Гладкая панель крыши');
 for(const sign of [-1,1])surface(inner,(u,v)=>{const p=roofCurve.getPoint(v),y=p.y-.027-.035*u;return [sign*(p.x+(glassX(y)-p.x)*u),y,p.z];},4,36,paint,'Плечо крыши');
 for(const s of [-1,1]){
  line(inner,Array.from({length:32},(_,i)=>{const p=roofCurve.getPoint(i/31);return [s*p.x,p.y-.027,p.z];}),.004,trim,'Тонкий водосток');
  for(const z of [.0,-1.42])block(inner,.043,.034,.12,s*.586,1.455,z,trim,.01,'Опора рейлинга');
  line(inner,[[s*.586,1.473,.09],[s*.592,1.516,-.10],[s*.601,1.521,-.90],[s*.582,1.482,-1.49]],.015,chrome,'Рейлинг');
 }
 face(inner,[[0,1.477,-1.27],[0,1.529,-1.29],[0,1.477,-1.38]],paint,'Антенна-плавник');
 const windshield=(u,v)=>{const x=(u*2-1)*(.798-.176*v),y=1.010+.404*v,z=.768-.640*v+.027*Math.sin(Math.PI*u)*Math.sin(Math.PI*v);return [x,y,z];};
 const windscreen=glass.clone();windscreen.name='Лобовое тонированное стекло';windscreen.opacity=.48;
 const wind=surface(inner,windshield,24,18,windscreen,'Лобовое стекло');wind.userData.noShadow=true;
 for(const edge of [Array.from({length:25},(_,i)=>windshield(i/24,0)),Array.from({length:25},(_,i)=>windshield(i/24,1)),Array.from({length:19},(_,i)=>windshield(0,i/18)),Array.from({length:19},(_,i)=>windshield(1,i/18))])line(inner,edge,.009,rubber,'Окантовка лобового стекла');
 for(const x of [-.40,.30]){rod(inner,[x-.20,1.025,.740],[x+.20,1.039,.720],.009,trim,'Дворник');rod(inner,[x-.17,1.010,.771],[x+.10,1.034,.724],.005,trim);}
 const hood=hinge('hood',[0,.994,.779],'x',-1.08,1.25);
 const hoodSurface=(u,v)=>{const t=u*2-1,w=.792-.026*v,z=.795+v*(1.397-.167*t*t),ridge=.008*Math.exp(-(((Math.abs(t)-.64)/.07)**2))*Math.sin(Math.PI*v);return [t*w,.987-.103*v+.025*(1-t*t)+ridge,z];};
 surface(hood,hoodSurface,40,32,paint,'Объёмный капот');
 for(let i=0;i<40;i++){const a=hoodSurface(i/40,1),b=hoodSurface((i+1)/40,1);quad(hood,[a,b,[b[0],b[1]-.018,b[2]],[a[0],a[1]-.018,a[2]]],paint,'Завальцовка кромки капота');}
 quad(hood,[[-.64,.960,.86],[.64,.960,.86],[.58,.872,1.97],[-.58,.872,1.97]],trim,'Теплоизоляция капота');
 block(inner,1.42,.06,1.17,0,.442,1.39,trim,.01,'Моторный отсек');
 block(inner,1.41,.35,.045,0,.47,.795,trim,.01,'Моторный щит');
 block(inner,.64,.25,.55,0,.56,1.39,alloy,.023,'Двигатель');block(inner,.54,.045,.46,0,.81,1.39,trim,.023,'Крышка двигателя');
 for(let i=0;i<5;i++)block(inner,.36,.012,.015,0,.855,1.24+i*.07,chrome,.002);
 block(inner,.28,.22,.29,-.50,.61,1.11,trim,.01,'Аккумулятор');block(inner,.05,.02,.04,-.59,.83,1.15,red,.003);
 block(inner,.23,.17,.25,.54,.62,1.02,plate,.03,'Расширительный бачок');block(inner,.06,.02,.06,.54,.79,1.02,rubber,.01);
 block(inner,1.25,.27,.07,0,.54,1.989,alloy,.006,'Радиатор');
 // Original 2019 front fascia: swept halogen lamps and X-shaped chrome cheeks.
 const frontZ=(x,y=.60)=>2.197-.17*(Math.abs(x)/.88)**3-.022*((y-.60)/.4)**2;
 const fascia=(pts,m,name,offset=0)=>{
  const geo=new THREE.ShapeGeometry(new THREE.Shape(pts.map(p=>new THREE.Vector2(...p)))),base=geo.index?geo.toNonIndexed():geo,src=base.attributes.position,positions=[],normals=[];
  const emit=p=>{const z=frontZ(p.x,p.y)+offset,n=new THREE.Vector3(.51*Math.sign(p.x)*(p.x/.88)**2/.88,.275*(p.y-.60),1).normalize();positions.push(p.x,p.y,z);normals.push(...n.toArray());};
  for(let i=0;i<src.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(src,i),b=new THREE.Vector3().fromBufferAttribute(src,i+1),c=new THREE.Vector3().fromBufferAttribute(src,i+2),n=6,at=(u,v)=>a.clone().multiplyScalar(1-(u+v)/n).addScaledVector(b,u/n).addScaledVector(c,v/n);for(let u=0;u<n;u++)for(let v=0;v<n-u;v++){[at(u,v),at(u+1,v),at(u,v+1)].forEach(emit);if(u+v<n-1)[at(u+1,v),at(u+1,v+1),at(u,v+1)].forEach(emit);}}
  geo.dispose();if(base!==geo)base.dispose();const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));out.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return mesh(inner,out,m,name);
 };
 fascia([[-.73,.29],[-.84,.36],[-.861,.64],[-.845,.77],[-.74,.88],[.74,.88],[.845,.77],[.861,.64],[.84,.36],[.73,.29]],paint,'Скульптурный передний бампер');
 fascia([[-.68,.359],[-.46,.652],[-.59,.755],[-.58,.870],[.58,.870],[.59,.755],[.46,.652],[.68,.359]],rubber,'X-решётка',.009);
 for(const y of [.780,.813,.847]){const p=[];for(let i=0;i<=12;i++){const x=-.55+i*1.10/12;p.push([x,y,frontZ(x)+.018]);}line(inner,p,.004,alloy,'Ламель решётки');}
 for(let row=0;row<3;row++)for(let col=0;col<20;col++){const x=-.53+col*.055+(row%2)*.027,y=.402+row*.040;if(Math.abs(x)>.54)continue;const cell=Array.from({length:7},(_,i)=>{const a=i*Math.PI/3;return [x+Math.cos(a)*.027,y+Math.sin(a)*.019,frontZ(x,y)+.015];});line(inner,cell,.0028,alloy,'Соты нижней решётки');}
 for(let row=0;row<2;row++)for(let col=0;col<21;col++){const x=-.53+col*.053,y=.79+row*.036;line(inner,[[x-.022,y-.014,frontZ(x,y)+.014],[x,y+.013,frontZ(x,y)+.014],[x+.022,y-.014,frontZ(x,y)+.014]],.002,alloy,'Рисунок решётки');}
 const oval=mesh(inner,new THREE.TorusGeometry(.055,.006,6,24),chrome,'Эмблема LADA');oval.scale.x=1.7;oval.position.set(0,.823,2.222);
 line(inner,[[.015,.862,2.225],[-.022,.835,2.225],[.021,.826,2.225],[-.028,.797,2.225],[.024,.797,2.225]],.005,chrome,'Ладья');
 block(inner,.520,.110,.012,0,.579,2.216,plate,.003,'Передний номер');lettering(inner,'VESTA SW',0,.600,2.224,.010,trim);
 for(const s of [-1,1]){
  const lensSurface=(u,v)=>{const x=s*(.470+.350*u),y=.759+.020*u+v*(.128-.038*u),z=frontZ(x,y)+.020+.008*Math.sin(Math.PI*v);return [x,y,z];};
  const perimeter=[...Array.from({length:17},(_,i)=>lensSurface(i/16,0)),...Array.from({length:9},(_,i)=>lensSurface(1,i/8)),...Array.from({length:17},(_,i)=>lensSurface(1-i/16,1)),...Array.from({length:9},(_,i)=>lensSurface(0,1-i/8))];
  shell(inner,perimeter.map(([x,y,z])=>[x,y,z-.025]),rubber,'Глубокий корпус фары',.030);
  surface(inner,(u,v)=>{const p=lensSurface(u,v);p[2]-=.009;return p;},24,12,alloy,'Внутренняя маска фары');
  for(const [u,r]of [[.28,.054],[.69,.048]]){
   const center=vec(lensSurface(u,.51)),tangent=vec(lensSurface(u+.001,.51)).sub(center).normalize(),up=vec(lensSurface(u,.511)).sub(center).normalize(),n=new THREE.Vector3().crossVectors(tangent,up).normalize();if(n.z<0)n.negate();
   const g=new THREE.Group();g.position.copy(center.addScaledVector(n,-.009));g.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n);inner.add(g);
   const bowl=mesh(g,new THREE.SphereGeometry(r,24,12,0,Math.PI*2,0,Math.PI),chrome,'Зеркальный отражатель');bowl.scale.set(1,.79,.28);
   const edge=mesh(g,new THREE.TorusGeometry(r*.90,.004,6,32),alloy,'Обод отражателя');edge.scale.y=.79;edge.position.z=.011;
   const bulb=mesh(g,new THREE.SphereGeometry(r*.31,16,10),lamp,'Лампа ближнего света');bulb.scale.z=.45;bulb.position.z=.016;
  }
  const cover=glass.clone();cover.name='Прозрачная линза фары';cover.opacity=.15;cover.metalness=.04;cover.color.set('#d9e6eb');const pane=surface(inner,lensSurface,32,16,cover,'Формованное стекло фары');pane.userData.noShadow=true;
  line(inner,perimeter,.004,trim,'Герметик фары');
  const drl=Array.from({length:18},(_,i)=>{const p=lensSurface(.08+.85*i/17,.13);p[2]+=.005;return p;});ribbon(inner,drl,.012,lamp,'Полоса дневного света');
  ribbon(inner,[[s*.50,.748,frontZ(.50,.748)+.025],[s*.365,.666,frontZ(.365,.666)+.025],[s*.424,.530,frontZ(.424,.530)+.025],[s*.526,.393,frontZ(.526,.393)+.025],[s*.750,.386,frontZ(.750,.386)+.025]],.031,chrome,'Хромированная щека X');
  fascia([[s*.541,.440],[s*.756,.439],[s*.786,.485],[s*.762,.583],[s*.656,.595]],rubber,'Углубление противотуманки',.012);
  const fog=new THREE.Group();fog.position.set(s*.712,.510,frontZ(.712,.510)+.019);inner.add(fog);mesh(fog,new THREE.TorusGeometry(.038,.005,8,28),chrome,'Обод противотуманки');const fogLens=mesh(fog,new THREE.SphereGeometry(.030,20,12),lamp,'Противотуманная фара');fogLens.scale.z=.35;
  const light=new THREE.SpotLight('#e0edff',0,10,.36,.66,1.5);light.position.set(s*.65,.813,2.08);light.lookAt(s*.88,0,6.7);light.target.position.set(0,0,-1);light.add(light.target);inner.add(light);headlights.push(light);
 }
 fascia([[-.84,.33],[-.81,.400],[-.59,.373],[.59,.373],[.81,.400],[.84,.33],[.73,.270],[-.73,.270]],trim,'Нижняя защита бампера',.015);
 fascia([[-.54,.287],[-.54,.335],[.54,.335],[.54,.287]],chrome,'Передняя серебристая защита',.022);
 // Tailgate follows the roof taper, with wraparound lamps on both body and hatch.
 const hatch=hinge('tailgate',[0,1.410,-1.685],'x',1.50,1.3);
 const rearWindow=(u,v)=>{const t=u*2-1,w=.710-.136*v;return [t*w,1.075+.307*v,-2.062+.342*v-.018*(1-t*t)*Math.sin(Math.PI*v)];};
 const backGlass=surface(hatch,rearWindow,28,18,glass,'Гнутое заднее стекло');backGlass.userData.noShadow=true;
 for(const edge of [Array.from({length:29},(_,i)=>rearWindow(i/28,0)),Array.from({length:29},(_,i)=>rearWindow(i/28,1)),Array.from({length:19},(_,i)=>rearWindow(0,i/18)),Array.from({length:19},(_,i)=>rearWindow(1,i/18))])line(hatch,edge,.011,rubber,'Рамка заднего стекла');
 const hatchSurface=(u,v)=>{const t=u*2-1,x=t*(.704+.027*Math.sin(Math.PI*v)),y=.55+.525*v,recess=.016*Math.exp(-((x/.32)**4+((y-.79)/.09)**4));return [x,y,-2.162+.087*v+.033*t**4+recess];};
 surface(hatch,hatchSurface,40,28,paint,'Объёмная дверь багажника');
 surface(hatch,(u,v)=>{const p=hatchSurface(u,v);p[2]+=.025;return p;},16,12,inside,'Обшивка пятой двери');
 for(const u of [0,1])for(let i=0;i<28;i++){const a=hatchSurface(u,i/28),b=hatchSurface(u,(i+1)/28);quad(hatch,[a,b,[b[0],b[1],b[2]+.025],[a[0],a[1],a[2]+.025]],paint,'Торец пятой двери');}
 for(const sign of [-1,1])quad(hatch,[[sign*.573,1.395,-1.702],[sign*.637,1.398,-1.710],[sign*.768,1.057,-2.052],[sign*.710,1.075,-2.062]],paint,'Стойка пятой двери');
 block(hatch,1.25,.032,.150,0,1.397,-1.718,paint,.015,'Спойлер');block(hatch,.35,.013,.008,0,1.389,-1.801,red,.003,'Стоп-сигнал');
 rod(hatch,[-.23,1.111,-2.032],[.20,1.113,-2.031],.008,trim,'Задний дворник');
 lettering(hatch,'L A D A',0,.997,-2.098,.011,chrome,true);
 block(hatch,.560,.140,.012,0,.714,-2.130,trim,.009,'Ниша номерного знака');block(hatch,.520,.110,.014,0,.730,-2.141,plate,.004,'Задний номер');lettering(hatch,'VESTA SW',0,.756,-2.151,.0095,trim,true);
 block(hatch,.22,.018,.020,0,.872,-2.117,trim,.006,'Ручка багажника');
 for(const sign of [-1,1]){
  const rearLampPoint=(x,y,outer=false)=>{
   const u=clamp((x-.707)/(bodyX(y,-2.035)-.707)),v=(y-.565)/.426,h=(y-.55)/.525,t=x/(.704+.027*Math.sin(Math.PI*h));
   return [sign*x,y,outer?-2.142+.054*v+(.107-.054*v)*Math.sin(u*Math.PI/2)-.008:-2.162+.087*h+.033*t**4-.008];
  };
  const outer=[[.743,.980],[.822,.975],[.827,.915],[.750,.856]].map(([x,y])=>rearLampPoint(x,y,true)),inset=[[.724,.980],[.440,.960],[.491,.862],[.724,.854]].map(([x,y])=>rearLampPoint(x,y));
  for(const [g,outline]of [[inner,outer],[hatch,inset]]){
   const center=outline.reduce((sum,p)=>sum.add(vec(p)),new THREE.Vector3()).multiplyScalar(1/outline.length),border=outline.map(p=>vec(p).sub(center).multiplyScalar(1.04).add(center).toArray());
   shell(g,border,trim,'Корпус заднего фонаря',.008);shell(g,outline.map(([x,y,z])=>[x,y,z-.003]),red,'Красная линза фонаря',.008);
  }
  ribbon(hatch,[[.708,.945],[.605,.938],[.465,.928]].map(([x,y])=>{const p=rearLampPoint(x,y);p[2]-=.006;return p;}),.017,white,'Светлая секция фонаря',[0,0,-1]);
  ribbon(inner,[[.755,.945],[.788,.945],[.820,.945]].map(([x,y])=>{const p=rearLampPoint(x,y,true);p[2]-=.006;return p;}),.017,white,'Боковая секция фонаря',[0,0,-1]);
 }
 for(const [lo,hi,material]of [[.235,.402,trim],[.402,.574,paint]])surface(inner,(u,v)=>{const t=u*2-1,baseY=lo+(hi-lo)*v,q=(baseY-.235)/.339,x=t*(.845+.012*Math.sin(Math.PI*q)),y=baseY+.016*t**8,z=-2.202+.170*t**4+.040*((baseY-.40)/.20)**2;return [x,y,z];},40,12,material,'Закруглённый задний бампер');
 for(const sign of [-1,1])surface(inner,(u,v)=>{const y=.565+.426*v,x=sign*(.707+(bodyX(y,-2.035)-.707)*u),z=-2.142+.054*v+(.107-.054*v)*Math.sin(u*Math.PI/2);return [x,y,z];},10,12,paint,'Закругление заднего крыла');
 face(inner,[[-.65,.248,-2.214],[-.57,.338,-2.221],[.57,.338,-2.221],[.65,.248,-2.214],[.46,.237,-2.210],[-.46,.237,-2.210]],chrome,'Задняя серебристая защита');
 block(inner,.23,.025,.012,0,.354,-2.225,red,.005,'Задний отражатель');
 for(const x of [-.56,-.43]){const pipe=mesh(inner,new THREE.CylinderGeometry(.033,.033,.13,24),chrome,'Насадка выхлопа');pipe.rotation.x=Math.PI/2;pipe.position.set(x,.273,-2.160);const hole=mesh(inner,new THREE.CircleGeometry(.027,24),rubber);hole.rotation.y=Math.PI;hole.position.set(x,.273,-2.227);}
 // Fuel filler is flush with the right rear wing.
 const filler=[];for(let i=0;i<40;i++){const a=i*Math.PI*2/40,z=-1.70+.095*Math.sign(Math.cos(a))*Math.abs(Math.cos(a))**.45,y=.873+.072*Math.sign(Math.sin(a))*Math.abs(Math.sin(a))**.45;filler.push([bodyX(y,z)+.002,y,z]);}line(inner,[...filler,filler[0]],.002,trim,'Лючок бензобака');
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
 for(const x of [-.43,.43])for(const sign of [-1,1])line(inner,[[x+sign*.15,.56,.17],[x+sign*.15,.56,-.16],[x+sign*.15,.68,-.151],[x+sign*.15,.90,-.174]],.0018,seatInsert,'Шов сиденья');
 for(const x of [-.61,-.20,.20,.61]){block(inner,.12,.045,.012,x,.88,.454,rubber,.004,'Воздуховод');for(let i=0;i<3;i++)block(inner,.10,.003,.013,x,.89+i*.010,.451,alloy,.001,'Ламель воздуховода');}
 // 205/50 R17 road tyres with five split two-tone spokes.
 for(const s of [-1,1])for(const z of [1.350,-1.285]){
  const g=new THREE.Group();g.name='Колесо 17 дюймов';g.userData.wheel=true;g.position.set(s*.762,.318,z);g.rotation.z=-s*Math.PI/2;inner.add(g);
  const profile=[[.213,-.095],[.277,-.104],[.310,-.081],[.318,-.056],[.318,.056],[.310,.081],[.277,.104],[.213,.095],[.213,-.095]].map(p=>new THREE.Vector2(...p));mesh(g,new THREE.LatheGeometry(profile,64),rubber,'Покрышка');
  for(const y of [-.039,0,.039]){const tread=mesh(g,new THREE.TorusGeometry(.318,.0015,4,64),rubber,'Канавка протектора');tread.rotation.x=Math.PI/2;tread.position.y=y;}
  const rim=mesh(g,new THREE.CylinderGeometry(.216,.216,.170,48,1,true),alloy,'Открытый обод');const brake=mesh(g,new THREE.CylinderGeometry(.175,.175,.012,40),alloy,'Тормозной диск');brake.position.y=.067;
  for(let i=0;i<20;i++){const a=i*Math.PI*2/20,hole=mesh(g,new THREE.CircleGeometry(.004,6),alloy,'Перфорация диска');hole.rotation.x=-Math.PI/2;hole.position.set(Math.sin(a)*.146,.074,Math.cos(a)*.146);}
  block(g,.065,.07,.10,.131,.025,0,alloy,.012,'Суппорт');
  const lip=mesh(g,new THREE.TorusGeometry(.207,.008,8,48),chrome,'Полированный обод');lip.rotation.x=Math.PI/2;lip.position.y=.104;
  const polar=(r,a)=>[Math.sin(a)*r,Math.cos(a)*r];
  for(let i=0;i<5;i++)for(const branch of [-1,1]){
   const a=i*Math.PI*2/5,outline=[polar(.047,a-.065),polar(.101,a+branch*.13-.075),polar(.202,a+branch*.22-.055),polar(.202,a+branch*.22+.055),polar(.108,a+branch*.13+.075),polar(.047,a+.065)];
   const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p))),geo=new THREE.ExtrudeGeometry(shape,{depth:.022,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:2,steps:1});geo.rotateX(Math.PI/2);geo.translate(0,.123,0);mesh(g,geo,alloy,'Гранёная спица');
   const center=outline.reduce((sum,p)=>sum.add(new THREE.Vector2(...p)),new THREE.Vector2()).multiplyScalar(1/outline.length);face(g,outline.map(p=>{const v=new THREE.Vector2(...p).sub(center).multiplyScalar(.80).add(center);return [v.x,.128,v.y];}),chrome,'Алмазная грань спицы');
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
