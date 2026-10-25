import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as I from './model.js';
import * as M from '../monitoring/model.js';
import * as T from '../travel/model.js';
import * as A from '../automobile/model.js';
import {vehicleModelType} from '../automobile/vehicle-model.js';
import {createActionHistory} from './action-history.js';

const seed=()=>I.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8')));
test('rental payment splits exactly including remaining kopecks and excludes three independent services',()=>{
  const a=M.createApartment({name:'Арендуемая квартира'}),original=structuredClone(a.services),ids=M.addRentalCharges(a,1000001,'2026-10',{date:'2026-10-25'});
  assert.equal(ids.length,11);assert.equal(a.bills.reduce((sum,b)=>sum+b.amountCents,0),1000001);
  assert.ok(Math.max(...a.bills.map(b=>b.amountCents))-Math.min(...a.bills.map(b=>b.amountCents))<=1);
  const excluded=new Set(a.services.filter(s=>['Охрана','Мобильная связь','Интернет'].includes(s.name)).map(s=>s.id));assert.ok(a.bills.every(b=>!excluded.has(b.serviceId)));
  assert.deepEqual(a.services,original);assert.equal(a.payments.length,0);M.validateMonitoring({monitoring:{version:1,apartments:[a]}});
});
test('rental preserves historical bills and does not include hidden or renamed excluded services',()=>{
  const a=M.createApartment({name:'Аренда'});a.services[0].archived=true;a.services.find(s=>s.name==='Интернет').name='Интернет Ростелеком';
  M.addRentalCharges(a,1,'2026-09',{date:'2026-09-25'});const old=structuredClone(a.bills);M.addRentalCharges(a,123456,'2026-10',{date:'2026-10-25'});assert.deepEqual(a.bills.slice(0,old.length),old);assert.ok(a.bills.every(b=>!a.services.find(s=>s.id===b.serviceId).archived));
  assert.throws(()=>M.addRentalCharges(a,-1,'2026-10'));assert.throws(()=>M.addRentalCharges(a,1.1,'2026-10'));a.services.forEach(s=>s.archived=true);assert.throws(()=>M.addRentalCharges(a,100,'2026-10'));
});
test('non-storage furniture retains its geometry, identity, value and item count; rejects destinations',()=>{
  const d=seed(),n=d.nodes.find(n=>n.modelType==='toilet'),room=I.getNode(d,n.parentId),before=I.totals(d),plan=structuredClone(d.plan);
  assert.ok(n);const copy=structuredClone(n);I.updateNode(d,n.id,{storageEnabled:false});assert.equal(I.canStore(n),false);assert.ok(!I.destinations(d).some(p=>p.id===n.id));
  assert.equal(I.totals(d).items,before.items);assert.equal(I.totals(d).storage,before.storage-1);assert.equal(n.purchaseCents,copy.purchaseCents);assert.deepEqual(d.plan,plan);
  const item=I.newNode(d,{kind:'item',name:'Предмет проверки',parentId:room.id});assert.throws(()=>I.move(d,item.id,n.id));assert.throws(()=>I.newNode(d,{kind:'item',name:'Нельзя',parentId:n.id}));I.migrate(d);assert.equal(I.getNode(d,n.id).storageEnabled,false);I.validate(d);
});
test('filled furniture cannot silently lose its contents; empty built-in sections are recoverable',()=>{
  const d=seed(),wardrobe=d.nodes.find(n=>n.modelType==='wardrobe'),before=structuredClone(d);assert.ok(I.descendants(d,wardrobe.id).some(n=>n.kind==='item'));
  assert.throws(()=>I.updateNode(d,wardrobe.id,{storageEnabled:false}),/Сначала переместите/);assert.deepEqual(d,before);
  for(const child of I.descendants(d,wardrobe.id).filter(n=>!n.autoSection))I.move(d,child.id,wardrobe.parentId);
  const prepared=structuredClone(d),history=createActionHistory();I.updateNode(d,wardrobe.id,{storageEnabled:false});history.record(prepared,{label:'Роль хранения',section:'space'},d);assert.equal(I.children(d,wardrobe.id).length,0);I.migrate(d);assert.equal(I.children(d,wardrobe.id).length,0);I.validate(d);
  history.applyTo(d);assert.ok(I.canStore(I.getNode(d,wardrobe.id)));assert.ok(I.children(d,wardrobe.id).length>0);I.validate(d);
});
test('vehicle from travel can use an existing car or a newly registered Vesta without changing inventory origins',()=>{
  const d=seed(),tripId=T.saveTrip(d,{name:'Поездка проверки'}),carId=A.addCar(d,{name:'Lada Vesta SW Cross',color:'#4779ad'}),car=A.car(d,carId),origins=new Map(d.nodes.map(n=>[n.id,n.parentId]));
  const id=T.saveBag(d,tripId,{kind:'car',nodeId:car.rootId,modelType:vehicleModelType(car)}),b=T.getTrip(d,tripId).bags.find(b=>b.id===id);assert.equal(b.modelType,'vestaSwCross2019');assert.equal(T.storageExists(d,b),true);assert.equal(T.bagStats(d,b).weight,0);
  const item=d.nodes.find(n=>n.kind==='item');T.setWeight(d,item.id,123);T.transferItems(d,tripId,id,[item.id]);assert.equal(I.getNode(d,item.id).parentId,origins.get(item.id));assert.equal(T.bagStats(d,b).weight,.123);I.validate(d);
});
test('disabled furniture is excluded from travel storage without excluding ordinary bag items',()=>{
  const d=seed(),n=d.nodes.find(n=>n.modelType==='toilet');I.updateNode(d,n.id,{storageEnabled:false});assert.equal(T.isStorageCandidate(n),false);const tripId=T.saveTrip(d,{name:'Поход'});assert.throws(()=>T.saveBag(d,tripId,{kind:'box',nodeId:n.id}));const bag=I.newNode(d,{name:'Рюкзак проверки',kind:'item',parentId:I.UNPLACED_ID,fields:{'Вес, г':'850'}});assert.equal(T.isStorageCandidate(bag),true);T.saveBag(d,tripId,{nodeId:bag.id});I.validate(d);
});
