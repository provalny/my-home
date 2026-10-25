import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildLuggage} from '../three/luggage-models.js';
import {buildTrailSuv} from '../three/trail-suv.js';
import {disposeObject} from '../three/storage-interior.js';
import {arrangeStorageModels,storageCameraPose} from './viewer-layout.js';
import {createTerrainPixels,inClearing,placeOnGround} from '../three/meadow-stage.js';
import {carAtmosphere} from '../automobile/landscape.js';

test('mixed storage stands side by side at authored scale and focuses by moving only the camera',()=>{
 const entries=[{id:'large',kind:'bag',model:buildLuggage({type:'duffel60'})},{id:'car',kind:'car',model:buildTrailSuv()},{id:'small',kind:'bag',model:buildLuggage({type:'backpack20'})}];
 const scales=entries.map(e=>e.model.scale.clone()),layout=arrangeStorageModels(entries);
 entries.forEach((e,i)=>{assert.deepEqual(e.model.scale,scales[i]);assert.ok(Math.abs(e.bounds.min.y)<1e-6);if(i)assert.ok(e.bounds.min.x>entries[i-1].bounds.max.x);});
 const transforms=entries.map(e=>e.model.matrixWorld.clone());
 for(const aspect of [.5,1,2.5]){
  const overview=storageCameraPose(layout.bounds,aspect,0,{overview:true}),focused=storageCameraPose(layout.bounds,aspect,0,{selected:entries[2].bounds}),next=storageCameraPose(layout.bounds,aspect,.016,{selected:entries[2].bounds});
  assert.ok(overview.position.distanceTo(focused.position)>.1);assert.ok(overview.target.distanceTo(focused.target)>.1);
  assert.ok(focused.distance<overview.distance*.5,'a small bag gets its own close camera framing');
  assert.ok(next.position.distanceTo(focused.position)<.01,'the camera glide has no frame jumps');
  for(const pose of [overview,focused])assert.ok([...pose.position,...pose.target,pose.distance].every(Number.isFinite));
 }
 entries.forEach((e,i)=>{assert.deepEqual(e.model.matrixWorld,transforms[i]);disposeObject(e.model);});
});

test('grounding offsets a raised model without changing its dimensions or orientation',()=>{
 const model=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.3,.8,.2),new THREE.MeshBasicMaterial());mesh.position.y=2;model.add(mesh);model.scale.set(2,1.5,2);
 const before=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()),bounds=placeOnGround(model,{x:3,z:-2});
 assert.ok(Math.abs(bounds.min.y)<1e-6);assert.deepEqual(bounds.getSize(new THREE.Vector3()),before);assert.equal(model.position.x,3);assert.equal(model.position.z,-2);disposeObject(model);
});

test('seasonal terrain is cached deterministic data, with solid clearings and a transparent outer edge',()=>{
 const a=carAtmosphere({now:new Date('2026-07-15T12:00:00Z')}),options={size:33,radius:5,footprints:[{x:0,z:0,width:2,depth:2}]},pixels=createTerrainPixels(a,options);
 assert.deepEqual(createTerrainPixels(a,options),pixels);assert.equal(pixels[(16*33+16)*4+3],255);assert.equal(pixels[3],0);
 assert.equal(inClearing(0,0,options.footprints),true);assert.equal(inClearing(4,4,options.footprints),false);
 const winter=carAtmosphere({now:new Date('2026-01-15T12:00:00Z')});assert.notDeepEqual(createTerrainPixels(winter,options),pixels);
});
