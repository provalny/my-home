import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {buildTrailSuv,trailOpeningClips,TRAIL_PARTS,TRAIL_SIZE} from './trail-suv.js';
import {buildFurniture} from './furniture.js';
import {collectFurnitureAnimators,animateFurniture} from './furniture-animation.js';
import {buildStorageInterior,disposeObject} from './storage-interior.js';
import {layoutZones} from '../inventory/storage-layout.js';
import * as M from '../inventory/model.js';

const demo=()=>M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8')));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
test('SUV has four independent hinges and changing paint or dirt never changes dimensions',()=>{
  const root=buildTrailSuv(),vehicle=root.userData.vehicle,scale=root.scale.clone();
  const size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());size.toArray().forEach((v,i)=>near(v,TRAIL_SIZE[i]));
  assert.deepEqual(vehicle.openings.map(p=>p.key),TRAIL_PARTS);
  for(const key of TRAIL_PARTS){
    vehicle.setOpen(key,1);
    for(const p of vehicle.openings)near(p.pivot.rotation[p.axis],p.key===key?p.angle:0);
    assert.deepEqual(root.scale,scale);vehicle.setOpen(key,0);
  }
  vehicle.setColor('#a44535');vehicle.setDirt(1);let mud,paint,wheels=0,kayaks=0;
  root.traverse(o=>{if(o.material?.name==='Грязь на кузове')mud=o.material;if(o.material?.name==='Краска кузова')paint=o.material;if(o.userData.wheel)wheels++;if(o.name==='Байдарка')kayaks++;});
  assert.equal(wheels,4);assert.equal(kayaks,2);assert.equal(paint.color.getHexString(),'a44535');assert.ok(mud.opacity>.9);
  assert.ok(mud.map.image.data.some((v,i)=>i%4===3&&v===0));assert.ok(mud.map.image.data.some((v,i)=>i%4===3&&v>0));
  vehicle.setDirt(0);assert.equal(mud.visible,false);assert.deepEqual(root.scale,scale);
  for(const value of [NaN,Infinity,-1,2,'bad']){vehicle.setOpen('frontLeft',value);assert.ok(Number.isFinite(vehicle.openings[0].pivot.rotation.y));}
  disposeObject(root);
});
test('opening doors, hatch and hood removes the panel from the actual access opening',()=>{
  const root=buildTrailSuv(),v=root.userData.vehicle;
  for(const [key,point,direction,far=.22]of [['frontLeft',[-1.02,1.05,-.05],[1,0,0]],['frontRight',[1.02,1.05,-.05],[-1,0,0]],['tailgate',[0,1.10,-2.20],[0,0,1]],['hood',[0,1.55,1.45],[0,-1,0],.16]]){
    const hits=()=>{root.updateMatrixWorld(true);return new THREE.Raycaster(v.inner.localToWorld(new THREE.Vector3(...point)),new THREE.Vector3(...direction).transformDirection(v.inner.matrixWorld),0,far).intersectObject(root,true).filter(h=>h.object.material.visible);};
    assert.ok(hits().length,`${key} closed panel missing`);v.setOpen(key,1);assert.equal(hits().length,0,`${key} opening blocked`);v.setOpen(key,0);
  }
  disposeObject(root);
});
test('SUV compartments and contents survive save/reload and drive visible cargo',()=>{
  const d=demo(),plan=structuredClone(d.plan),room=plan.rooms[0];
  plan.furniture.push({id:'trail',type:'trailSuv',pos:[room.rect[0]+1,room.rect[1]+1],color:'#278cb7',dirt:.45,headlights:false,vehicleOpen:{frontLeft:1,hood:1}});
  M.syncPlan(d,plan);M.initializeStorage(d);M.initializeStorage(d);
  const card=d.nodes.find(n=>n.furnitureId==='trail'),sections=M.children(d,card.id);
  assert.deepEqual(sections.map(n=>n.carCompartment).sort(),['cabin','trunk']);
  for(const section of sections){M.newNode(d,{name:'Походная сумка',parentId:section.id,categoryId:'other'});M.newNode(d,{name:'Куртка',parentId:section.id,categoryId:'clothes'});}
  const saved=JSON.parse(JSON.stringify(d));M.migrate(saved);M.validate(saved);
  const shape=saved.plan.furniture.find(f=>f.id==='trail'),zones=layoutZones(saved,card.id);
  assert.equal(shape.color,'#278cb7');assert.equal(shape.vehicleOpen.frontLeft,1);assert.equal(shape.vehicleOpen.hood,1);assert.equal(shape.headlights,false);assert.equal(zones.length,2);assert.ok(zones.every(z=>z.fill===25));
  const view=buildStorageInterior(shape,zones),v=view.root.userData.vehicle;
  assert.equal(view.hits.length,2);assert.ok(view.clutter.every(g=>g.children.length>0));
  view.animate(1);assert.ok(v.openings.filter(p=>p.key!=='hood').every(p=>Math.abs(p.pivot.rotation[p.axis])>1));near(v.openings.find(p=>p.key==='hood').pivot.rotation.x,0);view.animate(0);assert.ok(v.openings.every(p=>p.pivot.rotation[p.axis]===0));
  const cabin=view.clutter.find(g=>g.position.z>0);assert.ok(cabin.position.z-cabin.children[0].position.z>.2);
  for(const section of sections){assert.equal(layoutZones(saved,section.id)[0].carCompartment,section.carCompartment);M.getNode(saved,section.id).fill=0;}
  assert.ok(layoutZones(saved,card.id).every(z=>z.fill===0));
  const empty=buildStorageInterior(shape,layoutZones(saved,card.id));assert.ok(empty.clutter.every(g=>g.children.length===0));view.dispose();empty.dispose();
});

test('opening and closing ease continuously, can reverse mid-motion and sleep when settled',()=>{
  const root=buildTrailSuv(),v=root.userData.vehicle,animators=collectFurnitureAnimators(root),part=v.openings[0];
  assert.equal(animateFurniture(animators,10),false);
  v.animateOpen(part.key,1);near(part.pivot.rotation.y,0);
  assert.equal(animateFurniture(animators,10+part.duration*.1),true);assert.ok(part.pivot.rotation.y>0&&part.pivot.rotation.y<part.angle*.02);
  animateFurniture(animators,10+part.duration*.5);near(part.pivot.rotation.y,part.angle*.5);
  const middle=part.pivot.rotation.y;v.animateOpen(part.key,0);near(part.pivot.rotation.y,middle);
  animateFurniture(animators,10+part.duration*.75);near(part.pivot.rotation.y,part.angle*.25);
  assert.equal(animateFurniture(animators,12),false);near(part.pivot.rotation.y,0);
  for(const p of v.openings)v.animateOpen(p.key,1);
  assert.equal(animateFurniture(animators,12.1,{reduceMotion:true}),false);
  for(const p of v.openings)near(p.pivot.rotation[p.axis],p.angle);
  assert.equal(v.moving,false);disposeObject(root);
});

test('four exported clips keep eased motion and the exact hinge endpoints',()=>{
  const root=buildTrailSuv(),v=root.userData.vehicle,clips=trailOpeningClips(v.openings),mixer=new THREE.AnimationMixer(root);
  assert.deepEqual(clips.map(c=>c.name),TRAIL_PARTS.map(k=>'Open_'+k));
  for(const [i,clip]of clips.entries()){
    mixer.stopAllAction();const part=v.openings[i],action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.reset().play();
    mixer.update(clip.duration*.1);assert.ok(Math.abs(part.pivot.rotation[part.axis])<Math.abs(part.angle)*.02);
    mixer.update(clip.duration*.4);near(part.pivot.rotation[part.axis],part.angle*.5);
    mixer.update(clip.duration);near(part.pivot.rotation[part.axis],part.angle);
  }
  disposeObject(root);
});

test('headlights point forwards and down, switch off and glass does not block interior light',()=>{
  const model=buildFurniture([{id:'test',type:'trailSuv',pos:[0,0],rot:90}]),root=model.children[0],v=root.userData.vehicle,glass=[];
  model.updateMatrixWorld(true);assert.equal(v.headlights.length,2);
  for(const light of v.headlights){const from=light.getWorldPosition(new THREE.Vector3()),to=light.target.getWorldPosition(new THREE.Vector3());assert.ok(light.isSpotLight&&light.intensity>0&&light.distance>5);assert.ok(to.x>from.x&&to.y<from.y);assert.equal(light.target.parent,light);assert.deepEqual(light.target.position.toArray(),[0,0,-1]);}
  model.traverse(o=>{if(o.isMesh&&o.material===model.getObjectByName('Лобовое стекло')?.material)glass.push(o);});
  assert.equal(glass.length,6);assert.ok(glass.every(o=>o.material.transparent&&o.material.opacity<.5&&!o.material.depthWrite&&!o.castShadow&&!o.receiveShadow));
  v.setHeadlights(false);assert.ok(v.headlights.every(l=>l.intensity===0));v.setHeadlights(true);v.setLightingScale(.5);assert.ok(v.headlights.every(l=>l.intensity===45*.25&&l.distance===6));v.setLightingScale(1);assert.ok(v.headlights.every(l=>l.intensity===45));
  disposeObject(model);
});
