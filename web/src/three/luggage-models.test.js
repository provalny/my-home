import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {BAG_TYPES,buildLuggage} from './luggage-models.js';
import {EXTRA_MODEL_INFO} from './furniture-info.js';
import {disposeObject} from './storage-interior.js';
import * as M from '../inventory/model.js';

test('three bags have distinct low-poly geometry and recolouring only affects fabric',()=>{
  const triangleCounts=[];
  for(const [index,type]of BAG_TYPES.entries()){
    const root=buildLuggage({type}),bag=root.userData.bag,materials=new Map();let triangles=0,meshes=0;
    root.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;materials.set(o.material.name,o.material);assert.equal(o.geometry.attributes.color.count,o.geometry.attributes.position.count,'Every fabric and hardware surface has vertex colours, including the volume badge');});
    assert.equal(bag.capacityLiters,[60,20,30][index]);assert.ok(triangles<6000,`${type}: ${triangles}`);assert.ok(meshes<25,`${type}: ${meshes}`);triangleCounts.push(triangles);
    const before=new THREE.Box3().setFromObject(root),metal=materials.get('Фурнитура').color.getHexString(),webbing=materials.get('Чёрная стропа').color.getHexString();
    for(const color of ['#c69b4a','#477e94','#414750']){
      bag.setColor(color);assert.equal(materials.get('Основная ткань').color.getHexString(),color.slice(1));assert.equal(materials.get('Фурнитура').color.getHexString(),metal);assert.equal(materials.get('Чёрная стропа').color.getHexString(),webbing);assert.deepEqual(new THREE.Box3().setFromObject(root),before);
    }
    disposeObject(root);
  }
  assert.equal(new Set(triangleCounts).size,3);
});
test('bag colours, fixed sizes and model identity survive plan saves and backups',()=>{
  const d=M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8'))),plan=structuredClone(d.plan),room=plan.rooms[0];
  for(const [i,type]of BAG_TYPES.entries())plan.furniture.push({id:'bag-'+i,type,pos:[room.rect[0]+1+i*.2,room.rect[1]+1],color:'#c69b4a',rot:90,y:.5});
  M.syncPlan(d,plan);const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);
  for(const [i,type]of BAG_TYPES.entries()){
    const shape=copy.plan.furniture.find(f=>f.id==='bag-'+i),card=copy.nodes.find(n=>n.furnitureId===shape.id);assert.equal(shape.color,'#c69b4a');assert.equal(shape.rot,90);assert.equal(shape.y,.5);assert.equal(card.modelType,type);assert.equal(card.categoryId,'other');
    const root=buildLuggage({...shape,width:8,height:8,depth:8}),size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());size.toArray().forEach((v,index)=>assert.ok(Math.abs(v-EXTRA_MODEL_INFO[type].size[index])<1e-6));disposeObject(root);
  }
});
