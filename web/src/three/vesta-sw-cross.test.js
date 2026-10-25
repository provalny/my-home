import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {buildVestaSwCross,VESTA_SIZE,VESTA_PARTS} from './vesta-sw-cross.js';
import {trailOpeningClips} from './trail-suv.js';
import {buildStorageInterior,disposeObject} from './storage-interior.js';
import {layoutZones} from '../inventory/storage-layout.js';
import * as M from '../inventory/model.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);

test('Vesta has four wheels, six independent openings, fixed dimensions and separate paint and trim',()=>{
 const root=buildVestaSwCross({width:9,height:9,depth:9}),v=root.userData.vehicle,materials=new Map();let wheels=0;
 root.traverse(o=>{if(o.userData.wheel)wheels++;if(o.material)materials.set(o.material.name,o.material);});assert.equal(wheels,4);
 const before=new THREE.Box3().setFromObject(root);before.getSize(new THREE.Vector3()).toArray().forEach((n,i)=>near(n,VESTA_SIZE[i]));near(before.min.y,0);
 assert.deepEqual(v.openings.map(p=>p.key),VESTA_PARTS);const trim=materials.get('Матовый обвес Cross').color.getHexString();
 v.setColor('#517d99');assert.equal(materials.get('Краска кузова').color.getHexString(),'517d99');assert.equal(materials.get('Матовый обвес Cross').color.getHexString(),trim);
 v.setDirt(1);assert.ok(materials.get('Дорожная пыль').opacity>.8);v.setDirt(0);assert.equal(materials.get('Дорожная пыль').visible,false);assert.deepEqual(new THREE.Box3().setFromObject(root),before);
 for(const p of v.openings){v.setOpen(p.key,1);v.openings.forEach(other=>near(other.pivot.rotation[other.axis],other===p?p.angle:0));v.setOpen(p.key,0);}
 v.setHeadlights(false);assert.ok(v.headlights.every(l=>l.intensity===0));v.setHeadlights(true);v.setLightingScale(.5);assert.ok(v.headlights.every(l=>l.intensity===8&&l.distance===5));
 root.updateMatrixWorld(true);for(const light of v.headlights){const from=light.getWorldPosition(new THREE.Vector3()),to=light.target.getWorldPosition(new THREE.Vector3());assert.ok(to.z>from.z&&to.y<from.y);assert.equal(light.target.parent,light);}
 disposeObject(root);
});
test('all four doors, hood and tailgate reveal actual openings',()=>{
 const root=buildVestaSwCross(),v=root.userData.vehicle;
 for(const [key,point,direction,far=.30]of [['frontLeft',[-1,.64,.20],[1,0,0]],['frontRight',[1,.64,.20],[-1,0,0]],['rearLeft',[-1,.70,-.70],[1,0,0]],['rearRight',[1,.70,-.70],[-1,0,0]],['tailgate',[0,.80,-2.30],[0,0,1],.25],['hood',[0,1.10,1.4],[0,-1,0],.18]]){
  const hits=()=>{root.updateMatrixWorld(true);return new THREE.Raycaster(v.inner.localToWorld(new THREE.Vector3(...point)),new THREE.Vector3(...direction).transformDirection(v.inner.matrixWorld),0,far).intersectObject(root,true).filter(h=>h.object.material.visible);};
  assert.ok(hits().length,key+' closed panel');v.setOpen(key,1);assert.equal(hits().length,0,key+' open access');v.setOpen(key,0);
 }disposeObject(root);
});
test('Vesta easing reverses smoothly, settles, respects reduced motion, and exports six clips',()=>{
 const root=buildVestaSwCross(),v=root.userData.vehicle;
 v.animate(0);for(const p of v.openings)v.animateOpen(p.key,1);v.animate(.1);assert.ok(v.openings.every(p=>Math.abs(p.pivot.rotation[p.axis])<Math.abs(p.angle)*.02));v.animate(.55);
 const part=v.openings[0],angle=part.pivot.rotation.y;assert.ok(Math.abs(angle)>.4);v.animateOpen(part.key,0);near(part.pivot.rotation.y,angle);v.animate(.60);assert.ok(Math.abs(part.pivot.rotation.y)<Math.abs(angle));v.animate(4);near(part.pivot.rotation.y,0);assert.equal(v.moving,false);
 for(const p of v.openings)v.animateOpen(p.key,0);v.animate(4,{reduceMotion:true});assert.ok(v.openings.every(p=>p.pivot.rotation[p.axis]===0));
 const clips=trailOpeningClips(v.openings),mixer=new THREE.AnimationMixer(root);assert.deepEqual(clips.map(c=>c.name),VESTA_PARTS.map(k=>'Open_'+k));
 for(const [i,clip]of clips.entries()){mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.reset().play();mixer.update(clip.duration*.5);near(v.openings[i].pivot.rotation[v.openings[i].axis],v.openings[i].angle*.5);mixer.update(clip.duration);near(v.openings[i].pivot.rotation[v.openings[i].axis],v.openings[i].angle);}
 disposeObject(root);
});
test('Vesta storage and saved appearance survive a plan round trip without duplicate compartments',()=>{
 const d=M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8'))),plan=structuredClone(d.plan),room=plan.rooms[0];
 plan.furniture.push({id:'vesta-test',type:'vestaSwCross2019',pos:[room.rect[0]+1,room.rect[1]+1],color:'#517d99',dirt:.3,headlights:false,vehicleOpen:{rearLeft:1,hood:1}});M.syncPlan(d,plan);M.initializeStorage(d);M.initializeStorage(d);
 const card=d.nodes.find(n=>n.furnitureId==='vesta-test'),sections=M.children(d,card.id);assert.deepEqual(sections.map(n=>n.carCompartment).sort(),['cabin','trunk']);
 for(const section of sections)M.newNode(d,{name:'Тестовая сумка',parentId:section.id,categoryId:'other'});
 const saved=JSON.parse(JSON.stringify(d));M.migrate(saved);M.validate(saved);const shape=saved.plan.furniture.find(f=>f.id==='vesta-test');assert.equal(shape.color,'#517d99');assert.equal(shape.vehicleOpen.rearLeft,1);assert.equal(shape.headlights,false);
 const zones=layoutZones(saved,card.id);assert.ok(zones.every(z=>z.fill===12.5));const view=buildStorageInterior(shape,zones);assert.equal(view.hits.length,2);assert.ok(view.clutter.every(g=>g.children.length>0));
 view.animate(1);assert.ok(view.root.userData.vehicle.openings.filter(p=>p.key!=='hood').every(p=>Math.abs(p.pivot.rotation[p.axis])>1));view.animate(0);assert.ok(view.root.userData.vehicle.openings.every(p=>p.pivot.rotation[p.axis]===0));view.dispose();
});
