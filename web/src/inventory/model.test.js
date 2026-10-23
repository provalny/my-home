import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from './model.js';
const seed=()=>M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8')));
const find=(d,name)=>d.nodes.find(n=>n.name===name);

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
  const d=seed();const shelf=find(d,'Полка 1'),drawer=find(d,'Выдвижной ящик');M.reorder(d,drawer.id,shelf.id);
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
