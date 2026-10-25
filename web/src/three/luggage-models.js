import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {EXTRA_MODEL_INFO,extraDimensions} from './furniture-info.js';

export const BAG_TYPES=['duffel60','backpack20','travelBag30'];
export const BAG_COLORS=[['#637653','Оливковый'],['#477e94','Синий'],['#b66c50','Терракотовый'],['#c69b4a','Горчичный'],['#414750','Графитовый'],['#cbbda3','Песочный']];
const v=p=>new THREE.Vector3(...p);
const mesh=(parent,geometry,material,name='')=>{
  if(material.vertexColors&&!geometry.attributes.color)geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(1),3));
  const o=new THREE.Mesh(geometry,material);o.name=name;parent.add(o);return o;
};
function block(parent,size,position,material,name=''){
  const o=mesh(parent,new THREE.BoxGeometry(...size),material,name);o.position.set(...position);return o;
}
function rod(parent,a,b,r,material){
  const direction=v(b).sub(v(a)),o=mesh(parent,new THREE.CylinderGeometry(r,r,direction.length(),5),material);
  o.position.copy(v(a).add(v(b)).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return o;
}
function ribbon(parent,points,width,thickness,side,material,name='Стропа'){
  // Flat webbing follows the bag surface; it is never a row of round pipes.
  for(let i=1;i<points.length;i++){
    const a=v(points[i-1]),b=v(points[i]),t=b.clone().sub(a).normalize(),x=v(side);x.addScaledVector(t,-x.dot(t)).normalize();const y=new THREE.Vector3().crossVectors(t,x).normalize();
    const o=block(parent,[width,thickness,a.distanceTo(b)],a.add(b).multiplyScalar(.5).toArray(),material,name);
    o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,t));
  }
}
function edge(parent,points,material,r=.0015,closed=false){
  for(let i=1;i<points.length;i++)rod(parent,points[i-1],points[i],r,material);
  if(closed)rod(parent,points.at(-1),points[0],r,material);
}
function loft(parent,rings,material,name){
  const vertices=[],colors=[],n=rings[0].length;
  const tri=(a,b,c,shade)=>{vertices.push(...a,...c,...b);for(let i=0;i<3;i++)colors.push(shade,shade,shade);};
  for(let row=0;row<rings.length-1;row++)for(let i=0;i<n;i++){
    const j=(i+1)%n,a=rings[row][i],b=rings[row][j],c=rings[row+1][j],d=rings[row+1][i],shade=.92+((i*7+row*3)%6)*.018;
    tri(a,b,c,shade);tri(a,c,d,shade);
  }
  for(const [ring,flip]of [[rings[0],true],[rings.at(-1),false]]){
    const center=ring.reduce((sum,p)=>sum.add(v(p)),new THREE.Vector3()).multiplyScalar(1/n).toArray();
    for(let i=0;i<n;i++)flip?tri(center,ring[(i+1)%n],ring[i],.95):tri(center,ring[i],ring[(i+1)%n],.95);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  return mesh(parent,geo,material,name);
}
const crossSection=(width,depth,bevel=.22)=>{
  const x=width/2,z=depth/2;return [[-x+width*bevel,-z],[x-width*bevel,-z],[x,-z+depth*bevel],[x,z-depth*bevel],[x-width*bevel,z],[-x+width*bevel,z],[-x,z-depth*bevel],[-x,-z+depth*bevel]];
};
function upright(parent,sections,material,name){return loft(parent,sections.map(({y,w,d,z=0})=>crossSection(w,d).map(([x,zz])=>[x,y,z+zz])),material,name);}
function zipper(parent,points,trim,metal,{teeth=true}={}){
  edge(parent,points,trim,.003);
  if(teeth)for(let i=1;i<points.length;i++){
    const a=v(points[i-1]),b=v(points[i]),count=Math.floor(a.distanceTo(b)/.011);
    for(let j=0;j<count;j++){
      const p=a.clone().lerp(b,(j+.5)/count);block(parent,[.0025,.0025,.0025],p.toArray(),metal,'Зубец молнии');
    }
  }
  const end=points.at(-1),pull=block(parent,[.008,.003,.018],[end[0],end[1]+.004,end[2]+.009],metal,'Бегунок молнии');pull.rotation.y=-.2;
}
function buckle(parent,x,y,z,metal,trim){
  block(parent,[.035,.029,.008],[x,y,z],metal,'Пряжка');block(parent,[.023,.018,.009],[x,y,z+.001],trim);
  block(parent,[.027,.004,.010],[x,y,z+.003],metal);
}
function badge(parent,litres,x,y,z,patch,ink){
  block(parent,[.066,.032,.003],[x,y,z],patch,'Нашивка объёма');
  const digits={'0':'abcedf','2':'abged','3':'abgcd','6':'afgecd'};
  const segments={a:[0,.010,.008,.0016],b:[.004,.005,.0016,.008],c:[.004,-.005,.0016,.008],d:[0,-.010,.008,.0016],e:[-.004,-.005,.0016,.008],f:[-.004,.005,.0016,.008],g:[0,0,.008,.0016]};
  for(const [i,digit]of [...String(litres)].entries())for(const segment of digits[digit]){
    const [dx,dy,w,h]=segments[segment];block(parent,[w,h,.001],[x-.010+i*.013+dx,y+dy,z+.002],ink,'Объём');
  }
  block(parent,[.0016,.020,.001],[x+.020,y,z+.002],ink);block(parent,[.008,.0016,.001],[x+.023,y-.010,z+.002],ink);
}
function mergeStatic(parent){
  for(const group of parent.children.filter(o=>o.isGroup))mergeStatic(group);
  const batches=new Map();for(const child of parent.children)if(child.isMesh){const parts=batches.get(child.material)||[];parts.push(child);batches.set(child.material,parts);}
  for(const [material,parts]of batches){if(parts.length<2)continue;
    const geometries=parts.map(o=>{o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();for(const key of Object.keys(g.attributes))if(!['position','normal','color'].includes(key))g.deleteAttribute(key);if(!g.attributes.color)g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(1),3));return g.applyMatrix4(o.matrix);});
    const geo=mergeGeometries(geometries);for(const g of geometries)g.dispose();for(const p of parts){parent.remove(p);p.geometry.dispose();}mesh(parent,geo,material,material.name);
  }
}

function duffel(parent,m){
  const yz=[[.025,-.108],[.025,.108],[.075,.172],[.270,.172],[.332,.105],[.346,0],[.332,-.105],[.270,-.172],[.075,-.172]];
  const rings=[[-.310,.85],[-.278,1],[-.16,1.02],[.16,1.02],[.278,1],[.310,.85]].map(([x,k])=>yz.map(([y,z])=>[x,.18+(y-.18)*k,z*k]));
  loft(parent,rings,m.fabric,'Гранёный корпус 60 л');
  loft(parent,[rings[0].map(([x,y,z])=>[x-.001,y,z]),rings[0].map(([x,y,z])=>[x-.004,y,z])],m.panel,'Торцевая панель');
  loft(parent,[rings.at(-1).map(([x,y,z])=>[x+.001,y,z]),rings.at(-1).map(([x,y,z])=>[x+.004,y,z])],m.panel,'Торцевая панель');
  for(const s of [-1,1]){
    edge(parent,yz.map(([y,z])=>[s*.282,y,z]),m.seam,.0018,true);
    for(const z of [-.085,.085])block(parent,[.12,.014,.055],[s*.19,.018,z],m.rubber,'Защита дна');
    ribbon(parent,[[s*.172,.05,.151],[s*.172,.08,.177],[s*.172,.269,.177],[s*.172,.339,.107],[s*.172,.352,0],[s*.172,.339,-.107],[s*.172,.269,-.177],[s*.172,.08,-.177],[s*.172,.05,-.151]],.029,.005,[1,0,0],m.webbing);
    buckle(parent,s*.172,.21,.183,m.metal,m.webbing);
    ribbon(parent,[[s*.316,.14,-.064],[s*.337,.16,-.050],[s*.337,.21,.050],[s*.316,.235,.064]],.025,.006,[0,1,0],m.webbing,'Боковая ручка');
  }
  for(const z of [-.073,.073])ribbon(parent,[[-.172,.343,z],[-.15,.397,z],[-.075,.432,z*.50],[.075,.432,z*.50],[.15,.397,z],[.172,.343,z]],.024,.006,[0,0,1],m.webbing,'Ручка для переноски');
  block(parent,[.14,.020,.071],[0,.432,0],m.rubber,'Мягкая накладка ручек');
  zipper(parent,[[-.268,.345,0],[0,.357,0],[.268,.345,0]],m.webbing,m.metal);
  const pocket=new THREE.Group();pocket.position.set(0,.100,.174);parent.add(pocket);
  upright(pocket,[{y:0,w:.244,d:.008},{y:.010,w:.264,d:.012},{y:.125,w:.250,d:.012},{y:.136,w:.224,d:.008}],m.panel,'Передний карман');
  zipper(parent,[[-.113,.232,.184],[.113,.232,.184]],m.webbing,m.metal);
  badge(parent,60,0,.159,.184,m.patch,m.webbing);
}

function backpack(parent,m){
  upright(parent,[{y:.012,w:.216,d:.138},{y:.045,w:.270,d:.175},{y:.18,w:.282,d:.182},{y:.327,w:.264,d:.176},{y:.397,w:.212,d:.156},{y:.425,w:.115,d:.115}],m.fabric,'Рюкзак 20 л');
  upright(parent,[{y:.007,w:.214,d:.137},{y:.026,w:.255,d:.169},{y:.070,w:.274,d:.178}],m.panel,'Усиленное дно');
  const pocket=new THREE.Group();pocket.position.set(0,.065,.108);parent.add(pocket);
  upright(pocket,[{y:0,w:.180,d:.032},{y:.018,w:.204,d:.052},{y:.128,w:.198,d:.050},{y:.153,w:.170,d:.025}],m.panel,'Передний карман');
  zipper(parent,[[-.085,.205,.127],[0,.219,.132],[.085,.205,.127]],m.webbing,m.metal);
  badge(parent,20,0,.131,.135,m.patch,m.webbing);
  const mainZip=[[-.133,.175,.087],[-.125,.319,.086],[-.096,.394,.071],[0,.429,.056],[.096,.394,.071],[.125,.319,.086],[.133,.175,.087]];
  zipper(parent,mainZip,m.webbing,m.metal);
  // Quilted back panel and two separate padded shoulder straps, with open space between them and the bag.
  for(const x of [-.066,.066])block(parent,[.085,.285,.016],[x,.222,-.092],m.rubber,'Вентилируемая спинка');
  for(const s of [-1,1]){
    ribbon(parent,[[s*.070,.395,-.080],[s*.090,.366,-.140],[s*.105,.284,-.174],[s*.113,.157,-.163],[s*.086,.081,-.103]],.041,.014,[1,0,0],m.webbing,'Мягкая лямка');
    ribbon(parent,[[s*.086,.081,-.103],[s*.101,.040,-.089]],.023,.005,[1,0,0],m.webbing,'Регулировка лямки');
    block(parent,[.030,.024,.018],[s*.105,.114,-.151],m.metal,'Регулятор');
    const side=new THREE.Group();side.position.set(s*.135,.055,0);parent.add(side);
    upright(side,[{y:0,w:.022,d:.110},{y:.018,w:.045,d:.132},{y:.125,w:.034,d:.127}],m.panel,'Боковой карман');
    edge(parent,[[s*.154,.177,-.053],[s*.157,.184,0],[s*.154,.177,.053]],m.webbing,.003);
    for(let i=0;i<4;i++){const z=-.044+i*.024;edge(parent,[[s*.160,.077,z],[s*.160,.148,z+.030]],m.seam,.0012);}
    ribbon(parent,[[s*.134,.292,-.075],[s*.146,.285,0],[s*.134,.273,.078]],.018,.005,[0,1,0],m.webbing,'Боковая утяжка');
  }
  ribbon(parent,[[-.045,.416,-.025],[-.040,.456,-.030],[.040,.456,-.030],[.045,.416,-.025]],.017,.006,[0,0,1],m.webbing,'Верхняя ручка');
  for(const y of [.265,.300])block(parent,[.045,.012,.007],[0,y,.091],m.webbing,'Петля для снаряжения');
}

function travelBag(parent,m){
  upright(parent,[{y:.012,w:.424,d:.214},{y:.044,w:.467,d:.249},{y:.208,w:.454,d:.247},{y:.260,w:.412,d:.188},{y:.283,w:.380,d:.114}],m.fabric,'Дорожная сумка 30 л');
  upright(parent,[{y:.007,w:.424,d:.214},{y:.040,w:.468,d:.249},{y:.065,w:.467,d:.249}],m.panel,'Усиленное основание');
  for(const s of [-1,1])for(const z of [-.085,.085])block(parent,[.060,.013,.045],[s*.17,.0065,z],m.rubber,'Ножка');
  for(const z of [-.115,.115]){
    for(const x of [-.115,.115])block(parent,[.027,.128,.005],[x,.190,z],m.webbing,'Крепление ручки');
    ribbon(parent,[[-.115,.250,z],[-.105,.316,z],[-.070,.372,z*.73],[.070,.372,z*.73],[.105,.316,z],[.115,.250,z]],.022,.007,[0,0,1],m.webbing,'Ручка');
    for(const x of [-.115,.115])block(parent,[.009,.009,.006],[x,.244,z+Math.sign(z)*.004],m.metal,'Заклёпка');
  }
  zipper(parent,[[-.185,.285,0],[.185,.285,0]],m.webbing,m.metal);
  // The long shoulder strap hangs along the front, distinct from the short carry handles.
  ribbon(parent,[[-.235,.237,.035],[-.252,.200,.147],[-.183,.084,.171],[0,.054,.179],[.183,.084,.171],[.252,.200,.147],[.235,.237,.035]],.027,.006,[0,0,1],m.webbing,'Плечевой ремень');
  block(parent,[.130,.027,.012],[0,.054,.179],m.rubber,'Наплечник');
  for(const s of [-1,1]){const ring=mesh(parent,new THREE.TorusGeometry(.012,.003,4,10),m.metal,'Карабин');ring.position.set(s*.235,.237,.035);ring.rotation.y=Math.PI/2;}
  const pocket=new THREE.Group();pocket.position.set(0,.09,.123);parent.add(pocket);
  upright(pocket,[{y:0,w:.177,d:.011},{y:.015,w:.196,d:.020},{y:.105,w:.184,d:.015}],m.panel,'Карман для мелочей');
  zipper(parent,[[-.079,.191,.134],[.079,.191,.134]],m.webbing,m.metal);
  badge(parent,30,0,.143,.136,m.patch,m.webbing);
  for(const s of [-1,1])edge(parent,[[s*.212,.051,-.112],[s*.222,.204,-.112],[s*.198,.259,-.084],[s*.198,.259,.084],[s*.222,.204,.112],[s*.212,.051,.112]],m.seam,.0015);
}

export function buildLuggage(shape){
  const info=EXTRA_MODEL_INFO[shape.type];if(!BAG_TYPES.includes(shape.type))throw Error('Неизвестная модель сумки');
  const standard=(color,name,metalness=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness:metalness ? .42 : .92,metalness,side:THREE.DoubleSide,flatShading:true,vertexColors:true});m.name=name;return m;};
  const m={fabric:standard(info.color,'Основная ткань'),panel:standard(info.color,'Усиленные панели'),seam:standard(info.color,'Швы'),webbing:standard('#292f34','Чёрная стропа'),rubber:standard('#1d252a','Мягкие накладки'),metal:standard('#adb8b7','Фурнитура',.65),patch:standard('#ded1b4','Нашивка')};
  const root=new THREE.Group(),inner=new THREE.Group();root.name=info.name;root.add(inner);
  ({duffel60:duffel,backpack20:backpack,travelBag30:travelBag})[shape.type](inner,m);
  mergeStatic(inner);
  const bounds=new THREE.Box3().setFromObject(inner),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),dimensions=extraDimensions(shape);
  inner.position.set(-center.x,-bounds.min.y,-center.z);root.scale.set(dimensions[0]/size.x,dimensions[1]/size.y,dimensions[2]/size.z);
  const setColor=color=>{m.fabric.color.set(color);m.panel.color.copy(m.fabric.color).multiplyScalar(.72);m.seam.color.copy(m.fabric.color).lerp(new THREE.Color('#e2d6bd'),.28);};
  setColor(shape.color||info.color);root.userData.bag={type:shape.type,capacityLiters:info.capacityLiters,setColor};
  return root;
}
export const BAG_BUILDERS=Object.fromEntries(BAG_TYPES.map(type=>[type,shape=>buildLuggage({...shape,type})]));
