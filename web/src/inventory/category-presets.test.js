import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from './model.js';
import { CATEGORY_PACKS, PRESET_CATEGORIES, previewCategoryPacks, applyCategoryPacks, itemCollections } from './category-presets.js';
import { createActionHistory } from './action-history.js';

const seed=()=>M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8')));
const photo=['work-photo','hobby-photo'];

test('every pack combines into one valid tree; preview never changes existing data',()=>{
  const d=seed(),before=structuredClone(d),packs=CATEGORY_PACKS.map(p=>p.id);
  const preview=previewCategoryPacks(d,packs);
  assert.deepEqual(d,before);
  assert.equal(new Set(preview.categories.map(c=>c.key)).size,PRESET_CATEGORIES.length);
  applyCategoryPacks(d,packs);M.validate(d);
  assert.equal(d.categories.filter(c=>c.name==='Бытовая техника').length,1);
  assert.deepEqual(d.nodes,before.nodes);assert.deepEqual(d.plan,before.plan);
  assert.deepEqual(d.events,before.events);
  const saved=structuredClone(d);
  assert.deepEqual(applyCategoryPacks(d,packs),{addedCategories:0,addedCollections:0});
  assert.deepEqual(d,saved);
});

test('general shoes and power tools reuse their parents without duplicate branches',()=>{
  const d=seed(),packs=['common-shoes','common-power-tools','common-clothes','common-electronics'];
  const preview=previewCategoryPacks(d,packs);
  assert.equal(new Set(preview.categories.map(c=>c.key)).size,preview.categories.length);
  assert.ok(preview.categories.some(c=>c.path.endsWith('Обувь / Кроссовки')));
  assert.ok(preview.categories.some(c=>c.path.endsWith('Электроинструменты / Шуруповёрты')));
  applyCategoryPacks(d,packs);M.validate(d);
  const saved=structuredClone(d);
  assert.deepEqual(applyCategoryPacks(d,packs),{addedCategories:0,addedCollections:0});
  assert.deepEqual(d,saved);
});

test('work and hobby photography reuse shared branches, legacy siblings, and collections after renaming',()=>{
  const d=seed(),computers=d.categories.find(c=>c.name==='Компьютеры');
  applyCategoryPacks(d,['work-it',...photo]);
  assert.equal(d.categories.filter(c=>c.presetKey==='electronics.computers').length,1);
  assert.equal(d.categories.find(c=>c.presetKey==='electronics.computers').id,computers.id);
  const camera=d.categories.find(c=>c.presetKey==='electronics.photo.cameras');camera.name='Мои камеры';
  const root=d.categories.find(c=>c.id==='electronics');root.name='Моя техника';
  const collection=d.collections.find(c=>c.presetKey==='photography');collection.name='Съёмки';
  const saved=structuredClone(d);
  assert.deepEqual(applyCategoryPacks(d,['work-it',...photo]),{addedCategories:0,addedCollections:0});
  assert.deepEqual(d,saved);
  assert.equal(d.collections.length,2);
  assert.ok(previewCategoryPacks(d,photo).categories.find(c=>c.key===camera.presetKey).path.includes('Моя техника'));
});

test('same named categories under other parents are left alone; reserved ID collisions are safe',()=>{
  const d=seed();d.categories.push({id:'custom-cameras',name:'Камеры',parentId:'tools'});
  d.categories=d.categories.filter(c=>c.id!=='appliances');
  d.categories.push({id:'appliances',name:'Пользовательская ветка',parentId:'tools'});
  const old=structuredClone(d.categories);
  applyCategoryPacks(d,[...photo,'base-kitchen']);M.validate(d);
  assert.equal(d.categories.find(c=>c.presetKey==='electronics.photo.cameras').parentId,d.categories.find(c=>c.presetKey==='electronics.photo').id);
  assert.notEqual(d.categories.find(c=>c.presetKey==='appliances').id,'appliances');
  for(const c of old)assert.equal(d.categories.find(x=>x.id===c.id).name,c.name);
});

test('preview exclusions omit a whole new branch, persist choices, and reject orphans without mutation',()=>{
  const d=seed(),packs=['hobby-photo','hobby-hiking'];
  const preview=previewCategoryPacks(d,packs),excluded=preview.categories.filter(c=>c.key==='electronics.photo'||c.key.startsWith('electronics.photo.')).map(c=>c.key);
  const before=structuredClone(d);
  assert.throws(()=>applyCategoryPacks(d,packs,{excludedCategories:['electronics.photo']}),/родительские/);
  assert.deepEqual(d,before);
  applyCategoryPacks(d,packs,{excludedCategories:excluded,excludedCollections:['photography']});M.validate(d);
  assert.ok(!d.categories.some(c=>c.presetKey?.startsWith('electronics.photo')));
  assert.ok(!d.collections.some(c=>c.presetKey==='photography'));
  assert.deepEqual(d.settings.categorySetup.excludedCategories,excluded);
  assert.ok(d.collections.some(c=>c.presetKey==='hiking'));
});

test('collections follow items through search, backup, archive, trash, recovery and new-home creation',()=>{
  const d=seed();applyCategoryPacks(d,['hobby-photo','hobby-hiking']);
  const n=d.nodes.find(n=>n.name==='MacBook'),ids=d.collections.map(c=>c.id),originalCategory=n.categoryId;
  M.updateNode(d,n.id,{collectionIds:ids});M.validate(d);
  assert.equal(n.categoryId,originalCategory);assert.equal(itemCollections(d,n).length,2);
  assert.ok(M.search(d,'Походы').some(x=>x.id===n.id));
  M.archive(d,n.id,{reason:'Продано',date:'2026-10-24'});
  assert.ok(M.search(d,'Фотография',true).some(x=>x.id===n.id));
  M.restore(d,n.id,M.UNPLACED_ID);M.remove(d,n.id);
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);
  assert.deepEqual(copy.trash.at(-1).nodes.find(x=>x.id===n.id).collectionIds,ids);
  M.recover(copy,copy.trash.at(-1).id,M.UNPLACED_ID);M.validate(copy);
  assert.deepEqual(M.getNode(copy,n.id).collectionIds,ids);
  const home=M.createHome(copy);M.validate(home);
  assert.deepEqual(home.collections,copy.collections);assert.deepEqual(home.settings.categorySetup,copy.settings.categorySetup);
});

test('legacy copies need no collection migration; malformed collections and memberships are rejected',()=>{
  const d=seed();M.validate(d);
  applyCategoryPacks(d,photo);
  for(const modify of [
    x=>x.collections.push({...x.collections[0]}),
    x=>x.collections[0].name=' ',
    x=>x.collections={},
    x=>x.settings.categorySetup.packIds=3,
    x=>x.settings.categorySetup.status='invalid',
    x=>x.nodes.find(n=>n.kind==='item').collectionIds=['missing'],
    x=>x.nodes.find(n=>n.kind==='item').collectionIds=[x.collections[0].id,x.collections[0].id],
  ]){const bad=structuredClone(d);modify(bad);assert.throws(()=>M.validate(bad));}
});

test('the whole setup and item memberships participate in one undo/redo history',()=>{
  let d=seed();const before=structuredClone(d),history=createActionHistory();
  applyCategoryPacks(d,photo);history.record(before,{label:'Настройка категорий',section:'categories'},d);
  const configured=structuredClone(d);
  M.updateNode(d,d.nodes.find(n=>n.kind==='item').id,{collectionIds:d.collections.map(c=>c.id)});
  history.record(configured,{label:'Подборки вещи',section:'catalog'},d);
  for(const [redo,expected] of [[false,configured],[false,before],[true,configured]]){
    const next=history.applyTo(structuredClone(d),redo);history.complete(redo);d=next;M.validate(d);assert.deepEqual(d,expected);
  }
});
