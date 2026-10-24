import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildStorageClutter} from './storage-clutter.js';
import {buildStorageInterior} from './storage-interior.js';
import {layoutZones,storageFill} from '../inventory/storage-layout.js';
const zone=fill=>({nodeId:'shelf-a',name:'Полка',kind:'shelf',rect:[0,0,1,1],fill});
test('decorative density increases with fill, stays deterministic and respects compartment bounds',()=>{
 let previous=0;
 for(const fill of [0,10,25,50,75,100]){const g=buildStorageClutter(zone(fill),.8,.35,.5);assert.ok(g.children.length>=previous);previous=g.children.length;assert.ok(previous<=8);
  const again=buildStorageClutter(zone(fill),.8,.35,.5);const signature=root=>{const rows=[];root.traverse(o=>{if(o.isMesh)rows.push([o.position.toArray(),o.geometry.attributes.position.array.slice(0,9),o.material.color.getHex()]);});return rows;};assert.deepEqual(signature(g),signature(again));
 }
});
test('decorations remain in the slot and have no inventory interaction IDs',()=>{
 for(const [w,h,d]of [[.8,.35,.5],[.1,.06,.1],[1.2,.6,.3]]){
  const g=buildStorageClutter(zone(100),w,h,d),b=new THREE.Box3().setFromObject(g);assert.ok(b.min.x>=-w/2&&b.max.x<=w/2);assert.ok(b.min.y>=-1e-6&&b.max.y<=h+1e-6);assert.ok(b.min.z>=-d/2&&b.max.z<=d/2);g.traverse(o=>assert.equal(o.userData.kind,undefined));
 }
 for(const fill of [null,undefined,NaN,-1,0])assert.equal(buildStorageClutter(zone(fill),.8,.35,.5).children.length,0);
});
test('fill inherits from furniture, section overrides include zero, and rendering leaves data intact',()=>{
 const doc={nodes:[{id:'room',kind:'room',fill:100},{id:'cab',kind:'furniture',parentId:'room',fill:70},{id:'a',parentId:'cab',kind:'shelf',order:0},{id:'b',parentId:'cab',kind:'drawer',fill:0,order:1}],plan:{furniture:[{id:'model',type:'wardrobe'}]}};
 const before=JSON.stringify(doc),zones=layoutZones(doc,'cab');assert.equal(zones[0].fill,70);assert.equal(zones[1].fill,0);assert.equal(storageFill(doc,'room'),null);assert.equal(JSON.stringify(doc),before);
});
test('clutter is hidden at rest and follows the real drawer when it opens',()=>{
 const model=buildStorageInterior({id:'cab',type:'dresser',width:1,height:1,depth:.5,pos:[2,3],rot:90},[zone(75)]);
 assert.ok(model.clutter.length);const g=model.clutter[0];assert.equal(g.visible,false);model.root.updateMatrixWorld(true);const before=g.getWorldPosition(new THREE.Vector3());model.animate(1);model.root.updateMatrixWorld(true);assert.equal(g.visible,true);const after=g.getWorldPosition(new THREE.Vector3());assert.ok(after.distanceTo(before)>.05);model.animate(0);assert.equal(g.visible,false);model.dispose();
});

test('selected kitchen cabinets and standalone drawers receive bounded decorative content',()=>{
 const kitchen=buildStorageInterior({id:'k',type:'kitchen',width:3,pos:[0,0]},[zone(65)],{moduleKey:'base:0'});assert.ok(kitchen.clutter.length);kitchen.animate(1);assert.equal(kitchen.clutter[0].visible,true);kitchen.dispose();
 const drawer=buildStorageInterior({id:'d',type:'wardrobe',pos:[0,0]},[{...zone(80),kind:'drawer'}],{container:true});assert.ok(drawer.clutter.length);drawer.animate(1);assert.ok(drawer.clutter[0].parent!==drawer.root);drawer.dispose();
});
