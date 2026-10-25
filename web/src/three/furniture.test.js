import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildFurniture,footprint,FURNITURE_TYPES} from './furniture.js';
import {EXTRA_MODEL_INFO,extraDimensions} from './furniture-info.js';
import {shelfOpening} from './ikea-shelves.js';
import {parrotState} from './parrot-cage.js';
import {collectFurnitureAnimators,animateFurniture} from './furniture-animation.js';
import * as M from '../inventory/model.js';
import {readFileSync} from 'node:fs';

const bounds=item=>new THREE.Box3().setFromObject(buildFurniture([{id:'test-model',pos:[0,0],...item}]));
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<0.00001,`${actual} != ${expected}`);
test('cage count survives a backup and birds hop inside the cage with occasional speech',()=>{
  const d=M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8'))),plan=structuredClone(d.plan),room=plan.rooms[0];
  for(const count of [1,2])plan.furniture.push({id:'cage-'+count,type:'parrotCage',parrotCount:count,pos:[room.rect[0]+1,room.rect[1]+1]});
  M.syncPlan(d,plan);const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);
  for(const count of [1,2]){
    const shape=copy.plan.furniture.find(f=>f.id==='cage-'+count),model=buildFurniture([{...shape,pos:[0,0]}]),animators=collectFurnitureAnimators(model),birds=[],speech=[];
    model.traverse(o=>{if(Number.isInteger(o.userData.parrotIndex))birds.push(o);if(o.userData.speech)speech.push(o);});
    assert.equal(birds.length,count);assert.equal(animators.length,1);
    animateFurniture(animators,4.65);const jumpPosition=birds[0].position.clone();assert.ok(jumpPosition.y>.26&&jumpPosition.y<.58);
    animateFurniture(animators,5);near(birds[0].position.x,.16);near(birds[0].position.y,.46);
    animateFurniture(animators,2.1);assert.ok(speech.some(o=>o.visible&&o.userData.speech==='music'));
    animateFurniture(animators,92.1);assert.ok(speech.some(o=>o.visible&&o.userData.speech==='swear'));
    for(let time=0;time<105;time+=.25){animateFurniture(animators,time);model.updateMatrixWorld(true);for(const b of birds){const bounds=new THREE.Box3().setFromObject(b);assert.ok(bounds.min.x>-.30&&bounds.max.x<.30);assert.ok(bounds.min.y>.06&&bounds.max.y<.71);assert.ok(bounds.min.z>-.205&&bounds.max.z<.205);}}
    assert.equal(animateFurniture(animators,30,{reduceMotion:true}),false);near(birds[0].position.y,.26);assert.ok(speech.every(o=>!o.visible));
    model.visible=false;const frozen=birds[0].position.clone();assert.equal(animateFurniture(animators,4.65),false);assert.deepEqual(birds[0].position,frozen);
    model.visible=true;animateFurniture(animators,4.65);assert.deepEqual(birds[0].position,jumpPosition);
  }
  let music=0,swears=0;
  for(let episode=0;episode<110;episode++){const state=parrotState(0,2.1+episode*9);state.speech==='swear'?swears++:music++;}
  assert.equal(music,100);assert.equal(swears,10);
});
test('KALLAX has equal square openings and IVAR contents stand above each shelf board',()=>{
  const shape={type:'kallaxShelf'},cells=[];
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    const cell=shelfOpening(shape,[col/4,row/4,1/4,1/4]);cells.push(cell);
    near(cell.width,cell.height);near(cell.width,.334);near(cell.baseY,.0375+(3-row)*.352);
    near(cell.centerX,-1.47/2+.04+col*.352+.334/2);
  }
  assert.equal(new Set(cells.map(c=>[c.centerX,c.baseY].join(':'))).size,16);
  for(let row=0;row<4;row++){
    const cell=shelfOpening({type:'ivarRack'},[0,row/4,1,1/4]);
    near(cell.baseY,.10+(3-row)*.41);near(cell.height,.39);near(cell.depth,.28);
  }
});
test('all catalog models render finite geometry on the floor and match their plan footprint',()=>{
  assert.equal(Object.keys(EXTRA_MODEL_INFO).length,43);
  for(const [type,info]of Object.entries(EXTRA_MODEL_INFO)){
    assert.ok(FURNITURE_TYPES.includes(type));
    const root=buildFurniture([{id:'sample',type,pos:[0,0]}]),box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
    near(box.min.y,0);near(size.x,info.size[0]);near(size.y,info.size[1]);near(size.z,info.size[2]);
    assert.deepEqual(footprint({type}),[info.size[0],info.size[2]]);
    let meshes=0;root.traverse(n=>{if(!n.isMesh)return;meshes++;assert.equal(n.userData.id,'sample');assert.equal(n.userData.kind,'furniture');const pos=n.geometry.getAttribute('position');for(const value of pos.array)assert.ok(Number.isFinite(value),type+' has invalid vertices');});assert.ok(meshes>0,type);
  }
});
test('new model width, height, depth, rotation and elevation survive geometry construction',()=>{
  for(const type of Object.keys(EXTRA_MODEL_INFO)){
    const b=bounds({type,width:1.3,height:1.7,depth:0.8,rot:90,y:0.6}),size=b.getSize(new THREE.Vector3());
    const dims=EXTRA_MODEL_INFO[type].fixedSize?EXTRA_MODEL_INFO[type].size:[1.3,1.7,.8];
    near(size.x,dims[2]);near(size.z,dims[0]);near(size.y,dims[1]);near(b.min.y,0.6);
  }
});
test('four tires support a vertical stack and an upright row with different occupied footprints',()=>{
  for(const layout of ['stack','row']){
    const root=buildFurniture([{type:'tireStack',pos:[0,0],layout}]);assert.equal(root.children[0].userData.tireCount,4);
    const size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()),dim=extraDimensions({type:'tireStack',layout});near(size.x,dim[0]);near(size.y,dim[1]);near(size.z,dim[2]);
  }
  assert.ok(footprint({type:'tireStack',layout:'row'})[0]>footprint({type:'tireStack'})[0]);
});
test('crossover has four wheels and both chaise configurations stay in the same sofa footprint',()=>{
  const car=buildFurniture([{type:'crossover',pos:[0,0]}]);assert.equal(car.children[0].userData.wheelCount,4);
  let wheels=0;car.traverse(n=>{if(n.userData.wheel)wheels++;});assert.equal(wheels,4);
  for(const chaise of ['left','right']){const s=bounds({type:'cornerSofa',chaise}).getSize(new THREE.Vector3());near(s.x,2.65);near(s.z,1.55);}
});
test('invalid optional dimensions fall back without creating NaN or inverted geometry',()=>{
  for(const value of [NaN,Infinity,-5,0,'2']){
    const item={type:'metalRack',width:value,height:value,depth:value};assert.deepEqual(extraDimensions(item),EXTRA_MODEL_INFO.metalRack.size);
    const b=bounds(item);assert.ok(Number.isFinite(b.max.x)&&b.min.y>=-0.00001);
  }
});
test('placing new models assigns their real category and preserves variants through JSON backups',()=>{
  const d=M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8'))),room=d.plan.rooms[0],plan=structuredClone(d.plan);
  for(const type of ['washingMachine','tireStack','crossover','metalRack'])plan.furniture.push({id:'new-'+type,type,pos:[room.rect[0]+0.6,room.rect[1]+0.6],layout:'row',width:0.9,height:1.1,depth:0.4});
  M.syncPlan(d,plan);M.validate(d);const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);
  for(const [type,category]of [['washingMachine','appliances'],['tireStack','decor'],['crossover','other'],['metalRack','furniture']]){
    assert.equal(copy.nodes.find(n=>n.furnitureId==='new-'+type).categoryId,category);assert.equal(copy.plan.furniture.find(f=>f.id==='new-'+type).layout,'row');
  }
});

test('equipment specifications round-trip in cards and cockpit storage is idempotent',()=>{
  const d=M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8'))),room=d.plan.rooms[0],plan=structuredClone(d.plan);
  for(const type of ['pcCase','macBook','simCockpit'])plan.furniture.push({id:'equipment-'+type,type,pos:[room.rect[0]+.6,room.rect[1]+.6],equipmentFields:type==='simCockpit'?{'База руля':'Моя база DD','КПП':'Секвентальная'}:{'Процессор':'Мой процессор','ОЗУ':'32 ГБ','Накопитель':'SSD 2 ТБ'}});
  M.syncPlan(d,plan);M.initializeStorage(d);M.initializeStorage(d);M.validate(d);
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);
  for(const type of ['pcCase','macBook','simCockpit']){
    const card=copy.nodes.find(n=>n.furnitureId==='equipment-'+type);assert.equal(card.categoryId,'electronics');
    assert.equal(card.fields[type==='simCockpit'?'База руля':'Процессор'],type==='simCockpit'?'Моя база DD':'Мой процессор');
    assert.equal(copy.plan.furniture.find(f=>f.id===card.furnitureId).equipmentFields,undefined);
    if(type==='simCockpit'){const storage=copy.nodes.filter(n=>n.parentId===card.id&&n.equipmentStorage);assert.equal(storage.length,1);assert.equal(storage[0].name,'Внутреннее хранилище');const stored=M.newNode(copy,{name:'Перчатки',parentId:storage[0].id,categoryId:'electronics'});assert.equal(stored.parentId,storage[0].id);}
    card.fields['ОЗУ']='64 ГБ';
  }
  M.syncPlan(copy,structuredClone(copy.plan));assert.equal(copy.nodes.find(n=>n.furnitureId==='equipment-pcCase').fields['ОЗУ'],'64 ГБ');
});

test('PC has a transparent side wall, emissive components and real interior light',()=>{
  let panel=false,emissive=0,lights=0;
  buildFurniture([{id:'pc',type:'pcCase',pos:[0,0]}]).traverse(n=>{if(n.userData.sidePanel)panel=n.material.transparent&&n.material.opacity<1;if(n.isPointLight)lights++;if(n.isMesh&&n.material.emissive?.getHex())emissive++;});
  assert.ok(panel);assert.ok(emissive>3);assert.equal(lights,1);
});

test('cockpit storage opens its own lid and keeps the seat intact', async()=>{
  const {buildFurnitureInterior}=await import('./furniture-interior.js');
  const view=buildFurnitureInterior({id:'cockpit',type:'simCockpit',pos:[0,0]},[{nodeId:'storage',name:'Внутреннее хранилище',kind:'compartment',rect:[0,0,1,1]}]);
  let lid;view.root.traverse(n=>{if(n.userData.storageLid)lid=n;});assert.ok(lid);
  const y=lid.position.y;view.animate(1);assert.ok(lid.position.y>y);view.animate(0);near(lid.position.y,y);
  assert.equal(view.hits.length,1);assert.equal(view.hits[0].userData.id,'storage');assert.equal(view.labels[0].nodeId,'storage');
});

test('triple cockpit has exactly three monitors, specifications and one storage compartment',()=>{
  const model=buildFurniture([{id:'triple',type:'simCockpitTriple',pos:[0,0]}]);let monitors=0;model.traverse(n=>{if(n.userData.monitor)monitors++;});assert.equal(monitors,3);
  const d=M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8'))),room=d.plan.rooms[0],plan=structuredClone(d.plan);
  plan.furniture.push({id:'triple',type:'simCockpitTriple',pos:[room.rect[0]+1,room.rect[1]+1],equipmentFields:{'База руля':'Direct Drive','Руль':'GT'}});
  M.syncPlan(d,plan);M.initializeStorage(d);M.validate(d);const card=d.nodes.find(n=>n.furnitureId==='triple');assert.equal(card.fields['Руль'],'GT');assert.equal(d.nodes.filter(n=>n.parentId===card.id&&n.equipmentStorage).length,1);
});
test('printer cabinet matches both printer footprints and preserves shelf contents on reload',()=>{
  for(const type of ['printer3dOpen','printer3dEnclosed'])assert.deepEqual(footprint({type}),footprint({type:'printerCabinet'}));
  const d=M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8'))),room=d.plan.rooms[0],plan=structuredClone(d.plan);
  plan.furniture.push({id:'print-cabinet',type:'printerCabinet',pos:[room.rect[0]+1,room.rect[1]+1]});M.syncPlan(d,plan);
  const card=d.nodes.find(n=>n.furnitureId==='print-cabinet'),shelves=d.nodes.filter(n=>n.parentId===card.id);assert.equal(shelves.length,2);
  const item=M.newNode(d,{name:'Пластик',parentId:shelves[0].id,categoryId:'electronics'});
  M.migrate(d);M.validate(d);assert.equal(d.nodes.filter(n=>n.parentId===card.id).length,2);assert.equal(M.getNode(d,item.id).parentId,shelves[0].id);
});
test('PC default name migrates while custom names stay unchanged',()=>{
  const d=M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8'))),room=d.plan.rooms[0],plan=structuredClone(d.plan);
  for(const [id,name]of [['default-pc','Корпус ПК с подсветкой'],['custom-pc','Мой компьютер']])plan.furniture.push({id,type:'pcCase',name,pos:[room.rect[0]+1,room.rect[1]+1]});
  M.syncPlan(d,plan);M.migrate(d);assert.equal(d.nodes.find(n=>n.furnitureId==='default-pc').name,'Корпус ПК');assert.equal(d.nodes.find(n=>n.furnitureId==='custom-pc').name,'Мой компьютер');assert.equal(d.plan.furniture.find(f=>f.id==='default-pc').name,'Корпус ПК');
});

test('bookcase models create usable shelves and preserve their stored objects',()=>{
 const d=M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8'))),room=d.plan.rooms[0],plan=structuredClone(d.plan);
 for(const type of ['bookcaseTall','bookcaseMedium'])plan.furniture.push({id:type,type,pos:[room.rect[0]+1,room.rect[1]+1]});M.syncPlan(d,plan);
 for(const [type,count]of [['bookcaseTall',6],['bookcaseMedium',3]]){const card=d.nodes.find(n=>n.furnitureId===type),shelves=d.nodes.filter(n=>n.parentId===card.id);assert.equal(shelves.length,count);M.newNode(d,{name:'Книга '+type,parentId:shelves[0].id,categoryId:'books'});}
 const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);assert.equal(copy.nodes.filter(n=>n.name.startsWith('Книга bookcase')).length,2);
});
