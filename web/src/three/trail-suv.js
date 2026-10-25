import * as THREE from 'three';
import { box, at, rng } from './kit.js';
import { extraDimensions } from './furniture-info.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original expedition SUV. Metres, front +Z. Hinges and cabin are real geometry.
export const TRAIL_SIZE = [2.12, 2.35, 4.45];
export const TRAIL_PARTS = ['frontLeft', 'frontRight', 'tailgate', 'hood'];
const clamp = value => Number.isFinite(Number(value)) ? THREE.MathUtils.clamp(Number(value), 0, 1) : 0;
const ease = value => THREE.MathUtils.smootherstep(clamp(value),0,1);
export function trailOpeningClips(openings) {
  // Sample the same eased motion as the live controls; glTF quaternion tracks are linear between samples.
  return openings.map(part=>{
    const times=[],values=[],axis=new THREE.Vector3(part.axis==='x'?1:0,part.axis==='y'?1:0,0);
    for(let i=0;i<=40;i++){times.push(part.duration*i/40);values.push(...new THREE.Quaternion().setFromAxisAngle(axis,part.angle*ease(i/40)).toArray());}
    return new THREE.AnimationClip('Open_'+part.key,part.duration,[new THREE.QuaternionKeyframeTrack(part.pivot.name+'.quaternion',times,values)]);
  });
}
const mesh = (parent, geometry, material, name = '') => {
  const object = new THREE.Mesh(geometry, material); object.name = name; parent.add(object); return object;
};
function block(parent, w, h, d, x, y, z, material, r = .009, name = '') {
  const object = at(box(w, h, d, material, {r}), x, y, z); object.name = name; parent.add(object); return object;
}
function rod(parent, a, b, r, material, name = '', sides = 8) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
  const object = mesh(parent, new THREE.CylinderGeometry(r, r, delta.length(), sides), material, name);
  object.position.copy(from.add(to).multiplyScalar(.5));
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return object;
}
function quad(parent, points, material, name = '') {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1], 2));
  geo.setIndex([0,1,2,0,2,3]); geo.computeVertexNormals(); return mesh(parent, geo, material, name);
}
function panel(parent, outline, x, thickness, material, name = '', bevel = .008) {
  const shape = new THREE.Shape(outline.map(([z,y]) => new THREE.Vector2(-z,y)));
  const geo = new THREE.ExtrudeGeometry(shape, {depth:thickness, bevelEnabled:bevel>0, bevelSize:bevel, bevelThickness:bevel, bevelSegments:1, steps:1, curveSegments:1});
  geo.translate(0,0,-thickness/2); geo.rotateY(Math.PI/2); geo.translate(x,0,0);
  return mesh(parent,geo,material,name);
}
function batchParts(parent) {
  for (const child of [...parent.children]) if (child.isGroup) batchParts(child);
  const batches = new Map();
  // Separate glass panes must retain their depth sorting instead of becoming one transparent mesh.
  for (const child of parent.children) if (child.isMesh && !child.material.transparent) {
    const list = batches.get(child.material) || []; list.push(child); batches.set(child.material,list);
  }
  for (const [material,parts] of batches) {
    if (parts.length < 2) continue;
    const geometries = parts.map(part => {
      part.updateMatrix(); const geo = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
      for (const key of Object.keys(geo.attributes)) if (!['position','normal','uv'].includes(key)) geo.deleteAttribute(key);
      if (!geo.attributes.uv) geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
      return geo.applyMatrix4(part.matrix);
    });
    const merged = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
    for (const part of parts) { parent.remove(part); part.geometry.dispose(); }
    mesh(parent,merged,material,material.name || parts[0].name || 'Детали');
  }
}

// RGBA speckles, not translucent solid brown panels. The lower body receives more mud.
function mudTexture() {
  const size=512, data=new Uint8Array(size*size*4), random=rng(7135);
  const noise=Array.from({length:33*33},()=>random());
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const v=y/(size-1),gx=x/16,gy=y/16,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;
    const n=(noise[iy*33+ix]*(1-fx)+noise[iy*33+ix+1]*fx)*(1-fy)+(noise[(iy+1)*33+ix]*(1-fx)+noise[(iy+1)*33+ix+1]*fx)*fy;
    const density=Math.pow(1-v,3)*1.1+.025, speckle=random(), i=(y*size+x)*4;
    const alpha=(n>.53&&v<.30)||speckle<density*(.25+n)?(.65+random()*.35):0;
    const shade=38+Math.floor(random()*34); data[i]=shade+8;data[i+1]=shade+9;data[i+2]=shade+4;data[i+3]=Math.round(alpha*255);
  }
  const texture=new THREE.DataTexture(data,size,size);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}

function kayak(parent, x, color, trim, strap, offset=0) {
  const group=new THREE.Group();group.name='Байдарка';group.position.set(x,2.355,-.37+offset);parent.add(group);
  const hull=new THREE.MeshStandardMaterial({color,roughness:.56,side:THREE.DoubleSide});hull.name='Корпус байдарки '+color;
  const deck=hull.clone();deck.color.multiplyScalar(1.13);deck.name='Палуба байдарки '+color;
  const length=3.14, half=length/2, slices=18, vertices=[], indices=[];
  const width=z=>.295*Math.pow(Math.max(0,Math.sin(Math.PI*(z+half)/length)),.65);
  const lift=z=>.035*Math.pow(Math.abs(z/half),4);
  for(let i=0;i<=slices;i++){
    const z=-half+i*length/slices,w=Math.max(.006,width(z)),y=lift(z);
    for(const [xx,yy]of [[-w,.055],[-w*.88,-.055],[0,-.14],[w*.88,-.055],[w,.055]])vertices.push(xx,y+yy,z);
  }
  for(let i=0;i<slices;i++)for(let j=0;j<4;j++){const a=i*5+j,b=a+5;indices.push(a,b,b+1,a,b+1,a+1);}
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geom.setIndex(indices);geom.computeVertexNormals();mesh(group,geom,hull,'Гранёное днище');
  const outline=[];for(let i=0;i<=slices;i++){const z=-half+i*length/slices;outline.push(new THREE.Vector2(width(z),-z));}
  for(let i=slices;i>=0;i--){const z=-half+i*length/slices;outline.push(new THREE.Vector2(-width(z),-z));}
  const shape=new THREE.Shape(outline),hole=new THREE.Path();hole.absellipse(0,.08,.19,.43,0,Math.PI*2,true);shape.holes.push(hole);
  const top=new THREE.ShapeGeometry(shape,32);top.rotateX(-Math.PI/2);
  const pos=top.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,.055+lift(pos.getZ(i)));top.computeVertexNormals();mesh(group,top,deck,'Палуба с открытым кокпитом');
  block(group,.30,.028,.55,0,-.105,-.09,trim,.02,'Сиденье байдарки');
  block(group,.26,.11,.045,0,-.075,-.36,trim,.018,'Спинка байдарки');
  const ellipse=[];for(let i=0;i<=36;i++){const a=i/36*Math.PI*2;ellipse.push([Math.cos(a)*.192,.063,-.08+Math.sin(a)*.432]);}
  for(let i=1;i<ellipse.length;i++)rod(group,ellipse[i-1],ellipse[i],.012,trim);
  for(const z of [.65,.84,1.02]){const w=width(z)*.73;rod(group,[-w,.065+lift(z),z],[w,.07+lift(z+.12),z+.12],.006,strap);rod(group,[w,.065+lift(z),z],[-w,.07+lift(z+.12),z+.12],.006,strap);}
  for(const z of [-1.36,1.36])rod(group,[-.045,.09+lift(z),z],[.045,.09+lift(z),z],.012,trim,'Ручка');
  return group;
}

export function buildTrailSuv(shape={}) {
  const root=new THREE.Group();root.name='Trail Expedition';const inner=new THREE.Group();root.add(inner);
  const material=(color,roughness=.7,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness,side:THREE.DoubleSide});
  const paint=new THREE.MeshPhysicalMaterial({color:shape.color||'#278cb7',roughness:.52,metalness:.18,clearcoat:.18,clearcoatRoughness:.5,side:THREE.DoubleSide});paint.name='Краска кузова';
  const roof=material('#edf0df',.65),rubber=material('#172529',.97),trim=material('#263439',.85),silver=material('#b7c4bc',.46,.45),seat=material('#49524d',.95),fabric=material('#7a8272',.98),red=material('#cb4f45',.43),amber=material('#ed9b42',.5);
  roof.name='Слоновая кость';trim.name='Тёмные детали';rubber.name='Резина';silver.name='Металл';
  const glass=new THREE.MeshPhysicalMaterial({color:'#89b3be',roughness:.16,metalness:0,transparent:true,opacity:.30,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,clearcoat:.5,clearcoatRoughness:.13});glass.name='Слегка тонированное стекло';
  const lamp=material('#fff1cc',.35);lamp.emissive.set('#ffd4a0');lamp.emissiveIntensity=.25;lamp.name='Линзы задних фонарей';
  const headlamp=lamp.clone();headlamp.name='Фары';
  const headlights=[],openings=[];
  function hinge(key,position,axis,angle,duration=.9){const pivot=new THREE.Group();pivot.name=key;pivot.position.set(...position);inner.add(pivot);openings.push({key,pivot,axis,angle,duration});return pivot;}
  const mud=new THREE.MeshStandardMaterial({map:mudTexture(),roughness:1,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,side:THREE.DoubleSide});mud.name='Грязь на кузове';
  function dirty(part,axis='side'){
    part.updateMatrix();const source=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();source.applyMatrix4(part.matrix);
    const p=source.attributes.position,n=source.attributes.normal,positions=[],normals=[],uv=[];
    for(let i=0;i<p.count;i+=3){
      const coord=axis==='side'?p.getX(i):p.getZ(i),normal=axis==='side'?n.getX(i):n.getZ(i);
      if(normal*Math.sign(coord)<.8)continue;
      for(let j=i;j<i+3;j++){
        positions.push(p.getX(j)+n.getX(j)*.001,p.getY(j),p.getZ(j)+n.getZ(j)*.001);normals.push(n.getX(j),n.getY(j),n.getZ(j));
        uv.push((axis==='side'?p.getZ(j)+2.16:p.getX(j)+.95)/(axis==='side'?4.32:1.90),THREE.MathUtils.clamp((p.getY(j)-.48)/1.1,0,1));
      }
    }
    source.dispose();const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));mesh(part.parent,geo,mud,'Следы грязи');
  }
  block(inner,1.50,.11,3.62,0,.39,-.02,trim,.015,'Рама');
  block(inner,1.65,.07,2.86,0,.65,-.54,trim,.008,'Пол салона');
  for(const z of [-1.24,1.24])rod(inner,[-.91,.45,z],[.91,.45,z],.065,trim,'Мост');
  for(const s of [-1,1]){
    const front=[[.71,.51],[.71,1.465],[1.04,1.465],[2.075,1.32],[2.10,1.27],[2.10,.51],[1.81,.51],[1.81,.73],[1.63,1.02],[.91,1.02],[.69,.73]];
    dirty(panel(inner,front,s*.89,.065,paint,'Переднее крыло'));
    const rear=[[-.60,.51],[-.60,1.46],[-2.075,1.46],[-2.075,.51],[-1.81,.51],[-1.81,.73],[-1.63,1.02],[-.91,1.02],[-.69,.73],[-.69,.51]];
    dirty(panel(inner,rear,s*.89,.065,paint,'Заднее крыло'));
    for(const z of [-1.25,1.25]){
      const arc=[[z+.56,.53],[z+.56,.73],[z+.38,1.025],[z-.34,1.025],[z-.55,.73],[z-.55,.53]];
      for(let i=1;i<arc.length;i++)rod(inner,[s*.933,arc[i-1][1],arc[i-1][0]],[s*.933,arc[i][1],arc[i][0]],.016,paint,'Кромка арки');
      block(inner,.35,.30,.028,s*.88,.24,z-.47,rubber,0,'Брызговик');
    }
    dirty(block(inner,.09,.105,1.24,s*.89,.47,.055,paint,.008,'Порог'));
    block(inner,.23,.055,1.25,s*.96,.43,.015,trim,.012,'Подножка');
    for(let i=0;i<4;i++)block(inner,.13,.008,.06,s*.97,.485,-.44+i*.28,silver,0);
    block(inner,.075,.047,1.47,s*.92,1.40,-1.34,paint,.006,'Пояс заднего крыла');
  }
  // Broad hood, restrained pressed ridges and an upright rectangular nose.
  const hoodPivot=hinge('hood',[0,1.477,.79],'x',-1.08,1.15),hoodBody=new THREE.Group();hoodBody.position.set(0,-1.477,-.79);hoodPivot.add(hoodBody);
  const hood=[[-.89,1.477,.79],[.89,1.477,.79],[.89,1.335,2.08],[-.89,1.335,2.08]];
  quad(hoodBody,hood,paint,'Капот');
  quad(hoodBody,hood.map(([x,y,z])=>[x,y-.025,z]),trim,'Внутренняя сторона капота');
  block(hoodBody,1.78,.045,.035,0,1.292,2.086,paint,.006,'Передняя кромка капота');
  for(const s of [-1,1]){
    quad(hoodBody,[[s*.46,1.49,.84],[s*.52,1.49,.84],[s*.52,1.35,2.03],[s*.46,1.35,2.03]],paint,'Штамповка капота');
    rod(hoodBody,[s*.62,1.435,.90],[s*.62,1.31,1.98],.020,paint,'Усилитель капота');
    rod(hoodBody,[s*.88,1.464,.80],[s*.88,1.323,2.07],.014,paint,'Кромка капота');
  }
  // Engine bay is visible only after lifting the hood; its contents stay below the closed panel.
  const engine=new THREE.Group();engine.name='Моторный отсек';inner.add(engine);
  block(engine,1.56,.07,1.22,0,.78,1.41,trim,.01,'Поддон моторного отсека');
  block(engine,1.54,.48,.055,0,.86,.84,trim,.006,'Перегородка салона');
  block(engine,.72,.27,.67,0,.90,1.39,trim,.026,'Блок двигателя');
  block(engine,.57,.14,.56,0,1.17,1.37,silver,.019,'Крышка двигателя');
  for(let i=0;i<6;i++)block(engine,.46,.012,.025,0,1.312,1.16+i*.078,trim,.002,'Рёбра крышки');
  block(engine,.32,.21,.28,-.58,.99,1.11,trim,.008,'Аккумулятор');
  block(engine,.28,.022,.25,-.58,1.20,1.11,rubber,.004);
  block(engine,.052,.025,.052,-.67,1.223,1.18,red,.003,'Плюсовая клемма');
  block(engine,.052,.025,.052,-.49,1.223,1.18,silver,.003,'Клемма');
  block(engine,.30,.22,.26,.57,1.00,1.13,roof,.022,'Расширительный бачок');
  block(engine,.07,.035,.07,.57,1.22,1.13,amber,.008,'Крышка бачка');
  block(engine,1.26,.37,.09,0,.88,1.96,trim,.009,'Радиатор');
  for(let i=0;i<14;i++)rod(engine,[-.57+i*.087,.91,2.015],[-.57+i*.087,1.22,2.015],.007,silver);
  const filter=mesh(engine,new THREE.CylinderGeometry(.18,.18,.09,20),trim,'Воздушный фильтр');filter.position.set(-.51,1.22,1.62);
  for(const [a,b]of [[[-.34,1.22,1.62],[-.10,1.22,1.50]],[[.29,1.13,1.58],[.48,1.12,1.82]],[[.48,1.12,1.82],[.29,1.08,1.92]]])rod(engine,a,b,.037,rubber,'Патрубок');
  dirty(block(inner,1.78,.43,.07,0,.86,2.065,paint,.008,'Передняя панель'),'front');
  block(inner,1.76,.37,.025,0,.90,2.113,trim,.008,'Решётка');
  for(const x of [-.735,.735]){
    block(inner,.30,.34,.025,x,.918,2.14,silver,.006,'Рамка фары');
    block(inner,.255,.255,.02,x,.966,2.157,trim,.003);
    const ring=mesh(inner,new THREE.CylinderGeometry(.117,.117,.028,24),silver);ring.rotation.x=Math.PI/2;ring.position.set(x,1.095,2.176);
    const light=mesh(inner,new THREE.CylinderGeometry(.096,.096,.035,24),headlamp,'Круглая фара');light.rotation.x=Math.PI/2;light.position.set(x,1.095,2.195);
    const beam=new THREE.SpotLight('#ffe6b5',45,12,.36,.68,2);beam.name=x<0?'Левая фара':'Правая фара';beam.position.set(x,1.095,2.23);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),new THREE.Vector3(x*.025,-.20,1).normalize());
    // Local -Z is also the glTF light direction, so the exported beams point forwards.
    beam.target.position.set(0,0,-1);beam.add(beam.target);beam.castShadow=true;beam.shadow.mapSize.set(512,512);beam.shadow.camera.near=.05;beam.shadow.bias=-.0002;beam.shadow.normalBias=.015;
    inner.add(beam);headlights.push(beam);
    block(inner,.245,.051,.026,x,.928,2.176,amber,.003,'Указатель поворота');
    for(let i=0;i<4;i++)block(inner,.005,.04,.004,x-.08+i*.053,.933,2.192,silver,0);
  }
  for(let i=0;i<4;i++)block(inner,1.12,.032,.033,0,.937+i*.083,2.15,silver,.003,'Полоса решётки');
  for(const x of [-.58,.58])block(inner,.035,.35,.037,x,.915,2.16,silver,.003);
  block(inner,1.94,.16,.19,0,.66,2.16,silver,.014,'Силовой бампер');
  for(const x of [-.975,.975])block(inner,.15,.15,.23,x,.665,2.105,trim,.008);
  block(inner,.61,.13,.26,0,.65,2.255,paint,.012,'Лебёдка');
  rod(inner,[-.23,.805,2.20],[.23,.805,2.20],.075,trim,'Барабан лебёдки',16);
  for(let i=0;i<13;i++){
    const cable=mesh(inner,new THREE.TorusGeometry(.078,.008,4,12),silver);cable.rotation.y=Math.PI/2;cable.position.set(-.18+i*.03,.805,2.20);
  }
  block(inner,.29,.065,.035,0,.69,2.40,trim,.004,'Клюз');
  block(inner,.20,.017,.008,0,.713,2.42,silver,0);
  for(const x of [-.32,.32])block(inner,.065,.30,.10,x,.69,2.17,trim,.008,'Бамперный упор');
  for(const x of [-.68,.68]){
    block(inner,.055,.085,.065,x,.69,2.285,trim,.004);
    const shackle=mesh(inner,new THREE.TorusGeometry(.055,.014,5,12,Math.PI*1.6),red,'Буксировочная скоба');shackle.position.set(x,.659,2.319);shackle.rotation.z=-Math.PI*.3;
    rod(inner,[x-.04,.70,2.319],[x+.04,.70,2.319],.014,silver);
  }
  // Cabin shell: white posts surround empty window and door openings.
  block(inner,1.72,.074,2.33,0,2.08,-.94,roof,.025,'Белая крыша');
  block(inner,1.80,.025,2.38,0,2.071,-.94,roof,.008,'Водосток');
  quad(inner,[[-.83,1.49,.785],[.83,1.49,.785],[.767,2.057,.279],[-.767,2.057,.279]],glass,'Лобовое стекло');
  for(const s of [-1,1]){
    rod(inner,[s*.89,1.46,.81],[s*.79,2.08,.27],.043,roof,'Передняя стойка');
    rod(inner,[s*.79,2.073,.27],[s*.79,2.073,-2.04],.033,roof,'Верхняя рамка');
    panel(inner,[[-.58,1.46],[-.58,2.09],[-.70,2.09],[-.70,1.46]],s*.849,.075,roof,'Средняя стойка');
    panel(inner,[[-2.10,1.46],[-1.99,2.08],[-1.86,2.08],[-1.98,1.46]],s*.84,.07,roof,'Задняя стойка');
    quad(inner,[[s*.89,1.535,-.71],[s*.89,1.535,-1.968],[s*.79,2.014,-1.883],[s*.79,2.014,-.71]],glass,'Заднее боковое стекло');
    rod(inner,[s*.89,1.505,-.68],[s*.89,1.505,-2.025],.035,roof,'Нижняя рамка окна');
    block(inner,.08,.60,.10,s*.77,.75,-1.93,trim,.007,'Задняя обшивка');
  }
  rod(inner,[-.83,1.47,.82],[.83,1.47,.82],.023,trim,'Уплотнитель лобового стекла');
  for(const x of [-.41,.41]){
    rod(inner,[x+.17,1.48,.818],[x-.02,1.60,.72],.012,silver,'Поводок дворника');
    rod(inner,[x-.22,1.605,.723],[x+.19,1.605,.723],.016,trim,'Дворник');
  }
  for(const s of [-1,1]){
    const key=s<0?'frontLeft':'frontRight',door=hinge(key,[s*.90,0,.72],'y',-s*1.22);
    // Model in body coordinates, then move vertices into the hinge's local frame.
    const group=new THREE.Group();group.position.set(-s*.90,0,-.72);door.add(group);
    dirty(panel(group,[[.704,.572],[.704,1.454],[-.575,1.454],[-.575,.572]],s*.89,.058,paint,'Дверь'));
    block(group,.075,.047,1.27,s*.92,1.40,.061,paint,.006,'Пояс двери');
    quad(group,[[s*.897,1.51,.674],[s*.897,1.51,-.565],[s*.799,2.022,-.565],[s*.799,2.022,.216]],glass,'Стекло двери');
    rod(group,[s*.903,1.48,-.595],[s*.804,2.061,-.595],.026,roof,'Стойка двери');
    rod(group,[s*.80,2.048,-.57],[s*.80,2.048,.245],.024,roof,'Рамка двери');
    block(group,.026,.52,.99,s*.851,.78,.042,trim,.006,'Обшивка двери');
    block(group,.11,.045,.35,s*.79,1.15,-.07,fabric,.009,'Подлокотник');
    block(group,.037,.045,.18,s*.942,1.31,-.405,trim,.004,'Ручка двери');
    block(group,.042,.019,.16,s*.955,1.328,-.405,silver,.002);
    for(const z of [.57,.64])rod(group,[s*.925,1.31,z],[s*1.08,1.54,z+.035],.017,silver,'Кронштейн зеркала');
    block(group,.15,.22,.09,s*1.10,1.50,.63,roof,.018,'Зеркало');
    block(group,.118,.171,.008,s*1.10,1.524,.579,silver,.008,'Зеркальная поверхность');
  }
  // Antenna has a spring base rather than being a floating pole.
  rod(inner,[-.81,1.49,.99],[-.84,2.33,.99],.009,trim,'Антенна');
  rod(inner,[-.81,1.49,.99],[-.816,1.68,.99],.018,trim);
  for(let i=0;i<10;i++){const spring=mesh(inner,new THREE.TorusGeometry(.020,.004,4,8),silver);spring.rotation.x=Math.PI/2;spring.position.set(-.812,1.51+i*.014,.99);}
  // The tailgate is a hollow panel with a window; it opens above the load bay.
  const hatch=hinge('tailgate',[0,2.075,-2.058],'x',1.65,1.2),hatchBody=new THREE.Group();hatchBody.position.set(0,-2.075,2.058);hatch.add(hatchBody);
  const tail=block(hatchBody,1.62,.72,.065,0,.72,-2.052,paint,.009,'Пятая дверь');dirty(tail,'front');
  quad(hatchBody,[[-.755,1.49,-2.085],[.755,1.49,-2.085],[.755,2.015,-1.999],[-.755,2.015,-1.999]],glass,'Стекло багажника');
  for(const s of [-1,1])rod(hatchBody,[s*.79,1.44,-2.082],[s*.79,2.048,-1.988],.031,roof);
  rod(hatchBody,[-.79,1.47,-2.084],[.79,1.47,-2.084],.027,roof);
  block(hatchBody,.20,.037,.04,0,1.28,-2.102,trim,.005,'Ручка багажника');
  block(hatchBody,.30,.11,.014,0,.89,-2.096,silver,.004,'Номерная табличка');
  for(const s of [-1,1]){
    block(inner,.13,.32,.075,s*.87,.83,-2.10,trim,.006);
    block(inner,.09,.18,.015,s*.87,.955,-2.146,red,.004,'Задний фонарь');
    block(inner,.09,.055,.015,s*.87,.89,-2.146,lamp,.002);
    block(inner,.09,.055,.015,s*.87,.831,-2.146,amber,.002);
  }
  block(inner,1.94,.14,.18,0,.57,-2.12,silver,.01,'Задний бампер');
  rod(inner,[0,.50,-2.07],[0,.45,-2.29],.032,trim,'Фаркоп');
  const ball=mesh(inner,new THREE.SphereGeometry(.04,10,6),silver);ball.position.set(0,.49,-2.29);
  // Furnished interior, visible through open doors. Leave the passenger footwell free for stored things.
  for(const x of [-.43,.43]){
    block(inner,.52,.13,.53,x,.74,.0,seat,.035,'Переднее сиденье');
    const back=block(inner,.52,.55,.12,x,.84,-.24,seat,.028,'Спинка');back.rotation.x=-.10;
    block(inner,.32,.18,.11,x,1.38,-.285,fabric,.02,'Подголовник');
    block(inner,.37,.025,.39,x,.872,.0,fabric,.018);
    block(inner,.37,.38,.017,x,.96,-.155,fabric,.016);
  }
  block(inner,1.36,.13,.45,0,.79,-.86,seat,.025,'Задний диван');
  block(inner,1.36,.50,.13,0,.88,-1.07,seat,.02,'Задняя спинка');
  for(const x of [-.46,.46])block(inner,.30,.17,.10,x,1.36,-1.08,fabric,.02);
  block(inner,1.53,.22,.26,0,1.20,.60,trim,.025,'Приборная панель');
  block(inner,.27,.12,.014,-.43,1.32,.458,silver,.003,'Приборы');
  for(const x of [-.50,-.37]){const dial=mesh(inner,new THREE.CircleGeometry(.046,16),rubber);dial.position.set(x,1.379,.448);dial.rotation.y=Math.PI;rod(inner,[x,1.38,.444],[x-.018,1.404,.444],.003,lamp);}
  block(inner,.19,.06,.02,0,1.31,.452,silver,.003,'Радио');
  for(const x of [-.11,.11]){const knob=mesh(inner,new THREE.CylinderGeometry(.015,.015,.02,8),rubber);knob.rotation.x=Math.PI/2;knob.position.set(x,1.33,.436);}
  const steering=new THREE.Group();steering.position.set(-.43,1.29,.34);steering.rotation.x=-.30;inner.add(steering);
  mesh(steering,new THREE.TorusGeometry(.155,.018,6,24),rubber,'Руль');
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod(steering,[0,0,0],[Math.cos(a)*.14,Math.sin(a)*.14,0],.012,silver);}
  block(steering,.08,.07,.04,0,-.035,0,trim,.006);
  block(inner,.18,.15,.65,0,.72,.16,trim,.014,'Центральный тоннель');
  rod(inner,[0,.87,.30],[0,1.03,.24],.013,silver,'Рычаг КПП');block(inner,.045,.04,.05,0,1.02,.24,rubber,.009);
  block(inner,1.42,.035,.83,0,.72,-1.57,trim,.006,'Пол багажника');
  for(const s of [-1,1])block(inner,.20,.24,.76,s*.70,.75,-1.56,trim,.02,'Колёсная ниша внутри');
  // Wide tyres: continuous carcass, two rows of staggered tread blocks and recessed rims.
  for(const s of [-1,1])for(const z of [-1.25,1.25]){
    const wheel=new THREE.Group();wheel.name='Колесо';wheel.userData.wheel=true;wheel.position.set(s*.91,.465,z);wheel.rotation.z=-s*Math.PI/2;inner.add(wheel);
    const profile=[[.235,-.15],[.34,-.17],[.408,-.13],[.432,-.085],[.432,.085],[.408,.13],[.34,.17],[.235,.15],[.235,-.15]].map(([r,y])=>new THREE.Vector2(r,y));
    mesh(wheel,new THREE.LatheGeometry(profile,28),rubber,'Покрышка');
    for(let j=0;j<28;j++)for(const row of [-1,1]){
      const a=(j+(row<0?.35:0))/28*Math.PI*2;
      const tread=new THREE.Mesh(new THREE.BoxGeometry(.100,.145,.043),rubber);tread.position.set(Math.sin(a)*.438,row*.075,Math.cos(a)*.438);tread.rotation.y=a;tread.rotation.z=row*.22;wheel.add(tread);
      if(j%2===0){const shoulder=new THREE.Mesh(new THREE.BoxGeometry(.062,.047,.065),rubber);shoulder.position.set(Math.sin(a)*.392,row*.159,Math.cos(a)*.392);shoulder.rotation.y=a;wheel.add(shoulder);}
    }
    const wheelMetal=material('#526364',.62,.4);wheelMetal.name='Тёмный диск';
    const rim=mesh(wheel,new THREE.CylinderGeometry(.245,.245,.27,24),wheelMetal);rim.position.y=.015;
    const recess=mesh(wheel,new THREE.CylinderGeometry(.215,.215,.285,24),trim);recess.position.y=.015;
    for(let i=0;i<6;i++){
      const a=i/6*Math.PI*2;rod(wheel,[Math.sin(a)*.065,.163,Math.cos(a)*.065],[Math.sin(a+.10)*.207,.163,Math.cos(a+.10)*.207],.032,wheelMetal,'Спица');
      const bolt=mesh(wheel,new THREE.CylinderGeometry(.012,.012,.014,6),silver);bolt.position.set(Math.sin(a)*.067,.181,Math.cos(a)*.067);
    }
    const hub=mesh(wheel,new THREE.CylinderGeometry(.052,.052,.33,12),trim);hub.position.y=.025;
    const lip=mesh(wheel,new THREE.TorusGeometry(.229,.012,5,24),wheelMetal);lip.rotation.x=Math.PI/2;lip.position.y=.16;
  }
  // Roof equipment is part of this one vehicle, with proper saddles and straps.
  for(const z of [-1.58,-.18]){
    for(const s of [-1,1])block(inner,.065,.14,.11,s*.76,2.14,z,trim,.005,'Опора багажника');
    rod(inner,[-.90,2.29,z],[.90,2.29,z],.025,silver,'Поперечина');
    for(const x of [-.39,.39])block(inner,.41,.06,.14,x,2.285,z,rubber,.008,'Опора байдарки');
  }
  kayak(inner,-.39,'#df6046',trim,silver,-.09);kayak(inner,.39,'#c3d944',trim,trim,.09);
  // A paddle along the roof rack, underneath the boats.
  rod(inner,[-.84,2.33,-1.85],[-.84,2.33,.78],.012,silver,'Весло');
  for(const z of [-1.70,.64]){
    const blade=panel(inner,[[z-.23,2.33],[z-.13,2.38],[z+.18,2.38],[z+.24,2.33],[z+.18,2.28],[z-.13,2.28]],-.84,.09,paint,'Лопасть весла',.01);blade.rotation.z=.1;
  }
  batchParts(inner);
  inner.traverse(o=>{if(o.isMesh&&o.material===glass){o.userData.noShadow=true;o.castShadow=false;o.receiveShadow=false;}});
  const bounds=new THREE.Box3().setFromObject(inner),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  inner.position.set(-center.x,-bounds.min.y,-center.z);
  const dimensions=extraDimensions({type:'trailSuv',...shape})||TRAIL_SIZE;
  root.scale.set(dimensions[0]/size.x,dimensions[1]/size.y,dimensions[2]/size.z);
  openings.sort((a,b)=>TRAIL_PARTS.indexOf(a.key)-TRAIL_PARTS.indexOf(b.key));
  const transitions=new Map();let animationTime=null,lightingScale=1,lampsOn=true;
  const setOpen=(key,value)=>{const part=openings.find(o=>o.key===key);if(part){transitions.delete(key);part.pivot.rotation[part.axis]=part.angle*clamp(value);}};
  const animateOpen=(key,value)=>{
    const part=openings.find(o=>o.key===key);if(!part)return;
    const from=part.pivot.rotation[part.axis],to=part.angle*clamp(value);
    if(Math.abs(from-to)<1e-6){setOpen(key,value);return;}
    transitions.set(key,{part,from,to,start:animationTime,duration:part.duration*Math.max(.4,Math.abs(to-from)/Math.abs(part.angle))});
  };
  const animate=(time,{reduceMotion=false}={})=>{
    animationTime=Number.isFinite(time)?time:animationTime??0;
    for(const [key,motion]of transitions){
      motion.start??=animationTime;const progress=reduceMotion?1:clamp((animationTime-motion.start)/motion.duration);
      motion.part.pivot.rotation[motion.part.axis]=THREE.MathUtils.lerp(motion.from,motion.to,ease(progress));
      if(progress===1)transitions.delete(key);
    }
    return transitions.size>0;
  };
  const setHeadlights=value=>{lampsOn=Boolean(value);for(const light of headlights){light.intensity=lampsOn?45*lightingScale**2:0;light.distance=12*lightingScale;}headlamp.emissiveIntensity=lampsOn?3.5:.02;};
  const setLightingScale=value=>{lightingScale=Number.isFinite(value)&&value>0?value:1;setHeadlights(lampsOn);};
  const setDirt=value=>{mud.opacity=clamp(value)*.95;mud.visible=mud.opacity>0;rubber.color.set('#172529').lerp(new THREE.Color('#443e32'),clamp(value)*.38);};
  root.userData.vehicle={openings,setOpen,animateOpen,animate,setDirt,setColor:value=>paint.color.set(value),headlights,setHeadlights,setLightingScale,get lightingScale(){return lightingScale;},get moving(){return transitions.size>0;},inner};root.userData.wheelCount=4;
  root.userData.furnitureAnimate=animate;
  for(const part of openings)setOpen(part.key,shape.vehicleOpen?.[part.key]);
  setDirt(shape.dirt??.45);
  setHeadlights(shape.headlights!==false);
  return root;
}
