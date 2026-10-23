import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildFurniture,footprint,FURNITURE_TYPES} from './furniture.js';
import {EXTRA_MODEL_INFO,extraDimensions} from './furniture-info.js';
import * as M from '../inventory/model.js';
import {readFileSync} from 'node:fs';

const bounds=item=>new THREE.Box3().setFromObject(buildFurniture([{id:'test-model',pos:[0,0],...item}]));
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<0.00001,`${actual} != ${expected}`);
test('all fifteen new models render finite geometry on the floor and match their plan footprint',()=>{
  assert.equal(Object.keys(EXTRA_MODEL_INFO).length,15);
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
    near(size.x,0.8);near(size.z,1.3);near(size.y,1.7);near(b.min.y,0.6);
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
  for(const [type,category]of [['washingMachine','electronics'],['tireStack','other'],['crossover','other'],['metalRack','furniture']]){
    assert.equal(copy.nodes.find(n=>n.furnitureId==='new-'+type).categoryId,category);assert.equal(copy.plan.furniture.find(f=>f.id==='new-'+type).layout,'row');
  }
});
