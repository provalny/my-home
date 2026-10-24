import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from './model.js';
import { calculateAwards, syncAwards } from './awards.js';
import { categoryAppearance, nodeAppearance } from './appearance.js';
import { ROOM_ICONS, setRoomIcon } from './room-icons.js';
import { roomPreviewPlan } from '../three/room-previews.js';
const seed=()=>M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8')));
const find=(d,name)=>d.nodes.find(n=>n.name===name);

test('room icon follows the same room across plan saves, old plans and JSON backups',()=>{
  const d=seed(),room=d.nodes.find(n=>n.kind==='room'&&!n.virtual);
  assert.equal(ROOM_ICONS.length,20);assert.equal(new Set(ROOM_ICONS.map(([id])=>id)).size,20);
  setRoomIcon(d,room.id,'bath');assert.equal(nodeAppearance(d,room).glyph,'bath');
  const plan=structuredClone(d.plan);delete plan.rooms.find(r=>r.id===room.roomId).icon;
  M.syncPlan(d,plan);assert.equal(d.plan.rooms.find(r=>r.id===room.roomId).icon,'bath');
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);
  assert.equal(nodeAppearance(copy,M.getNode(copy,room.id)).glyph,'bath');
  assert.throws(()=>setRoomIcon(copy,room.id,'untrusted-custom-icon'));
  assert.equal(nodeAppearance(copy,{kind:'room',icon:'unknown'}).glyph,'home');
});
test('specific model icons survive removing geometry and keep category and photo semantics',()=>{
  const d=seed(),room=d.plan.rooms[0],pos=[room.rect[0]+1,room.rect[1]+1];
  const plan=structuredClone(d.plan);plan.furniture.push({id:'stove-icon',type:'stove',pos},{id:'rack-icon',type:'metalRack',pos});M.syncPlan(d,plan);
  const stove=d.nodes.find(n=>n.furnitureId==='stove-icon'),rack=d.nodes.find(n=>n.furnitureId==='rack-icon');
  assert.equal(nodeAppearance(d,stove).glyph,'stove');assert.equal(nodeAppearance(d,rack).glyph,'rack');
  assert.equal(stove.categoryId,'appliances');stove.photo='data:image/png;base64,AA';
  M.detachFurniture(d,stove.id);assert.equal(nodeAppearance(d,stove).glyph,'stove');assert.ok(stove.photo);
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);assert.equal(nodeAppearance(copy,M.getNode(copy,stove.id)).glyph,'stove');
});
test('room preview contains only the target room and its visible furniture without changing the plan',()=>{
  const plan={rooms:[{id:'a',rect:[10,20,4,3]},{id:'b',rect:[14,20,4,3]}],furniture:[{id:'one',pos:[11,21]},{id:'two',pos:[16,21]},{id:'archived',pos:[12,21]}],lights:[],acs:[]};
  const before=JSON.stringify(plan),preview=roomPreviewPlan(plan,'a',['archived']);
  assert.deepEqual(preview.rooms.map(r=>r.id),['a']);assert.deepEqual(preview.furniture.map(f=>f.id),['one']);assert.equal(roomPreviewPlan(plan,'missing'),null);assert.equal(JSON.stringify(plan),before);
});

test('money parses decimal strings without losing kopecks; rejects invalid inputs',()=>{
  assert.equal(M.parseMoney(' 1 299,99 '),129999);assert.equal(M.parseMoney('0.01'),1);assert.equal(M.parseMoney(''),null);
  for(const s of ['-1','10.999','NaN','1e5'])assert.throws(()=>M.parseMoney(s));
});
test('global total counts furniture and each descendant exactly once',()=>{
  const d=seed();const total=d.nodes.filter(n=>n.kind!=='room').reduce((s,n)=>s+(n.purchaseCents||0),0);
  assert.equal(M.totals(d).purchase,total);
  const wardrobe=find(d,'Шкаф в спальне');assert.equal(M.totals(d,wardrobe.id).purchase,4200000+79000+350000+690000+180000);
});
test('move entire subtree updates every address and records movement for each live node',()=>{
  const d=seed();const box=find(d,'Коробка с аксессуарами');const belt=find(d,'Ремень');const room=d.nodes.find(n=>n.kind==='room'&&n.id!==box.parentId);
  M.move(d,box.id,room.id);assert.equal(box.parentId,room.id);assert.ok(M.address(d,belt).startsWith(room.name+' → '));
  assert.equal(d.events.filter(e=>e.type==='move').length,2);M.validate(d);
});
test('cannot create a cycle or move into a plain item or archived destination',()=>{
  const d=seed();const wardrobe=find(d,'Шкаф в спальне');const box=find(d,'Коробка с аксессуарами');
  assert.throws(()=>M.move(d,wardrobe.id,box.id));assert.throws(()=>M.move(d,box.id,box.id));assert.throws(()=>M.move(d,box.id,find(d,'Футболка Nike').id));
  M.archive(d,box.id,{reason:'Подарено',date:M.today()});assert.throws(()=>M.move(d,find(d,'Футболка Nike').id,box.id));
});
test('archive together excludes subtree from totals and stores sale only on root',()=>{
  const d=seed();const box=find(d,'Коробка с аксессуарами');const before=M.totals(d).purchase;const subtree=M.totals(d,box.id).purchase;
  M.archive(d,box.id,{reason:'Продано',date:M.today(),saleCents:50000});assert.equal(M.totals(d).purchase,before-subtree);
  assert.equal(find(d,'Ремень').archived.saleCents,null);assert.equal(box.archived.saleCents,50000);M.validate(d);
});
test('archive container while relocating content preserves content as active',()=>{
  const d=seed();const box=find(d,'Коробка с аксессуарами');const belt=find(d,'Ремень');const shelf=find(d,'Полка 1');
  M.archive(d,box.id,{reason:'Выброшено',date:M.today(),together:false,destination:shelf.id});
  assert.equal(belt.parentId,shelf.id);assert.equal(belt.archived,null);assert.ok(box.archived);M.validate(d);
});
test('archiving only a container relocates independently archived contents without changing their archive metadata',()=>{
  const d=seed(),wardrobe=find(d,'Шкаф в спальне'),shelf=find(d,'Полка 1'),belt=find(d,'Ремень');
  const target=d.nodes.find(n=>n.roomId&&n.id!==wardrobe.parentId);
  M.archive(d,shelf.id,{reason:'Подарено',date:'2026-09-01'});
  M.archive(d,belt.id,{reason:'Продано',date:'2026-09-02',saleCents:50000});
  const nested=M.descendants(d,wardrobe.id),before=new Map(nested.map(n=>[n.id,M.address(d,n)]));
  const archiveInfo=new Map(nested.map(n=>[n.id,structuredClone(n.archived)]));
  const parentId=belt.parentId,eventsBefore=d.events.length;
  M.archive(d,wardrobe.id,{reason:'Выброшено',date:'2026-10-23',together:false,destination:target.id});
  assert.equal(shelf.parentId,target.id);assert.equal(belt.parentId,parentId);
  assert.ok(wardrobe.archived);
  for(const n of nested){
    assert.deepEqual(n.archived,archiveInfo.get(n.id));
    assert.ok(M.address(d,n).startsWith(target.name+' → '));
    assert.ok(d.events.slice(eventsBefore).some(e=>e.type==='move'&&e.nodeId===n.id&&e.from===before.get(n.id)&&e.to===M.address(d,n)));
  }
  assert.equal(belt.archived.saleCents,50000);M.validate(d);
});
test('restoring one archive group leaves independently archived descendants archived',()=>{
  const d=seed();const box=find(d,'Коробка с аксессуарами');const belt=find(d,'Ремень');
  M.archive(d,belt.id,{reason:'Подарено',date:M.today()});M.archive(d,box.id,{reason:'Другое',date:M.today()});
  M.restore(d,box.id,find(d,'Полка 1').id);assert.equal(box.archived,null);assert.ok(belt.archived);M.validate(d);
});
test('removing furniture geometry preserves its inventory and nested content',()=>{
  const d=seed();const wardrobe=find(d,'Шкаф в спальне');const plan=structuredClone(d.plan);const count=d.nodes.length;
  plan.furniture=plan.furniture.filter(f=>f.id!==wardrobe.furnitureId);M.syncPlan(d,plan);
  assert.equal(d.nodes.length,count);assert.ok(M.getNode(d,wardrobe.id));assert.ok(find(d,'Ремень'));M.validate(d);
});
test('deleting a room relocates its contents and keeps archived items valid',()=>{
  const d=seed();const wardrobe=find(d,'Шкаф в спальне');const oldRoom=M.getNode(d,wardrobe.parentId);const plan=structuredClone(d.plan);
  plan.rooms=plan.rooms.filter(r=>r.id!==oldRoom.roomId);plan.lights=plan.lights.filter(l=>l.room!==oldRoom.roomId);plan.acs=plan.acs.filter(a=>a.room!==oldRoom.roomId);
  M.syncPlan(d,plan);assert.ok(M.getNode(d,wardrobe.id));assert.notEqual(wardrobe.parentId,oldRoom.id);M.validate(d);
});
test('backup roundtrip preserves photos, unknown prices, manual fields and stable identities',()=>{
  const d=seed();const n=find(d,'Ремень');n.photo='data:image/jpeg;base64,YWJj';n.currentCents=null;n.wear=25;
  const restored=M.validate(JSON.parse(JSON.stringify(d)));assert.deepEqual(restored,d);
});
test('invalid backups reject dangling locations, cycles, unsafe money and category cycles',()=>{
  {const d=seed();find(d,'Ремень').parentId='missing';assert.throws(()=>M.validate(d));}
  {const d=seed();const box=find(d,'Коробка с аксессуарами');box.parentId=box.id;assert.throws(()=>M.validate(d));}
  {const d=seed();find(d,'Ремень').purchaseCents=NaN;assert.throws(()=>M.validate(d));}
  {const d=seed();d.categories[0].parentId=d.categories[0].id;assert.throws(()=>M.validate(d));}
});
test('search includes nested address, category and preset characteristics',()=>{
  const d=seed();for(const query of ['Nike','белый','Полка 1 Nike','Одежда Nike'])assert.ok(M.search(d,query).some(n=>n.name==='Футболка Nike'));
  M.archive(d,find(d,'Футболка Nike').id,{reason:'Продано',date:M.today()});assert.equal(M.search(d,'Nike').length,0);assert.equal(M.search(d,'Nike',true).length,1);
});
test('manual sibling ordering persists and cannot cross parents',()=>{
  const d=seed();const shelf=M.getNode(d,find(d,'Футболка Nike').parentId),drawer=d.nodes.find(n=>n.parentId===shelf.parentId&&n.kind==='drawer');M.reorder(d,drawer.id,shelf.id);
  assert.equal(M.children(d,shelf.parentId)[0].id,drawer.id);assert.throws(()=>M.reorder(d,find(d,'Коробка с аксессуарами').id,shelf.id));
});
test('dates use whole calendar days; only active expiring entries are listed',()=>{
  const d=seed();const n=find(d,'Молоко');n.expiry='2026-10-26';d.settings.reminderDays=3;
  assert.ok(M.dueItems(d,'2026-10-23').some(x=>x.node.id===n.id&&x.days===3));
  d.settings.reminderDays=2;assert.equal(M.dueItems(d,'2026-10-23').filter(x=>x.node.id===n.id).length,0);
});
test('restoring physical furniture in another room also relocates its geometry',()=>{
  const d=seed();const wardrobe=find(d,'Шкаф в спальне');const room=d.nodes.find(n=>n.kind==='room'&&n.id!==wardrobe.parentId);
  M.archive(d,wardrobe.id,{reason:'Другое',date:M.today()});M.restore(d,wardrobe.id,room.id);
  const rect=d.plan.rooms.find(r=>r.id===room.roomId).rect;const f=d.plan.furniture.find(f=>f.id===wardrobe.furnitureId);
  assert.ok(f.pos[0]>=rect[0]&&f.pos[0]<=rect[0]+rect[2]&&f.pos[1]>=rect[1]&&f.pos[1]<=rect[1]+rect[3]);M.validate(d);
});
test('invalid dates and malformed event history cannot replace a valid document',()=>{
  {const d=seed();find(d,'Молоко').expiry='2026-02-31';assert.throws(()=>M.validate(d));}
  {const d=seed();d.events.push({type:'purchase'});assert.throws(()=>M.validate(d));}
});
test('deleting a single item removes it from search and totals and survives backup roundtrip',()=>{
  const d=seed();const item=find(d,'Футболка Nike');const before=M.totals(d).purchase;
  const entry=M.remove(d,item.id);
  assert.equal(M.getNode(d,item.id),undefined);assert.equal(M.search(d,'Nike').length,0);assert.equal(M.totals(d).purchase,before-item.purchaseCents);
  const loaded=M.validate(JSON.parse(JSON.stringify(d)));
  assert.equal(loaded.trash[0].id,entry.id);assert.equal(loaded.trash[0].nodes[0].name,item.name);
});
test('deleting furniture with its subtree removes its geometry and recovery restores all original identities',()=>{
  const d=seed();const wardrobe=find(d,'Шкаф в спальне');const parent=wardrobe.parentId;
  const expectedIds=[wardrobe,...M.descendants(d,wardrobe.id)].map(n=>n.id);const before=M.totals(d);
  const entry=M.remove(d,wardrobe.id);
  assert.ok(expectedIds.every(i=>!M.getNode(d,i)));assert.ok(!d.plan.furniture.some(f=>f.id===wardrobe.furnitureId));M.validate(d);
  M.recover(d,entry.id,parent);
  assert.ok(expectedIds.every(i=>M.getNode(d,i)));assert.ok(d.plan.furniture.some(f=>f.id===wardrobe.furnitureId));assert.deepEqual(M.totals(d),before);assert.equal(d.trash.length,0);M.validate(d);
});
test('delete furniture while moving all contents, including archived children, elsewhere',()=>{
  const d=seed();const wardrobe=find(d,'Шкаф в спальне');const belt=find(d,'Ремень');const shelf=find(d,'Полка 1');const room=d.nodes.find(n=>n.kind==='room'&&n.id!==wardrobe.parentId);
  M.archive(d,shelf.id,{reason:'Другое',date:M.today()});
  const entry=M.remove(d,wardrobe.id,{together:false,destination:room.id});
  assert.equal(entry.nodes.length,1);assert.equal(shelf.parentId,room.id);assert.ok(shelf.archived);assert.ok(M.address(d,belt).startsWith(room.name+' → '));M.validate(d);
});
test('invalid delete destination and attempts to delete a room do not modify the document',()=>{
  const d=seed();const wardrobe=find(d,'Шкаф в спальне');const before=JSON.stringify(d);
  assert.throws(()=>M.remove(d,wardrobe.id,{together:false,destination:find(d,'Полка 1').id}));assert.equal(JSON.stringify(d),before);
  assert.throws(()=>M.remove(d,wardrobe.parentId));assert.equal(JSON.stringify(d),before);
});
test('recovery can choose another room when the original storage is missing',()=>{
  const d=seed();const item=find(d,'Футболка Nike');const wardrobe=find(d,'Шкаф в спальне');const other=d.nodes.find(n=>n.kind==='room'&&n.id!==wardrobe.parentId);
  const itemEntry=M.remove(d,item.id);M.remove(d,wardrobe.id);M.recover(d,itemEntry.id,other.id);
  assert.equal(M.getNode(d,item.id).parentId,other.id);M.validate(d);
});
test('importing an old plan cannot silently resurrect trashed furniture',()=>{
  const d=seed();const original=structuredClone(d.plan);const wardrobe=find(d,'Шкаф в спальне');M.remove(d,wardrobe.id);
  M.syncPlan(d,original);assert.ok(!d.plan.furniture.some(f=>f.id===wardrobe.furnitureId));assert.equal(M.getNode(d,wardrobe.id),undefined);M.validate(d);
});
test('corrupt trash snapshots reject dangling children, duplicate IDs and invalid money',()=>{
  {const d=seed();const wardrobe=find(d,'Шкаф в спальне');const entry=M.remove(d,wardrobe.id);entry.nodes.find(n=>n.id!==entry.rootId).parentId='missing';assert.throws(()=>M.validate(d));}
  {const d=seed();const entry=M.remove(d,find(d,'Ремень').id);entry.nodes[0].id=d.nodes[0].id;entry.rootId=d.nodes[0].id;assert.throws(()=>M.validate(d));}
  {const d=seed();const entry=M.remove(d,find(d,'Ремень').id);entry.nodes[0].purchaseCents=-10;assert.throws(()=>M.validate(d));}
});

test('deleting a physical room displaces complete trees to Unplaced and removes their old drawings',()=>{
  const d=seed(),wardrobe=find(d,'Шкаф в спальне'),belt=find(d,'Ремень');
  const room=M.getNode(d,wardrobe.parentId),shapeId=wardrobe.furnitureId,oldBeltParent=belt.parentId;
  M.archive(d,belt.id,{reason:'Подарено',date:'2026-10-01'});
  const affected=M.descendants(d,room.id),before=new Map(affected.map(n=>[n.id,M.address(d,n)]));
  const plan=structuredClone(d.plan);plan.rooms=plan.rooms.filter(r=>r.id!==room.roomId);
  // Old editor data can still contain all the old furniture. It must not be
  // assigned to the first surviving room just because its room was removed.
  assert.ok(plan.furniture.some(f=>f.id===shapeId));
  M.syncPlan(d,plan);
  assert.equal(M.getNode(d,room.id),undefined);
  assert.equal(wardrobe.parentId,M.UNPLACED_ID);
  assert.equal(belt.parentId,oldBeltParent);
  assert.ok(belt.archived);
  for(const n of affected){
    assert.ok(M.address(d,n).startsWith('Без места → '));
    assert.ok(d.events.some(e=>e.type==='move'&&e.nodeId===n.id&&e.from===before.get(n.id)&&e.to===M.address(d,n)));
    assert.equal(n.furnitureId,undefined);
  }
  assert.ok(!d.plan.furniture.some(f=>f.id===shapeId));
  const state=JSON.stringify(d);M.syncPlan(d,d.plan);assert.equal(JSON.stringify(d),state);
  M.validate(d);
});

test('a detached furniture card links to new geometry without duplicating inventory and can be removed from plan again',()=>{
  const d=seed(),room=d.nodes.find(n=>n.roomId),rect=d.plan.rooms.find(r=>r.id===room.roomId).rect;
  const n=M.newNode(d,{name:'Мой шкаф',kind:'furniture',parentId:room.id,categoryId:'furniture',purchaseCents:1250000});
  const shelf=M.newNode(d,{name:'Моя полка',kind:'shelf',parentId:n.id});
  const count=d.nodes.length;
  M.placeFurniture(d,n.id,{type:'wardrobe',pos:[rect[0]+rect[2]/2,rect[1]+rect[3]/2]});
  assert.equal(d.nodes.length,count);
  const shape=d.plan.furniture.find(f=>f.inventoryNodeId===n.id);
  assert.equal(n.furnitureId,shape.id);assert.equal(shape.name,n.name);
  assert.equal(shelf.parentId,n.id);assert.equal(n.purchaseCents,1250000);
  M.detachFurniture(d,n.id);
  assert.equal(n.furnitureId,undefined);assert.ok(!d.plan.furniture.some(f=>f.id===shape.id));
  M.syncPlan(d,d.plan);
  assert.equal(d.nodes.length,count);assert.equal(shelf.parentId,n.id);M.validate(d);
});

test('editor and inventory names update the same linked furniture record',()=>{
  const d=seed(),n=find(d,'Шкаф в спальне');
  M.updateNode(d,n.id,{name:'Шкаф с одеждой'});
  assert.equal(d.plan.furniture.find(f=>f.id===n.furnitureId).name,'Шкаф с одеждой');
  const plan=structuredClone(d.plan);plan.furniture.find(f=>f.id===n.furnitureId).name='Семейный шкаф';
  const count=d.nodes.length;M.syncPlan(d,plan);
  assert.equal(n.name,'Семейный шкаф');assert.equal(d.nodes.length,count);M.validate(d);
});

test('linking two drawings to one card or replacing another saved card is rejected before mutations',()=>{
  const d=seed(),n=find(d,'Шкаф в спальне'),other=d.nodes.find(x=>x.kind==='furniture'&&x.id!==n.id);
  const before=JSON.stringify(d),plan=structuredClone(d.plan),shape=plan.furniture.find(f=>f.id===n.furnitureId);
  plan.furniture.push({...structuredClone(shape),id:'second-shape'});
  assert.throws(()=>M.syncPlan(d,plan));assert.equal(JSON.stringify(d),before);
  const replacing=structuredClone(d.plan);replacing.furniture.find(f=>f.id===n.furnitureId).inventoryNodeId=other.id;
  assert.throws(()=>M.syncPlan(d,replacing));assert.equal(JSON.stringify(d),before);
});

test('moving or restoring furniture to Unplaced detaches all geometry including nested furniture',()=>{
  const d=seed(),n=find(d,'Шкаф в спальне'),room=n.parentId,shapeId=n.furnitureId;
  M.updateNode(d,n.id,{parentId:M.UNPLACED_ID});
  assert.equal(n.furnitureId,undefined);assert.ok(!d.plan.furniture.some(f=>f.id===shapeId));
  M.move(d,n.id,room);assert.equal(n.furnitureId,undefined);
  const another=d.nodes.find(x=>x.kind==='furniture'&&x.furnitureId);
  const entry=M.remove(d,another.id),restored=M.recover(d,entry.id,M.UNPLACED_ID);
  assert.equal(restored.furnitureId,undefined);
  assert.ok(entry.furniture.every(f=>!d.plan.furniture.some(x=>x.id===f.id)));M.validate(d);
});

test('inventory additions are not new purchases, including items with old purchase prices and dates',()=>{
  const d=seed();assert.equal(d.events.filter(e=>e.type==='purchase').length,0);
  const room=d.nodes.find(n=>n.roomId);
  const n=M.newNode(d,{name:'Старый монитор',parentId:room.id,purchaseCents:2000000,purchasedAt:'2020-01-10'});
  assert.equal(n.acquisition,'existing');
  assert.equal(d.events.find(e=>e.nodeId===n.id).type,'addition');
  const before=JSON.stringify(d);
  assert.throws(()=>M.newNode(d,{name:'Новая вещь',parentId:room.id,acquisition:'purchase'}));
  assert.throws(()=>M.newNode(d,{name:'Новая вещь',parentId:room.id,acquisition:'purchase',purchasedAt:'2026-02-31'}));
  assert.equal(JSON.stringify(d),before);M.validate(d);
});

test('editing a purchase corrects month and amount without duplicate expenses and records value changes',()=>{
  const d=seed(),room=d.nodes.find(n=>n.roomId);
  const n=M.newNode(d,{name:'Новая куртка',parentId:room.id,acquisition:'purchase',purchasedAt:'2026-09-10',purchaseCents:900000,currentCents:800000});
  const event=d.events.find(e=>e.type==='purchase'&&e.nodeId===n.id);
  M.updateNode(d,n.id,{purchasedAt:'2026-10-12',purchaseCents:1000000,currentCents:750000});
  assert.equal(d.events.filter(e=>e.type==='purchase'&&e.nodeId===n.id).length,1);
  assert.equal(event.effectiveDate,'2026-10-12');assert.equal(event.purchaseCents,1000000);
  assert.ok(!d.events.some(e=>e.type==='purchase'&&e.nodeId===n.id&&e.effectiveDate.startsWith('2026-09')));
  const value=d.events.find(e=>e.type==='value'&&e.nodeId===n.id);
  assert.equal(value.beforePurchase,900000);assert.equal(value.currentCents,750000);
  M.updateNode(d,n.id,{acquisition:'existing'});
  assert.equal(d.events.filter(e=>e.type==='purchase'&&e.nodeId===n.id).length,0);
  assert.equal(d.events.filter(e=>e.type==='addition'&&e.nodeId===n.id).length,1);
  M.updateNode(d,n.id,{acquisition:'purchase',purchasedAt:'2026-08-01'});
  assert.equal(d.events.filter(e=>e.type==='purchase'&&e.nodeId===n.id).length,1);M.validate(d);
});

test('invalid purchase edits leave the item, location, and history untouched',()=>{
  const d=seed(),n=find(d,'Шкаф в спальне'),before=JSON.stringify(d);
  assert.throws(()=>M.updateNode(d,n.id,{parentId:M.UNPLACED_ID,acquisition:'purchase',purchasedAt:''}));
  assert.equal(JSON.stringify(d),before);
});

test('things and storage counts exclude rooms and count each price once, with furniture in both counts',()=>{
  const d=M.createHome(seed(),{mode:'empty'}),room=d.nodes.find(n=>n.roomId);
  const furniture=M.newNode(d,{kind:'furniture',name:'Шкаф',parentId:room.id,purchaseCents:500000});
  const shelf=M.newNode(d,{kind:'shelf',name:'Полка',parentId:furniture.id});
  const drawer=M.newNode(d,{kind:'drawer',name:'Ящик',parentId:furniture.id});
  const box=M.newNode(d,{kind:'box',name:'Коробка',parentId:drawer.id,purchaseCents:5000});
  M.newNode(d,{name:'Ремень',parentId:box.id,purchaseCents:10000});
  const total=M.totals(d);
  assert.equal(total.count,5);assert.equal(total.items,2);assert.equal(total.storage,4);assert.equal(total.purchase,515000);
  M.archive(d,shelf.id,{reason:'Другое',date:M.today()});
  assert.equal(M.totals(d).storage,3);M.validate(d);
});

test('legacy migration preserves explicit purchases and turns undated catalogue imports into additions, including trash',()=>{
  const d=seed(),dated=find(d,'Футболка Nike'),trashed=find(d,'Ремень');
  dated.purchasedAt='2025-12-12';
  M.remove(d,trashed.id);
  for(const n of [...d.nodes,...d.trash.flatMap(e=>e.nodes)])delete n.acquisition;
  for(const e of d.events)if(e.type==='addition')e.type='purchase';
  const ids=d.nodes.map(n=>n.id),photo=find(d,'Худи').photo='data:image/jpeg;base64,YWJj';
  M.migrate(d);
  assert.deepEqual(d.nodes.map(n=>n.id),ids);
  assert.equal(dated.acquisition,'purchase');
  assert.equal(d.events.find(e=>e.nodeId===dated.id&&e.type==='purchase').effectiveDate,'2025-12-12');
  assert.equal(d.trash[0].nodes[0].acquisition,'existing');
  assert.ok(!d.events.some(e=>e.type==='purchase'&&e.nodeId!==dated.id));
  assert.equal(find(d,'Худи').photo,photo);
  const state=JSON.stringify(d);M.migrate(d);assert.equal(JSON.stringify(d),state);M.validate(d);
});

test('new-home preparation is pure, keeps categories/settings and clears all old inventory data',()=>{
  const d=seed(),n=find(d,'Шкаф в спальне');
  n.photo='data:image/jpeg;base64,YWJj';n.notes='Личная заметка';d.settings.apartmentFill=42;
  const before=JSON.stringify(d),empty=M.createHome(d,{mode:'empty'}),plan=M.createHome(d,{mode:'plan'});
  assert.equal(JSON.stringify(d),before);
  assert.equal(empty.plan.rooms.length,1);assert.equal(empty.plan.furniture.length,0);
  assert.equal(empty.nodes.filter(n=>n.kind!=='room').length,0);
  assert.equal(empty.events.length,0);assert.deepEqual(empty.trash,[]);
  assert.deepEqual(empty.categories,d.categories);assert.deepEqual(empty.settings,{...d.settings,apartmentFill:null});
  assert.equal(plan.settings.apartmentFill,null);
  empty.categories[0].name='Изменено';assert.notEqual(empty.categories[0].name,d.categories[0].name);
  assert.equal(plan.plan.furniture.length,d.plan.furniture.length);
  assert.equal(plan.nodes.filter(n=>n.kind==='furniture').length,d.plan.furniture.length);
  assert.ok(plan.nodes.some(n=>n.autoSection));
  assert.ok(plan.nodes.filter(n=>n.kind==='furniture').every(n=>n.purchaseCents===null&&n.photo===null&&!n.notes&&n.fill===null));
  assert.ok(plan.nodes.filter(n=>n.kind==='furniture').every(n=>!d.nodes.some(old=>old.id===n.id)));
  assert.equal(plan.events.filter(e=>e.type==='purchase').length,0);
  M.validate(empty);M.validate(plan);
});

test('version 1 validation accepts addition and undo records but rejects invalid acquisition, fill, or geometry links',()=>{
  {const d=seed();M.record(d,'undo',{id:'application',name:'Последнее действие'});M.validate(d);}
  {const d=seed();find(d,'Худи').acquisition='invalid';assert.throws(()=>M.validate(d));}
  {const d=seed();find(d,'Худи').acquisition='purchase';find(d,'Худи').purchasedAt='';assert.throws(()=>M.validate(d));}
  {const d=seed();d.settings.apartmentFill=101;assert.throws(()=>M.validate(d));}
  {const d=seed();d.plan.furniture[0].inventoryNodeId=find(d,'Худи').id;assert.throws(()=>M.validate(d));}
});

test('apartment occupancy averages measured physical rooms and excludes virtual storage',()=>{
  const d=seed();for(const n of d.nodes.filter(n=>n.kind==='room'))n.fill=null;
  const rooms=d.nodes.filter(n=>n.kind==='room'&&!n.virtual);
  assert.deepEqual(M.apartmentFill(d),{value:null,known:0,total:rooms.length});
  rooms[0].fill=0;rooms[1].fill=100;M.ensureUnplaced(d).fill=100;
  assert.deepEqual(M.apartmentFill(d),{value:50,known:2,total:rooms.length});
  rooms[1].fill=60;assert.equal(M.apartmentFill(d).value,30);
  rooms[2].fill=100;assert.equal(M.apartmentFill(d).value,53.3);
});


test('category icons are inherited everywhere, survive renaming, and respond to a category change',()=>{
  const d=seed();M.migrate(d);
  const shoes=d.categories.find(c=>c.name==='Обувь');
  assert.equal(categoryAppearance(d,shoes.id).glyph,'shoes');shoes.name='Моя обувь';
  assert.equal(categoryAppearance(d,shoes.id).glyph,'shoes');
  const custom={id:'custom-shirts',parentId:'clothes',name:'Свои футболки',kind:'default'};d.categories.push(custom);
  const n=M.newNode(d,{name:'Новая вещь',parentId:d.nodes.find(n=>n.kind==='room').id,categoryId:custom.id});
  assert.equal(nodeAppearance(d,n).glyph,'clothes');n.categoryId='medicine';assert.equal(nodeAppearance(d,n).glyph,'medicine');
  n.categoryId='missing';assert.equal(nodeAppearance(d,n).glyph,'box');
  assert.equal(nodeAppearance(d,d.nodes.find(n=>n.kind==='room')).glyph,'sofa');
  assert.equal(nodeAppearance(d,{kind:'room',name:'Неизвестная комната'}).glyph,'home');
});
test('fresh demo never grants item milestones; new user objects do, without counting structural shelves',()=>{
  const d=seed(),room=d.nodes.find(n=>n.kind==='room');
  assert.equal(calculateAwards(d).find(a=>a.id==='first-item').earned,false);
  M.newNode(d,{name:'Полка',kind:'shelf',parentId:room.id});
  assert.equal(calculateAwards(d).find(a=>a.id==='first-item').earned,false);
  M.newNode(d,{name:'Моя вещь',parentId:room.id});
  assert.equal(calculateAwards(d).find(a=>a.id==='first-item').earned,true);
  assert.equal(calculateAwards(d).find(a=>a.id==='first-room').earned,true);
});
test('awards recompute old documents, retain grants through deletion/undo, and roundtrip without duplicates',()=>{
  const d=M.createHome(seed()),room=d.nodes.find(n=>n.kind==='room'),old=structuredClone(d);
  const item=M.newNode(d,{name:'Вещь',parentId:room.id});
  syncAwards(d,{}, {now:'2026-10-23T10:00:00Z'});
  assert.equal(d.awards.earned['first-item'].earnedAt,'2026-10-23T10:00:00Z');
  const snapshot=JSON.stringify(d.awards);assert.equal(syncAwards(d),false);assert.equal(JSON.stringify(d.awards),snapshot);
  M.remove(d,item.id);syncAwards(d);assert.equal(calculateAwards(d).find(a=>a.id==='first-item').earned,true);
  syncAwards(old,{}, {previous:d});assert.equal(calculateAwards(old).find(a=>a.id==='first-item').earned,true);
  const restored=JSON.parse(JSON.stringify(d));M.migrate(restored);M.validate(restored);syncAwards(restored);
  assert.deepEqual(restored.awards,d.awards);
  const legacy=M.createHome(seed());M.newNode(legacy,{name:'Старая вещь',parentId:legacy.nodes[0].id});
  syncAwards(legacy);assert.equal(legacy.awards.earned['first-item'].earnedAt,null);
});
test('award progress excludes archive/trash, counts ancestor storage, dates, known zero prices and real rooms',()=>{
  const d=M.createHome(seed()),room=d.nodes.find(n=>n.kind==='room');room.fill=0;
  const cabinet=M.newNode(d,{name:'Шкаф',kind:'furniture',parentId:room.id});
  const shelf=M.newNode(d,{name:'Полка',kind:'shelf',parentId:cabinet.id});
  const box=M.newNode(d,{name:'Коробка',kind:'box',parentId:shelf.id});
  const item=M.newNode(d,{name:'Вещь',parentId:box.id,purchaseCents:0,expiry:'2026-11-01'});
  const get=id=>calculateAwards(d).find(a=>a.id===id);
  assert.equal(get('storage-depth-3').met,true);assert.equal(get('rooms-fill').met,true);
  assert.equal(get('prices-10').value,1);assert.equal(get('expiry-3').value,1);
  assert.equal(get('all-placed').met,false);
  M.archive(d,item.id,{reason:'Другое',date:'2026-10-23'});assert.equal(get('prices-10').value,0);
  M.remove(d,box.id);assert.equal(get('storage-depth-3').value,0);
});
test('backups require actual successful timestamps and corrupt optional award data cannot invalidate inventory',()=>{
  const d=M.createHome(seed());d.awards={earned:['bad'],backupAt:'not a date'};
  assert.equal(calculateAwards(d,{backupCount:5}).find(a=>a.id==='first-backup').met,false);
  syncAwards(d,{lastBackupAt:'2026-10-23T10:00:00Z'});M.validate(d);
  assert.equal(calculateAwards(d).find(a=>a.id==='first-backup').earned,true);
  d.awards.earned['future-id']={earnedAt:null};syncAwards(d);assert.ok(d.awards.earned['future-id']);
  assert.equal(new Set(calculateAwards(d).map(a=>a.id)).size,18);
});


test('object categories migrate legacy models, archive and trash while preserving custom branches',()=>{
  const d=seed(),room=d.plan.rooms[0],plan=structuredClone(d.plan);
  for(const type of ['washingMachine','microwave','rug','plant','pcCase','sofa'])plan.furniture.push({id:'category-'+type,type,pos:[room.rect[0]+.5,room.rect[1]+.5]});
  M.syncPlan(d,plan);
  const cards=Object.fromEntries(['washingMachine','microwave','rug','plant','pcCase','sofa'].map(type=>[type,d.nodes.find(n=>n.furnitureId==='category-'+type)]));
  cards.washingMachine.categoryId='electronics';cards.rug.categoryId='furniture';
  d.categories.find(c=>c.id==='electronics').name='Электроника';d.categories.find(c=>c.id==='decor').name='Декор';
  d.categories.push({id:'my-appliances',name:'Моя техника',parentId:'electronics'});
  cards.microwave.categoryId='my-appliances';
  delete d.settings.objectCategoriesVersion;
  M.archive(d,cards.washingMachine.id,{reason:'Продано',date:'2026-10-24'});
  M.remove(d,cards.plant.id);
  const trash=d.trash.at(-1).nodes.find(n=>n.id===cards.plant.id);trash.categoryId='furniture';
  M.migrate(d);M.validate(d);
  assert.equal(cards.washingMachine.categoryId,'appliances');
  assert.equal(cards.rug.categoryId,'decor');assert.equal(trash.categoryId,'decor');
  assert.equal(cards.pcCase.categoryId,'electronics');assert.equal(cards.sofa.categoryId,'furniture');
  assert.equal(cards.microwave.categoryId,'my-appliances');
  assert.equal(d.categories.find(c=>c.id==='electronics').name,'Домашняя электроника');
  assert.equal(d.categories.find(c=>c.id==='decor').name,'Уют');
  assert.equal(d.categories.find(c=>c.id==='appliances').parentId,null);
  const before=structuredClone(d);M.migrate(d);assert.deepEqual(d,before);
});

test('legacy appliance category retains its ID, items and children as a separate root',()=>{
  const d=seed();d.categories=d.categories.filter(c=>c.id!=='appliances');
  for(const n of d.nodes)if(n.categoryId==='appliances')n.categoryId='legacy-appliances';
  d.categories.push({id:'legacy-appliances',name:'Бытовая техника',parentId:'electronics'});
  d.categories.push({id:'legacy-kitchen',name:'Для кухни',parentId:'legacy-appliances'});
  const n=M.newNode(d,{name:'Чайник',parentId:M.UNPLACED_ID,categoryId:'legacy-appliances'});
  delete d.settings.objectCategoriesVersion;M.migrate(d);M.validate(d);
  assert.equal(d.categories.find(c=>c.id==='legacy-appliances').parentId,null);
  assert.equal(d.categories.find(c=>c.id==='legacy-kitchen').parentId,'legacy-appliances');
  assert.equal(n.categoryId,'legacy-appliances');
  assert.equal(d.categories.filter(c=>c.name==='Бытовая техника').length,1);
});
