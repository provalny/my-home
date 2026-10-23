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
import { kitchenModules, SECTION_KINDS } from './ikea-storage.js';
import { buildKitchen } from '../three/kitchen.js';
import { normalize } from '../config.js';
const seed=()=>M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8')));
test('clear map keeps only items in Unplaced, trashes furniture, supports an empty plan and undo snapshot',()=>{
  const d=seed(),before=structuredClone(d),items=d.nodes.filter(n=>n.kind==='item').map(n=>structuredClone(n));M.clearApartment(d);M.validate(d);const cfg=normalize(d.plan);assert.ok(Object.values(cfg.bounds).every(Number.isFinite));assert.equal(d.plan.rooms.length,0);assert.equal(d.plan.furniture.length,0);assert.deepEqual(d.nodes.filter(n=>n.kind==='item').map(n=>n.id),items.map(n=>n.id));assert.ok(d.nodes.every(n=>n.kind==='item'&&n.parentId===M.UNPLACED_ID||n.id===M.UNPLACED_ID));assert.ok(d.trash.length);assert.ok(d.trash.every(e=>e.nodes.every(n=>n.kind!=='item')));assert.equal(d.nodes.find(n=>n.name==='Футболка Nike').purchaseCents,items.find(n=>n.name==='Футболка Nike').purchaseCents);M.validate(JSON.parse(JSON.stringify(d)));M.validate(before);
  M.recover(d,d.trash[0].id,M.UNPLACED_ID);M.validate(d);assert.equal(d.plan.furniture.length,0);
});
test('kitchen packing uses METOD widths, leaves a filler, respects upper toggle and custom depth',()=>{
  for(const width of [.15,.6,1.3,3,3.05,3.2,4.7]){const s=kitchenModules({width}),base=s.modules.filter(m=>m.tier==='base');assert.ok(base.every(m=>[.2,.3,.4,.6,.8].includes(m.width)));assert.ok(Math.abs(base.reduce((v,m)=>v+m.width,0)+s.filler-width)<1e-7);assert.ok(base.every(m=>m.x-m.width/2>=-width/2-.001&&m.x+m.width/2<=width/2+.001));}
  assert.equal(kitchenModules({width:3}).modules.length,10);assert.equal(kitchenModules({width:3,upper:false}).modules.length,5);assert.ok(Math.abs(kitchenModules({depth:.7}).depth-.7)<1e-9);
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
