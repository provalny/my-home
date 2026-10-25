import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from './model.js';
import { planCategoryRemoval, removeCategories, planCategoryMove, moveCategory, placeCategory, setCategoryIcon, CATEGORY_ICONS } from './categories.js';
import { createActionHistory } from './action-history.js';
import { categoryAppearance, nodeAppearance, rememberCategoryIcons } from './appearance.js';
import { applyCategoryPacks } from './category-presets.js';
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

test('moving a category carries its complete subtree and keeps every item, archive and trash assignment',()=>{
  const d=seed();d.categories.push({id:'move-root',name:'Поездки',parentId:null},{id:'move-child',name:'Оптика',parentId:'move-root'},{id:'move-leaf',name:'Объективы',parentId:'move-child'});
  const parentId=M.UNPLACED_ID;
  const a=M.newNode(d,{name:'Объектив в учёте',categoryId:'move-leaf',parentId,fields:{Модель:'24–70'}}),b=M.newNode(d,{name:'Архив',categoryId:'move-child',parentId}),c=M.newNode(d,{name:'Корзина',categoryId:'move-root',parentId});
  M.archive(d,b.id,{reason:'Подарено',date:'2026-10-24'});M.remove(d,c.id);
  const before=structuredClone(d);assert.equal(planCategoryMove(d,'move-root','electronics').changed,true);assert.deepEqual(d,before);
  moveCategory(d,'move-root','electronics');M.validate(d);
  assert.equal(d.categories.find(c=>c.id==='move-leaf').parentId,'move-child');
  assert.equal(M.categoryName(d,'move-leaf'),'Домашняя электроника / Поездки / Оптика / Объективы');
  assert.ok(M.search(d,'Домашняя электроника Поездки').some(n=>n.id===a.id));
  for(const key of ['nodes','trash','events','plan','spaces'])assert.deepEqual(d[key],before[key]);
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);assert.equal(copy.categories.find(c=>c.id==='move-root').parentId,'electronics');
  moveCategory(copy,'move-root',null);M.validate(copy);assert.equal(M.categoryName(copy,'move-leaf'),'Поездки / Оптика / Объективы');
});

test('moving rejects cycles, missing categories and invalid destinations without changes; same-parent drops are no-ops',()=>{
  const d=seed();d.categories.push({id:'a',name:'A',parentId:'books'},{id:'b',name:'B',parentId:'a'},{id:'c',name:'C',parentId:'b'});
  const before=structuredClone(d);
  for(const [id,parent] of [['a','a'],['a','c'],['books','c'],['missing',null],['a','missing'],['a','']])assert.throws(()=>moveCategory(d,id,parent));
  assert.deepEqual(d,before);assert.equal(moveCategory(d,'a','books').changed,false);assert.deepEqual(d,before);
  moveCategory(d,'c','tools');moveCategory(d,'a',null);M.validate(d);
  assert.equal(M.categoryName(d,'b'),'A / B');assert.equal(M.categoryName(d,'c'),'Инструменты / C');
});

test('drag placement reorders siblings and can nest a category without losing item assignments',()=>{
  const d=seed(),item=M.newNode(d,{name:'Книга',parentId:M.UNPLACED_ID,categoryId:'books'});
  placeCategory(d,'books','tools','before');
  const roots=d.categories.filter(c=>!c.parentId).sort((a,b)=>(a.order??Number.MAX_SAFE_INTEGER)-(b.order??Number.MAX_SAFE_INTEGER)||a.name.localeCompare(b.name,'ru'));
  assert.ok(roots.findIndex(c=>c.id==='books')<roots.findIndex(c=>c.id==='tools'));
  placeCategory(d,'books','tools','inside');
  assert.equal(d.categories.find(c=>c.id==='books').parentId,'tools');
  assert.equal(item.categoryId,'books');M.validate(d);
  assert.throws(()=>placeCategory(d,'tools','books','inside'),/Нельзя/);
});

test('chosen icons update inheritance, own overrides and items; reset and invalid choices are safe',()=>{
  const d=seed();d.categories.push({id:'icon-child',name:'Без своего значка',parentId:'hobby'},{id:'icon-own',name:'Свой значок',parentId:'hobby',icon:'book'});
  const n=M.newNode(d,{name:'Предмет',categoryId:'icon-child',parentId:M.UNPLACED_ID}),beforeNodes=structuredClone(d.nodes);
  setCategoryIcon(d,'hobby','camera');M.validate(d);
  assert.equal(categoryAppearance(d,'icon-child').glyph,'camera');assert.equal(nodeAppearance(d,n).glyph,'camera');
  assert.equal(categoryAppearance(d,'icon-own').glyph,'book');assert.deepEqual(d.nodes,beforeNodes);
  setCategoryIcon(d,'icon-child','sport');assert.equal(nodeAppearance(d,n).glyph,'sport');
  setCategoryIcon(d,'icon-child',null);rememberCategoryIcons(d);assert.equal(nodeAppearance(d,n).glyph,'camera');
  const before=structuredClone(d);for(const [id,glyph] of [['missing','camera'],['hobby','invalid'],['hobby','']])assert.throws(()=>setCategoryIcon(d,id,glyph));assert.deepEqual(d,before);
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);assert.equal(nodeAppearance(copy,M.getNode(copy,n.id)).glyph,'camera');
  assert.equal(new Set(CATEGORY_ICONS.map(([id])=>id)).size,CATEGORY_ICONS.length);
});

test('preset reapplication preserves manually moved categories and chosen icons',()=>{
  const d=seed();applyCategoryPacks(d,['hobby-photo']);
  const photo=d.categories.find(c=>c.presetKey==='electronics.photo');
  moveCategory(d,photo.id,'hobby');setCategoryIcon(d,photo.id,'trophy');
  const before=structuredClone(d);assert.deepEqual(applyCategoryPacks(d,['hobby-photo']),{addedCategories:0,addedCollections:0});M.validate(d);assert.deepEqual(d,before);
});

test('category moves and icon changes undo and redo independently without touching item data',()=>{
  const before=seed(),moved=structuredClone(before);moveCategory(moved,'books','hobby');
  const changed=structuredClone(moved);setCategoryIcon(changed,'books','camera');M.validate(changed);
  const history=createActionHistory();history.record(before,{label:'Перенос',section:'categories'},moved);history.record(moved,{label:'Значок',section:'categories'},changed);
  const current=structuredClone(changed);
  for(const [redo,expected] of [[false,moved],[false,before],[true,moved],[true,changed]]){history.applyTo(current,redo);history.complete(redo);M.validate(current);assert.deepEqual(current,expected);}
});
