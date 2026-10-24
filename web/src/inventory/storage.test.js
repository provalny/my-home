import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import * as M from './model.js';
import { applyRoomPresentation, inferRoomType } from './room-types.js';
import { roomGlyph } from './room-icons.js';
import { layoutZones, arrangeStorage, validateStorageLayout, sectionRects } from './storage-layout.js';
import { translationCandidates, translatePlan } from './localization.js';
import { buildStorageInterior } from '../three/storage-interior.js';
import { kitchenModules, SECTION_KINDS, KITCHEN_MODULE_TYPES, kitchenTypeOptions } from './ikea-storage.js';
import { buildKitchen } from '../three/kitchen.js';
import { buildFurniture } from '../three/furniture.js';
import { OPENABLE_TYPES } from './storage-layout.js';
import { normalize } from '../config.js';
import { fridgeChambers, fridgeConfig } from './fridge-layout.js';
import { planLocation } from './plan-location.js';
const seed=()=>M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8')));
test('IKEA shelves keep their cell identities, contents and fill after resizing and reloading',()=>{
  const d=seed(),plan=structuredClone(d.plan);
  for(const type of ['kallaxShelf','ivarRack','woodShelfLow'])plan.furniture.push({id:type,type,pos:[1,1]});
  M.syncPlan(d,plan);
  for(const [type,count]of [['kallaxShelf',16],['ivarRack',4],['woodShelfLow',3]]){
    const card=d.nodes.find(n=>n.furnitureId===type),sections=M.children(d,card.id),ids=sections.map(n=>n.id);
    assert.equal(sections.length,count);assert.ok(sections.every(n=>n.autoSection));
    card.fill=65;sections[0].fill=0;
    const item=M.newNode(d,{name:'Вещь в '+type,parentId:sections.at(-1).id,categoryId:'books'});
    const shape=d.plan.furniture.find(f=>f.id===type);shape.width=1.6;shape.height=2;
    M.syncPlan(d,structuredClone(d.plan));M.initializeStorage(d);
    assert.deepEqual(M.children(d,card.id).map(n=>n.id),ids);
    const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);
    assert.equal(M.getNode(copy,item.id).parentId,sections.at(-1).id);
    const zones=layoutZones(copy,card.id),model=buildStorageInterior(shape,zones);
    assert.equal(zones.length,count);assert.equal(zones[0].fill,0);assert.ok(zones.slice(1).every(z=>z.fill===65));
    assert.equal(model.hits.length,count);assert.equal(model.clutter.length,count-1);
    model.animate(1);assert.ok(model.clutter.every(g=>g.visible));
    for(const slot of model.contentSlots){assert.ok(slot.baseY>=0&&slot.baseY+slot.height<=2+.00001);assert.ok(slot.centerX-slot.width/2>=-.8-.00001&&slot.centerX+slot.width/2<=.8+.00001);}
    model.animate(0);assert.ok(model.clutter.every(g=>!g.visible));model.dispose();
    if(type==='kallaxShelf')assert.deepEqual(zones.map(z=>z.rect),sectionRects('grid',4,4,16));
  }
});
test('show on plan resolves the actual wardrobe and shelf without changing inventory',()=>{
  const d=seed(),item=d.nodes.find(n=>n.name==='Футболка Nike'),shelf=M.getNode(d,item.parentId),cabinet=M.getNode(d,shelf.parentId),before=JSON.stringify(d);
  assert.deepEqual(planLocation(d,item.id),{spaceId:M.PRIMARY_SPACE_ID,roomId:cabinet.parentId,roomGeometryId:M.getNode(d,cabinet.parentId).roomId,placeId:shelf.id,anchorId:cabinet.id,focusId:cabinet.id,sectionId:shelf.id});
  assert.equal(JSON.stringify(d),before);
  const box=M.newNode(d,{kind:'box',name:'Вложенная коробка',parentId:shelf.id}),nested=M.newNode(d,{name:'В коробке',parentId:box.id});
  const target=planLocation(d,nested.id);assert.equal(target.anchorId,cabinet.id);assert.equal(target.focusId,cabinet.id);assert.equal(target.sectionId,shelf.id);assert.equal(target.placeId,box.id);
});
test('show on plan selects the exact kitchen cabinet or fridge chamber and its inner shelf',()=>{
  for(const type of ['kitchen','fridge']){
    const d=seed(),shape=d.plan.furniture.find(f=>f.type===type),root=d.nodes.find(n=>n.furnitureId===shape.id),unit=M.children(d,root.id).find(n=>type==='kitchen'?n.kitchenModule:n.fridgeChamber==='cooling');
    const shelf=M.children(d,unit.id).find(n=>n.kind!=='item')||M.newNode(d,{kind:'shelf',parentId:unit.id,name:'Полка'}),item=M.newNode(d,{name:'Внутри отделения',parentId:shelf.id});
    const target=planLocation(d,item.id);assert.equal(target.anchorId,root.id);assert.equal(target.focusId,unit.id);assert.equal(target.sectionId,shelf.id);assert.equal(target.placeId,shelf.id);
    const direct=M.newNode(d,{name:'Без полки',parentId:unit.id});assert.equal(planLocation(d,direct.id).focusId,unit.id);assert.equal(planLocation(d,direct.id).sectionId,unit.id);
  }
});
test('show on plan follows current moves, falls back to the room for detached storage, and rejects unplaced/archive',()=>{
  const d=seed(),item=d.nodes.find(n=>n.name==='Футболка Nike'),shelf=M.getNode(d,item.parentId),cabinet=M.getNode(d,shelf.parentId),room=M.getNode(d,cabinet.parentId);
  M.detachFurniture(d,cabinet.id);const detached=planLocation(d,item.id);assert.equal(detached.anchorId,undefined);assert.equal(detached.roomId,room.id);assert.ok(detached.note);
  M.move(d,item.id,room.id);assert.equal(planLocation(d,item.id).placeId,room.id);assert.equal(planLocation(d,item.id).anchorId,undefined);
  M.move(d,item.id,M.UNPLACED_ID);assert.match(planLocation(d,item.id).reason,/Без места/);
  M.archive(d,item.id,{reason:'Другое',date:'2026-10-24'});assert.match(planLocation(d,item.id).reason,/архиве/);
  assert.ok(planLocation(d,'missing').reason);
});
test('show on plan uses the closest physical furniture and safely rejects invalid ancestry or missing rooms',()=>{
  const d=seed(),item=d.nodes.find(n=>n.name==='Футболка Nike'),shelf=M.getNode(d,item.parentId),cabinet=M.getNode(d,shelf.parentId);
  const box=M.newNode(d,{kind:'furniture',name:'Модель внутри шкафа',parentId:shelf.id});box.furnitureId='nested-model';d.plan.furniture.push({id:box.furnitureId,type:'sideboard'});item.parentId=box.id;
  assert.equal(planLocation(d,item.id).anchorId,box.id);
  box.parentId=item.id;assert.ok(planLocation(d,item.id).reason);box.parentId=shelf.id;
  d.plan.rooms=[];assert.match(planLocation(d,item.id).reason,/Комната/);
  d.plan.rooms=[{id:M.getNode(d,cabinet.parentId).roomId}];cabinet.archived={};assert.match(planLocation(d,item.id).reason,/архиве/);
});
test('fridge settings preserve products when changing type or freezer position and trash old chambers and keep products active when changing their count',()=>{
  const d=seed(),shape=d.plan.furniture.find(f=>f.type==='fridge'),n=d.nodes.find(n=>n.furnitureId===shape.id),chambers=M.children(d,n.id).filter(n=>n.fridgeChamber),cooling=chambers.find(n=>n.fridgeChamber==='cooling'),product=M.newNode(d,{name:'Продукт в холодильнике',parentId:cooling.id,purchaseCents:25000}),oldIds=chambers.map(n=>n.id);
  assert.equal(chambers.length,2);M.configureFridge(d,n.id,{installation:'builtIn',freezerPosition:'top'});M.validate(d);assert.deepEqual(M.children(d,n.id).filter(n=>n.fridgeChamber).map(n=>n.fridgeChamber),['freezer','cooling']);assert.equal(product.parentId,cooling.id);assert.equal(product.archived,null);assert.ok(oldIds.every(id=>M.getNode(d,id)&&!M.getNode(d,id).archived));
  const before=JSON.parse(JSON.stringify(d));M.configureFridge(d,n.id,{chambers:3});M.validate(d);assert.equal(product.archived,null);assert.equal(product.parentId,n.id);assert.equal(product.purchaseCents,25000);assert.ok(oldIds.every(id=>!M.getNode(d,id)&&d.trash.some(e=>e.nodes.some(n=>n.id===id))));assert.equal(layoutZones(d,n.id).length,3);assert.ok(M.children(d,n.id).filter(n=>n.fridgeChamber).every(n=>!oldIds.includes(n.id)));M.validate(before);assert.equal(M.getNode(before,product.id).archived,null);
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.migrate(copy);M.validate(copy);M.syncPlan(copy,structuredClone(copy.plan));assert.deepEqual(fridgeConfig(copy.plan.furniture.find(f=>f.id===shape.id)),{installation:'builtIn',chambers:3,freezerPosition:'top'});assert.equal(layoutZones(copy,n.id).length,3);
  const snapshot=JSON.stringify(copy);for(const options of [{chambers:0},{chambers:4},{installation:'bad'},{freezerPosition:'left'}])assert.throws(()=>M.configureFridge(copy,n.id,options));assert.equal(JSON.stringify(copy),snapshot);
});
test('all fridge chamber configurations share the same closed model; only the selected door and interior light open',()=>{
  const physicalBounds=root=>{root.updateMatrixWorld(true);const bounds=new THREE.Box3();root.traverse(o=>{if(o.isMesh&&o.userData.kind!=='section')bounds.union(new THREE.Box3().setFromObject(o));});return bounds;};
  for(const installation of ['freestanding','builtIn'])for(const chambers of [1,2,3])for(const freezerPosition of ['top','bottom']){
    const shape={type:'fridge',pos:[2,3],rot:90,width:.75,height:2,depth:.65,fridge:{installation,chambers,freezerPosition}},spec=fridgeChambers(shape),zones=spec.map(c=>({nodeId:c.key,name:c.name,kind:'box',fridgeChamber:c.key,rect:[0,0,1,1]})),plan=buildFurniture([shape]),overview=buildStorageInterior(shape,zones);
    assert.equal(spec.length,chambers);assert.ok(Math.abs(spec.reduce((a,c)=>a+c.rect[3],0)-1)<1e-8);if(chambers>1)assert.equal(spec[freezerPosition==='top'?0:spec.length-1].key,'freezer');const a=physicalBounds(plan),b=physicalBounds(overview.root);assert.ok(a.min.distanceTo(b.min)<1e-6&&a.max.distanceTo(b.max)<1e-6);overview.animate(1);assert.ok(overview.doors.every(d=>d.pivot.rotation.y===0));assert.ok(overview.lights.every(l=>l.light.intensity===0));
    const selected=spec[0].key,opened=buildStorageInterior(shape,[{nodeId:selected,name:'Отделение',kind:'space',rect:[0,0,1,1]}],{chamberKey:selected});opened.animate(1);assert.equal(opened.doors.filter(d=>d.pivot.rotation.y!==0).length,1);assert.equal(opened.lights.filter(l=>l.light.intensity>0).length,1);assert.equal(opened.lights.find(l=>l.light.intensity>0).key,selected);assert.deepEqual(opened.hits.map(h=>h.userData.id),[selected]);assert.equal(opened.focusRoot.userData.fridgeChamber,selected);opened.animate(0);assert.ok(opened.lights.every(l=>l.light.intensity===0));opened.root.traverse(o=>{if(o.geometry)for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));});overview.dispose();opened.dispose();
  }
});
test('legacy fridge shelves and direct products survive migration without archiving or changing stable IDs',()=>{
  const d=seed(),shape=d.plan.furniture.find(f=>f.type==='fridge'),n=d.nodes.find(n=>n.furnitureId===shape.id),legacy=M.newNode(d,{parentId:n.id,kind:'shelf',name:'Старая полка'}),product=M.newNode(d,{parentId:legacy.id,name:'Продукт на старой полке',purchaseCents:5000}),direct=M.newNode(d,{parentId:n.id,name:'Продукт без полки'});
  n.storageLayout={template:'grid',columns:1,rows:1,zones:[{nodeId:legacy.id,rect:[0,0,1,1]}]};M.migrate(d);M.validate(d);const parent=M.getNode(d,legacy.parentId);assert.equal(parent.fridgeChamber,'cooling');assert.equal(product.parentId,legacy.id);assert.equal(product.archived,null);assert.equal(direct.parentId,n.id);assert.equal(direct.archived,null);assert.equal(product.purchaseCents,5000);assert.equal(parent.storageLayout.zones[0].nodeId,legacy.id);const count=d.nodes.length;M.migrate(d);assert.equal(d.nodes.length,count);
});
test('clear map keeps only items in Unplaced, trashes furniture, supports an empty plan and undo snapshot',()=>{
  const d=seed(),before=structuredClone(d),items=d.nodes.filter(n=>n.kind==='item').map(n=>structuredClone(n));M.clearApartment(d);M.validate(d);const cfg=normalize(d.plan);assert.ok(Object.values(cfg.bounds).every(Number.isFinite));assert.equal(d.plan.rooms.length,0);assert.equal(d.plan.furniture.length,0);assert.deepEqual(d.nodes.filter(n=>n.kind==='item').map(n=>n.id),items.map(n=>n.id));assert.ok(d.nodes.every(n=>n.kind==='item'&&n.parentId===M.UNPLACED_ID||n.id===M.UNPLACED_ID));assert.ok(d.trash.length);assert.ok(d.trash.every(e=>e.nodes.every(n=>n.kind!=='item')));assert.equal(d.nodes.find(n=>n.name==='Футболка Nike').purchaseCents,items.find(n=>n.name==='Футболка Nike').purchaseCents);M.validate(JSON.parse(JSON.stringify(d)));M.validate(before);
  M.recover(d,d.trash[0].id,M.UNPLACED_ID);M.validate(d);assert.equal(d.plan.furniture.length,0);
});
test('kitchen packing uses METOD widths, leaves a filler, respects upper toggle and custom depth',()=>{
  for(const width of [.15,.6,1.3,3,3.05,3.2,4.7]){const s=kitchenModules({width}),base=s.modules.filter(m=>m.tier==='base');assert.ok(base.every(m=>[.2,.3,.4,.6,.8].includes(m.width)));assert.ok(Math.abs(base.reduce((v,m)=>v+m.width,0)+s.filler-width)<1e-7);assert.ok(base.every(m=>m.x-m.width/2>=-width/2-.001&&m.x+m.width/2<=width/2+.001));}
  assert.equal(kitchenModules({width:3}).modules.length,10);assert.equal(kitchenModules({width:3,upper:false}).modules.length,5);assert.ok(Math.abs(kitchenModules({depth:.7}).depth-.7)<1e-9);
});
test('kitchen module replacement preserves possessions and trashes old structure, keeps module IDs and persists through migrations and plan edits',()=>{
  const d=seed(),shape=d.plan.furniture.find(f=>f.type==='kitchen'),root=d.nodes.find(n=>n.furnitureId===shape.id),module=d.nodes.find(n=>n.parentId===root.id&&n.kitchenModule==='base:0'),shelf=M.children(d,module.id)[0],thing=M.newNode(d,{name:'Вещь в заменяемом шкафу',parentId:shelf.id,purchaseCents:12000}),before=structuredClone(d),oldIds=M.children(d,module.id).map(n=>n.id);
  M.changeKitchenModuleType(d,module.id,'washingMachine');M.validate(d);assert.equal(module.kitchenModule,'base:0');assert.equal(shape.moduleTypes['base:0'],'washingMachine');assert.equal(thing.archived,null);assert.equal(thing.parentId,module.id);assert.equal(thing.purchaseCents,12000);assert.ok(oldIds.every(id=>!M.getNode(d,id)&&d.trash.some(e=>e.nodes.some(n=>n.id===id))));assert.equal(M.children(d,module.id).length,1);assert.deepEqual(layoutZones(d,module.id),[]);assert.ok(M.catalogItems(d).some(n=>n.id===thing.id));
  const count=d.nodes.length,events=d.events.length;M.changeKitchenModuleType(d,module.id,'washingMachine');assert.equal(d.events.length,events);M.migrate(d);M.migrate(d);assert.equal(d.nodes.length,count);assert.equal(M.children(d,module.id).length,1);
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.syncPlan(copy,structuredClone(copy.plan));M.validate(copy);assert.equal(copy.plan.furniture.find(f=>f.id===shape.id).moduleTypes['base:0'],'washingMachine');assert.equal(M.getNode(copy,module.id).kitchenModuleType,'washingMachine');
  M.changeKitchenModuleType(copy,module.id,'cabinet');M.validate(copy);assert.equal(M.children(copy,module.id).filter(n=>n.autoSection).length,3);assert.ok(M.children(copy,module.id).every(n=>!oldIds.includes(n.id)));assert.equal(M.getNode(copy,thing.id).archived,null);M.validate(before);assert.equal(M.getNode(before,thing.id).archived,null);
});
test('all requested kitchen types have tier-specific choices, safe validation and distinct shared plan/focus models',()=>{
  const d=seed(),shape=d.plan.furniture.find(f=>f.type==='kitchen'),root=d.nodes.find(n=>n.furnitureId===shape.id),modules=M.children(d,root.id).filter(n=>n.kitchenModule),base=modules.find(n=>n.kitchenModule==='base:0'),upper=modules.find(n=>n.kitchenModule==='upper:0');
  const before=JSON.stringify(d);for(const [node,type]of [[upper,'washingMachine'],[base,'hood'],[base,'dishDrainer'],[upper,'bad']])assert.throws(()=>M.changeKitchenModuleType(d,node.id,type));assert.equal(JSON.stringify(d),before);
  assert.ok(kitchenTypeOptions('upper').some(([id])=>id==='dishDrainer'));assert.ok(kitchenTypeOptions('base').some(([id])=>id==='dryer'));
  for(const [type,meta]of Object.entries(KITCHEN_MODULE_TYPES)){
    const node=meta.tiers.includes('base')?base:upper;M.changeKitchenModuleType(d,node.id,type);M.migrate(d);M.validate(d);const model=buildKitchen(shape),focused=buildKitchen(shape,{moduleKey:node.kitchenModule,zones:layoutZones(d,node.id)}),group=model.root.children.find(g=>g.userData.kitchenModule===node.kitchenModule),focusedGroup=focused.focusRoot;
    assert.equal(group.userData.moduleType,type);assert.equal(focusedGroup.userData.moduleType,type);assert.equal(M.children(d,node.id).length,meta.shelves||0);const a=new THREE.Box3().setFromObject(group),b=new THREE.Box3().setFromObject(focusedGroup);assert.ok(a.min.distanceTo(b.min)<.04&&a.max.distanceTo(b.max)<.04,type+' replaces the model in focused mode');focused.animate(1);
    let meshes=0;group.traverse(o=>{if(o.geometry){meshes++;for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));}});assert.ok(meshes>3);if(!meta.storage)assert.ok(group.children.some(g=>g.userData.applianceType===type));
  }
  for(const moduleTypes of [{bad:'hood'},{'base:0':'hood'},{'upper:0':'unknown'},[]]){const bad=structuredClone(d);bad.plan.furniture.find(f=>f.id===shape.id).moduleTypes=moduleTypes;assert.throws(()=>M.validate(bad));}
});
test('built-in sections are storage only, hidden from all item catalog modes and have no own value',()=>{
  const d=seed(),shirt=d.nodes.find(n=>n.name==='Футболка Nike'),s=M.getNode(d,shirt.parentId),cabinet=d.nodes.find(n=>n.kitchenModule),realBox=d.nodes.find(n=>n.name==='Коробка с аксессуарами');
  const ids=new Set(M.catalogItems(d).map(n=>n.id));assert.ok(ids.has(shirt.id));assert.ok(ids.has(realBox.id));assert.ok(!ids.has(s.id)&&!ids.has(cabinet.id));
  assert.throws(()=>M.updateNode(d,s.id,{purchaseCents:100}));assert.throws(()=>M.newNode(d,{kind:'drawer',name:'Ящик',parentId:s.parentId,currentCents:100}));
  s.purchaseCents=90000;s.currentCents=60000;const total=M.totals(d);M.migrate(d);assert.equal(s.purchaseCents,null);assert.equal(s.legacySectionPrice.purchaseCents,90000);assert.equal(M.totals(d).purchase,total.purchase);assert.equal(M.totals(d,s.id).purchase,shirt.purchaseCents+d.nodes.find(n=>n.name==='Худи').purchaseCents);M.validate(d);assert.equal(realBox.purchaseCents,79000);
});
test('kitchen cabinets and shelves are live stable IDs; resizing and repeated migration preserve contents',()=>{
  const d=seed(),shape=d.plan.furniture.find(f=>f.type==='kitchen'),root=d.nodes.find(n=>n.furnitureId===shape.id),c=d.nodes.find(n=>n.parentId===root.id&&n.kitchenModule),s=d.nodes.find(n=>n.parentId===c.id&&n.kind==='shelf'),thing=M.newNode(d,{name:'Чашка',parentId:s.id});const count=d.nodes.length;M.migrate(d);M.migrate(d);assert.equal(d.nodes.length,count);const plan=structuredClone(d.plan);plan.furniture.find(f=>f.id===shape.id).width=.8;M.syncPlan(d,plan);assert.equal(M.getNode(d,thing.id).parentId,s.id);assert.ok(M.getNode(d,c.id));M.validate(d);
});
test('automatic section types renumber without losing prices or nested things and prohibit sub-shelves',()=>{
  const d=seed(),thing=d.nodes.find(n=>n.name==='Футболка Nike'),s=M.getNode(d,thing.parentId),before=thing.purchaseCents;
  assert.throws(()=>M.newNode(d,{name:'Подполка',kind:'shelf',parentId:s.id}));
  for(const [kind]of SECTION_KINDS){M.changeSectionType(d,s.id,kind);assert.equal(M.getNode(d,thing.id).parentId,s.id);assert.equal(thing.purchaseCents,before);assert.ok(/ 1$| 2$/.test(s.name));M.validate(d);}
});
test('kitchen open and closed share identical frames, countertops and module bounds',()=>{
  const shape={type:'kitchen',width:3,pos:[1,2],rot:90},modules=kitchenModules(shape),zones=modules.modules.map(m=>({nodeId:m.key,moduleKey:m.key,name:m.key,kind:'box',rect:[0,0,1,1]})),closed=buildKitchen(shape),opened=buildKitchen(shape,{zones});
  const a=new THREE.Box3().setFromObject(closed.root),b=new THREE.Box3().setFromObject(opened.root);assert.ok(a.min.distanceTo(b.min)<.04&&a.max.distanceTo(b.max)<.04);opened.animate(1);assert.equal(opened.hits.length,10);assert.equal(opened.labels.length,10);const ys=opened.labels.map(l=>l.anchor.getWorldPosition(new THREE.Vector3()).y);assert.ok(Math.max(...ys)-Math.min(...ys)>1);for(const hit of opened.hits)assert.ok(hit.userData.id);for(const r of [closed.root,opened.root])r.traverse(o=>{if(o.geometry)for(const v of o.geometry.getAttribute('position').array)assert.ok(Number.isFinite(v));});
});
test('kitchen overview keeps all doors closed; entering a module opens only its door and exposes its shelves',()=>{
  const shape={type:'kitchen',width:3,pos:[1,2],rot:90},zones=kitchenModules(shape).modules.map(m=>({nodeId:m.key,moduleKey:m.key,name:m.key,kind:'box',rect:[0,0,1,1]}));
  const pivots=model=>{const result=[];model.root.traverse(o=>{if(o.parent?.userData.kitchenModule&&o.isGroup)result.push(o);});return result;};
  const overview=buildStorageInterior(shape,zones);overview.animate(1);assert.ok(pivots(overview).every(p=>p.rotation.y===0));
  for(const key of ['upper:2','base:4']){
    const shelves=sectionRects('grid',2,2,4).map((rect,i)=>({nodeId:'s'+i,name:'Полка '+i,kind:'shelf',rect})),model=buildStorageInterior(shape,shelves,{moduleKey:key});model.animate(1);
    const opened=pivots(model).filter(p=>p.rotation.y!==0);assert.equal(opened.length,1);assert.equal(opened[0].parent.userData.kitchenModule,key);assert.equal(model.focusRoot.userData.kitchenModule,key);assert.deepEqual(model.hits.map(h=>h.userData.id),shelves.map(s=>s.nodeId));assert.ok(model.labels.every(l=>!l.moduleKey));model.animate(0);assert.ok(pivots(model).every(p=>p.rotation.y===0));model.dispose();
  }
  overview.dispose();
});
test('user grid overrides automatic sections and survives migration, type changes and backup roundtrips',()=>{
  const d=seed(),n=d.nodes.find(n=>n.name==='Шкаф в спальне'),before=d.nodes.filter(x=>x.parentId===n.id).map(x=>x.id),thing=d.nodes.find(n=>n.name==='Футболка Nike'),parent=thing.parentId,price=thing.purchaseCents;
  const sections=M.setStorageGrid(d,n.id,{columns:2,rows:3});assert.equal(sections.length,6);M.validate(d);const expected=sectionRects('grid',2,3,6);assert.deepEqual(layoutZones(d,n.id).map(z=>z.rect),expected);assert.ok(before.every(id=>M.getNode(d,id).parentId===n.id));
  M.changeSectionType(d,sections[0].id,'drawer');const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);assert.deepEqual(layoutZones(copy,n.id).map(z=>z.rect),expected);assert.equal(M.getNode(copy,thing.id).parentId,parent);assert.equal(M.getNode(copy,thing.id).purchaseCents,price);
  const snapshot=JSON.stringify(copy);assert.throws(()=>M.setStorageGrid(copy,n.id,{columns:0,rows:1}));assert.equal(JSON.stringify(copy),snapshot);
  const cabinet=d.nodes.find(n=>n.kitchenModule);M.setStorageGrid(d,cabinet.id,{columns:2,rows:2,kinds:['shelf','drawer','compartment','box']});M.validate(d);assert.deepEqual(layoutZones(d,cabinet.id).map(z=>z.rect),sectionRects('grid',2,2,4));
});
test('reducing the grid trashes old sections, preserves possessions and creates an empty grid',()=>{
  const d=seed(),n=d.nodes.find(n=>n.name==='Шкаф в спальне');M.setStorageGrid(d,n.id,{columns:3,rows:2});
  const old=M.children(d,n.id).filter(x=>x.kind!=='item'),oldIds=old.map(s=>s.id),shirt=d.nodes.find(n=>n.name==='Футболка Nike'),price=shirt.purchaseCents;
  const independent=M.newNode(d,{parentId:old[0].id,name:'Отдельный архив'});M.archive(d,independent.id,{reason:'Другое',date:'2026-10-23'});const oldArchive=structuredClone(independent.archived);
  const created=M.setStorageGrid(d,n.id,{columns:2,rows:2,kinds:['shelf','drawer','compartment','box']});M.validate(d);
  assert.equal(created.length,4);assert.ok(created.every(s=>!oldIds.includes(s.id)&&!M.children(d,s.id).length));
  assert.equal(shirt.archived,null);assert.equal(shirt.parentId,n.id);assert.equal(shirt.purchaseCents,price);assert.deepEqual(independent.archived,oldArchive);
  assert.ok(oldIds.every(id=>!M.getNode(d,id)&&d.trash.some(e=>e.nodes.some(n=>n.id===id))));assert.equal(layoutZones(d,n.id).length,5); // Four new sections plus the real purchased box preserved from the old drawer.
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);assert.equal(layoutZones(copy,n.id).length,5);assert.equal(M.getNode(copy,shirt.id).archived,null);
});
test('opening keeps the exact original furniture at rest and preserves source materials and model details',()=>{
  function signature(root){root.updateMatrixWorld(true);const parts=[];root.traverse(o=>{if(!o.isMesh||o.userData.kind==='section')return;for(let p=o;p;p=p.parent)if(!p.visible)return;const m=Array.isArray(o.material)?o.material:[o.material];parts.push(JSON.stringify([o.geometry.type,o.geometry.attributes.position.count,m.map(m=>[m.color?.getHexString(),m.roughness,m.metalness]),o.matrixWorld.elements.map(v=>Math.round(v*1e6)/1e6)]));});return parts.sort();}
  const zones=[{nodeId:'a',name:'Полка 1',kind:'shelf',rect:[0,0,1,.5]},{nodeId:'b',name:'Ящик 1',kind:'drawer',rect:[0,.5,1,.5]}];
  for(const type of [...OPENABLE_TYPES].filter(t=>t!=='kitchen')){
    const shape={id:'source',type,color:'#28504b',width:1.3,height:1.9,depth:.55,pos:[3,4],y:.12,rot:90},source=buildFurniture([shape]),model=buildStorageInterior(shape,zones),expected=signature(source);
    assert.deepEqual(signature(model.root),expected,type+' changes the original furniture at rest');
    const colors=new Set();source.traverse(o=>{if(o.material?.color)colors.add(o.material.color.getHexString());});model.animate(1);const visibleColors=new Set();model.root.traverse(o=>{if(o.isMesh&&o.visible&&o.material?.color)visibleColors.add(o.material.color.getHexString());});assert.ok([...colors].every(c=>visibleColors.has(c)),type+' loses source materials');
    model.animate(0);assert.deepEqual(signature(model.root),expected,type+' does not close back to the original model');model.dispose();
  }
});
test('room type changes only presentation, preserves geometry, contents, identity and overrides',()=>{
  const d=seed(),r=d.plan.rooms[0],n=d.nodes.find(n=>n.roomId===r.id),rect=structuredClone(r.rect),furniture=JSON.stringify(d.plan.furniture),ids=d.nodes.map(n=>n.id);
  applyRoomPresentation(r,{type:'office',label:'Максим',icon:'games',cardColor:'#8899aa'});M.syncPlan(d,d.plan);
  assert.equal(M.getNode(d,n.id).name,'Кабинет (Максим)');assert.equal(roomGlyph(M.getNode(d,n.id)),'games');assert.deepEqual(r.rect,rect);assert.equal(JSON.stringify(d.plan.furniture),furniture);assert.deepEqual(d.nodes.map(n=>n.id),ids);
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);assert.equal(M.getNode(copy,n.id).cardColor,'#8899aa');
  const edited=structuredClone(d.plan);applyRoomPresentation(edited.rooms[0],{type:'office',label:'Максим'});M.syncPlan(d,edited);assert.equal(roomGlyph(M.getNode(d,n.id)),'laptop');assert.equal(M.getNode(d,n.id).cardColor,undefined);
});
test('room inference matches exact names and leaves custom or ambiguous names untouched',()=>{
  assert.equal(inferRoomType({name:'Кухня'}).roomType,'kitchen');assert.equal(inferRoomType({name:'Моя кухня'}).roomType,undefined);assert.equal(inferRoomType({name:'Спальня (детская)'}).roomType,undefined);
  const other={rect:[0,0,3,4]};applyRoomPresentation(other,{type:'other',customName:'Мансарда',label:'левая'});assert.equal(other.name,'Мансарда (левая)');assert.equal(roomGlyph(other),'home');
});
test('storage templates keep existing section IDs, contents and safe normalized dimensions through backups',()=>{
  const d=seed(),n=d.nodes.find(n=>n.name==='Шкаф в спальне'),before=d.nodes.filter(x=>x.parentId===n.id).map(x=>x.id),spec=arrangeStorage(d,n.id,{template:'wardrobe',columns:2,rows:2}),rects=sectionRects(spec.template,2,2,spec.capacity);
  while(spec.children.length<spec.capacity)spec.children.push(M.newNode(d,{name:'Полка '+(spec.children.length+1),kind:'shelf',parentId:n.id}));
  n.storageLayout={template:'wardrobe',columns:2,rows:2,zones:spec.children.map((x,i)=>({nodeId:x.id,rect:rects[i]}))};
  M.validate(d);assert.ok(before.every(id=>M.getNode(d,id).parentId===n.id));
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);assert.deepEqual(layoutZones(copy,n.id).map(z=>z.nodeId),spec.children.map(x=>x.id));
  assert.throws(()=>arrangeStorage(d,n.id,{columns:1,rows:1}));
});
test('moving sections ignores stale layout links without duplicating or deleting inventory',()=>{
  const d=seed(),n=d.nodes.find(n=>n.name==='Шкаф в спальне'),zones=layoutZones(d,n.id);n.storageLayout={template:'shelves',columns:1,rows:zones.length,zones:zones.map(z=>({nodeId:z.nodeId,rect:z.rect}))};
  const moved=M.getNode(d,zones[0].nodeId),target=d.nodes.find(r=>r.kind==='room'&&r.id!==n.parentId&&!r.virtual),ids=d.nodes.map(n=>n.id);M.move(d,moved.id,target.id);
  assert.ok(!layoutZones(d,n.id).some(z=>z.nodeId===moved.id));assert.deepEqual(d.nodes.map(n=>n.id),ids);M.validate(d);
});
test('invalid section rectangles and overlaps cannot replace a valid inventory document',()=>{
  for(const zones of [[{nodeId:'x',rect:[0,0,NaN,1]}],[{nodeId:'x',rect:[0,0,1,1]},{nodeId:'y',rect:[.5,0,.5,1]}],[{nodeId:'x',rect:[0,0,2,1]}]])assert.throws(()=>validateStorageLayout({storageLayout:{columns:1,rows:2,zones}}));
});
test('translation is reviewed by stable IDs and preserves excluded/custom names and geometry',()=>{
  const plan=JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8'));plan.lights.push({id:'custom',name:'Моя лампа',pos:[1,1]});const before=JSON.stringify(plan.lights.map(l=>[l.id,l.pos]));const choices=translationCandidates(plan),chosen=choices.find(c=>c.id==='living.main');
  translatePlan(plan,[chosen.key]);assert.equal(plan.lights[0].name,'Потолочный светильник');assert.equal(plan.lights[1].name,'Floor lamp');assert.equal(plan.lights.at(-1).name,'Моя лампа');assert.equal(JSON.stringify(plan.lights.map(l=>[l.id,l.pos])),before);
});
test('storage interior geometry opens doors/drawers and exposes only inventory section hit targets',()=>{
  const zones=[{nodeId:'shelf',name:'Полка',kind:'shelf',rect:[0,0,1,.5]},{nodeId:'drawer',name:'Ящик',kind:'drawer',rect:[0,.5,1,.5]}];
  for(const type of ['wardrobe','dresser','fridge','stove','metalRack','slidingWardrobe']){const model=buildStorageInterior({id:'test',type,pos:[3,4],rot:90},zones);const closed=new THREE.Box3().setFromObject(model.root);model.animate(1);model.highlight('drawer');
    assert.deepEqual(model.hits.map(h=>h.userData.id),['shelf','drawer']);assert.ok(model.hits.every(h=>h.userData.kind==='section'));assert.equal(model.labels.length,2);assert.ok(Number.isFinite(closed.max.y));model.root.traverse(o=>{if(o.geometry)for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));});assert.equal(model.hits[1].material.opacity,.18);model.dispose();}
});

test('base-only kitchen is a separate model with no upper modules or inventory cabinets',()=>{
  const full={type:'kitchen',width:3},before=JSON.stringify(full),base={id:'base-only',type:'kitchenBase',pos:[1,1],moduleTypes:{'base:0':'washingMachine'}};
  assert.ok(kitchenModules(full).modules.some(m=>m.tier==='upper'));assert.ok(kitchenModules(base).modules.every(m=>m.tier==='base'));assert.equal(JSON.stringify(full),before);
  const d=seed(),room=d.plan.rooms[0],plan=structuredClone(d.plan);base.pos=[room.rect[0]+1,room.rect[1]+1];plan.furniture.push(base);M.syncPlan(d,plan);M.validate(d);
  const root=d.nodes.find(n=>n.furnitureId===base.id),modules=M.children(d,root.id);assert.ok(modules.length);assert.ok(modules.every(n=>n.kitchenModule.startsWith('base:')));assert.equal(modules.find(n=>n.kitchenModule==='base:0').kitchenModuleType,'washingMachine');
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);assert.equal(M.children(copy,root.id).length,modules.length);assert.ok(M.children(copy,root.id).every(n=>n.kitchenModule.startsWith('base:')));
});
test('integrated hood cabinet supports an opening door, shelves and saved item locations',()=>{
  assert.ok(kitchenTypeOptions('upper').some(([id])=>id==='hoodCabinet'));assert.ok(!kitchenTypeOptions('base').some(([id])=>id==='hoodCabinet'));
  const d=seed(),room=d.plan.rooms[0],plan=structuredClone(d.plan),shape={id:'standalone-hood',type:'hoodCabinet',pos:[room.rect[0]+1,room.rect[1]+1],y:1.48};plan.furniture.push(shape);M.syncPlan(d,plan);M.validate(d);
  const root=d.nodes.find(n=>n.furnitureId===shape.id),module=M.children(d,root.id)[0];assert.equal(module.kitchenModuleType,'hoodCabinet');assert.equal(M.children(d,module.id).length,2);
  const shelf=M.children(d,module.id)[0],item=M.newNode(d,{name:'Фильтр вытяжки',kind:'item',parentId:shelf.id,categoryId:'electronics'});assert.equal(planLocation(d,item.id).focusId,module.id);
  const model=buildStorageInterior(shape,layoutZones(d,module.id),{moduleKey:module.kitchenModule});let hoods=0;model.root.traverse(o=>{if(o.userData.applianceType==='hoodCabinet')hoods++;});assert.equal(hoods,1);assert.equal(model.hits.length,2);model.animate(1);assert.ok(model.root.children.some(g=>g.children.some(p=>Math.abs(p.rotation.y)>.1)));model.dispose();
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);assert.equal(M.getNode(copy,item.id).parentId,shelf.id);
});
