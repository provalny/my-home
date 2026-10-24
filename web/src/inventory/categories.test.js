import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from './model.js';
import { planCategoryRemoval, removeCategories } from './categories.js';
import { createActionHistory } from './action-history.js';
const seed=()=>M.migrate(M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8'))));

test('category deletion clears active, archived and trashed assignments without deleting possessions',()=>{
  const d=seed(),parentId=d.nodes.find(n=>n.kind==='room').id;
  const a=M.newNode(d,{name:'Книга',categoryId:'books',parentId}),b=M.newNode(d,{name:'Подаренная книга',categoryId:'books',parentId}),c=M.newNode(d,{name:'Удалённая книга',categoryId:'books',parentId});
  M.archive(d,b.id,{reason:'Подарено',date:'2026-10-24'});const entry=M.remove(d,c.id);
  const before=JSON.stringify(d),preview=planCategoryRemoval(d,['books']);
  assert.equal(preview.cleared,3);assert.equal(JSON.stringify(d),before);
  const ids=d.nodes.map(n=>n.id),events=JSON.stringify(d.events),trashIds=d.trash.map(e=>e.id);
  assert.deepEqual(removeCategories(d,['books']),{removed:1,cleared:3,reparented:0});
  assert.deepEqual(d.nodes.map(n=>n.id),ids);assert.deepEqual(d.trash.map(e=>e.id),trashIds);assert.equal(JSON.stringify(d.events),events);
  assert.equal(a.categoryId,'');assert.equal(b.categoryId,'');assert.equal(entry.nodes[0].categoryId,'');M.validate(d);
  M.recover(d,entry.id,parentId);M.restore(d,b.id,parentId);M.validate(d);
  assert.equal(M.getNode(d,c.id).categoryId,'');
});
test('only checked categories disappear; remaining children use nearest surviving parent',()=>{
  const d=seed();d.categories.push({id:'root',name:'Корень'},{id:'a',name:'A',parentId:'root'},{id:'b',name:'B',parentId:'a'},{id:'c',name:'C',parentId:'b'},{id:'other-child',name:'Другое',parentId:'root'});
  removeCategories(d,['a','b']);
  assert.equal(d.categories.find(c=>c.id==='c').parentId,'root');
  assert.equal(d.categories.find(c=>c.id==='other-child').parentId,'root');
  removeCategories(d,['root']);assert.equal(d.categories.find(c=>c.id==='c').parentId,null);assert.equal(d.categories.find(c=>c.id==='other-child').parentId,null);M.validate(d);
});
test('invalid or empty category selections reject before any changes',()=>{
  const d=seed(),before=JSON.stringify(d);
  for(const ids of [[],['missing'],['books','missing']])assert.throws(()=>removeCategories(d,ids),/Выберите/);
  assert.equal(JSON.stringify(d),before);
  assert.equal(removeCategories(d,['books','books']).removed,1);M.validate(d);
});
test('deletion survives migration and plan synchronization; an empty category list is valid',()=>{
  const d=seed();removeCategories(d,d.categories.map(c=>c.id));
  M.validate(d);const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.syncPlan(copy,structuredClone(copy.plan));M.validate(copy);
  assert.deepEqual(copy.categories,[]);assert.ok(copy.nodes.every(n=>!n.categoryId));
  const plan=structuredClone(copy.plan),room=plan.rooms[0];plan.furniture.push({id:'new-uncategorized-sofa',type:'sofa',pos:[room.rect[0]+1,room.rect[1]+1]});
  M.syncPlan(copy,plan);M.validate(copy);assert.deepEqual(copy.categories,[]);assert.equal(copy.nodes.find(n=>n.furnitureId==='new-uncategorized-sofa').categoryId,'');
});
test('one undo restores categories, hierarchy and every assignment, redo removes them again',()=>{
  const before=seed(),next=structuredClone(before),history=createActionHistory();
  const ids=before.categories.filter(c=>c.id==='clothes'||c.parentId==='clothes').map(c=>c.id);
  removeCategories(next,ids);M.validate(next);history.record(before,{label:'Удаление категорий',section:'categories'},next);
  const restored=structuredClone(next);history.applyTo(restored);history.complete(false);M.validate(restored);assert.deepEqual(restored,before);
  history.applyTo(restored,true);history.complete(true);M.validate(restored);assert.deepEqual(restored,next);
});
