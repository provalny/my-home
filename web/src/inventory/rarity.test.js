import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from './model.js';
import { RARITIES, defaultRarity, itemRarity, rarityDistribution, validateRarity } from './rarity.js';
import { inventoryExportRows } from './excel-export.js';

const seed=()=>M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8')));
test('rarity distribution counts active cards across spaces, excludes rooms, sections and archive',()=>{
  const doc={categories:[{id:'books',kind:'books'},{id:'hobby',kind:'hobby'}],nodes:[
    {id:'room',kind:'room'},{id:'shelf',kind:'shelf'},{id:'module',kind:'box',autoSection:true},
    {id:'a',kind:'item',name:'Книга',categoryId:'books',quantity:20,spaceId:'home'},
    {id:'b',kind:'item',name:'Штатив',categoryId:'hobby',spaceId:'garage'},
    {id:'c',kind:'furniture',name:'Sony',rarity:'legendary'},
    {id:'d',kind:'item',name:'Canon',rarity:'epic'},
    {id:'e',kind:'item',rarity:'poor'},
    {id:'f',kind:'item'},{id:'container',kind:'box'},
    {id:'gone',kind:'item',name:'Sony',rarity:'legendary',archived:{reason:'Подарено'}}
  ]};
  const before=JSON.stringify(doc),result=rarityDistribution(doc);
  assert.equal(result.total,6);assert.deepEqual(result.rows.map(r=>r.count),[1,1,1,1,1,1]);
  assert.ok(Math.abs(result.rows.reduce((sum,r)=>sum+r.percent,0)-100)<.00001);assert.equal(JSON.stringify(doc),before);
  const empty=rarityDistribution({categories:[],nodes:[]});assert.equal(empty.total,0);assert.ok(empty.rows.every(r=>r.count===0&&r.percent===0));
});
test('six levels; automatic rarity ignores every category, field, note and preset identity',()=>{
  assert.deepEqual(RARITIES.map(r=>r.id),['poor','common','uncommon','rare','epic','legendary']);
  const d=seed(),before=JSON.stringify(d);
  for(const categoryId of [...d.categories.map(c=>c.id),'missing','']) {
    for(const [name,expected] of [['Незнакомая вещь','common'],['Книга','uncommon'],['Штатив','rare'],['Canon','epic'],['MOZA','legendary']]) {
      const n={kind:'item',name,categoryId,fields:{Бренд:'Leica',Модель:'Audeze LCD-5'},notes:'Hasselblad'};
      assert.equal(defaultRarity(d,n),expected,name+':'+categoryId);
      assert.equal(itemRarity(d,n).id,expected);
    }
  }
  assert.equal(JSON.stringify(d),before);
  assert.equal(itemRarity(d,{kind:'room',name:'Leica'}),null);
  assert.equal(itemRarity(d,{kind:'shelf',autoSection:true,name:'Leica'}),null);
});
test('manual quality overrides automatic rules and survives removal of all matching words',()=>{
  const d=seed();
  for(const name of ['Sony A7','Без ключевых слов','Чехол для Leica']) {
    for(const rarity of RARITIES.map(r=>r.id)) {
      const n={kind:'item',name,rarity};
      assert.equal(itemRarity(d,n).id,rarity);
      assert.doesNotThrow(()=>validateRarity(n));
    }
  }
  assert.throws(()=>validateRarity({kind:'item',rarity:'artifact'}));
  assert.throws(()=>validateRarity({kind:'room',rarity:'common'}));
});
test('editor models resolve by stable type after renaming, detaching and backup restoration',()=>{
  const d=seed(),plan=structuredClone(d.plan),room=plan.rooms[0];
  const models=['macBook','simCockpitTriple','printer3dEnclosed','printer3dOpen'];
  models.forEach((type,i)=>plan.furniture.push({id:`rarity-model-${i}`,type,name:`Моя техника ${i}`,pos:[room.rect[0]+1,room.rect[1]+1]}));
  M.syncPlan(d,plan);M.validate(d);
  for(const [i,type] of models.entries()) {
    const n=d.nodes.find(n=>n.furnitureId===`rarity-model-${i}`);
    assert.equal(n.modelType,type);
    assert.equal(itemRarity(d,n).id,'epic');
    M.updateNode(d,n.id,{rarity:'epic'});
    M.detachFurniture(d,n.id);
    M.move(d,n.id,M.ensureUnplaced(d).id);
    M.updateNode(d,n.id,{rarity:null});
    assert.equal(n.furnitureId,undefined);
    assert.equal(itemRarity(d,n).id,'epic');
  }
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);
  for(const type of models)assert.equal(itemRarity(copy,copy.nodes.find(n=>n.modelType===type)).id,'epic');
  for(const type of ['simCockpit','printerCabinet','pcCase','desktopMonitor'])assert.equal(itemRarity(d,{kind:'furniture',modelType:type}).id,'common',type);
  assert.equal(itemRarity(d,{kind:'shelf',autoSection:true,modelType:'printer3dOpen'}),null);
});
test('automatic rarity follows edits and resets while explicit manual choices persist',()=>{
  const d=seed(),parentId=d.nodes.find(n=>n.kind==='room').id;
  const n=M.newNode(d,{name:'Audeze Maxwell',parentId,categoryId:'electronics'});
  assert.equal(itemRarity(d,n).id,'epic');
  M.updateNode(d,n.id,{name:'Audeze LCD-5'});assert.equal(itemRarity(d,n).id,'legendary');
  M.updateNode(d,n.id,{name:'MOZA R9'});assert.equal(itemRarity(d,n).id,'legendary');
  M.updateNode(d,n.id,{rarity:'rare'});assert.equal(itemRarity(d,n).id,'rare');
  M.updateNode(d,n.id,{rarity:null});assert.equal(itemRarity(d,n).id,'legendary');
  M.updateNode(d,n.id,{name:'Руль'});assert.equal(itemRarity(d,n).id,'common');
  M.updateNode(d,n.id,{fields:{Бренд:'Leica'}});assert.equal(itemRarity(d,n).id,'common');
  M.validate(d);
});
test('invalid manual rarity rejects atomically; legacy high choices remain valid after title-only rules',()=>{
  const d=seed(),parentId=d.nodes.find(n=>n.kind==='room').id;
  const before=JSON.stringify(d);
  assert.throws(()=>M.newNode(d,{name:'Камера',parentId,rarity:'artifact'}),/редкость/);
  assert.equal(JSON.stringify(d),before);
  const n=M.newNode(d,{name:'Камера',parentId,rarity:'legendary',fields:{Бренд:'Sony'}});
  const after=JSON.stringify(d);
  assert.throws(()=>M.updateNode(d,n.id,{name:'Nikon',rarity:'artifact'}),/редкость/);
  assert.equal(JSON.stringify(d),after);
  M.updateNode(d,n.id,{name:'Чехол',fields:{}});
  assert.equal(itemRarity(d,n).id,'legendary');
  M.updateNode(d,n.id,{rarity:null});assert.equal(itemRarity(d,n).id,'uncommon');
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);
});
test('quality survives saves, JSON migration, archive, trash and recovery',()=>{
  const d=seed(),parentId=d.nodes.find(n=>n.kind==='room').id;
  const n=M.newNode(d,{name:'Sony Alpha',parentId,rarity:'legendary'});
  const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);
  assert.equal(itemRarity(copy,M.getNode(copy,n.id)).id,'legendary');
  M.archive(copy,n.id,{reason:'Подарено',date:'2026-10-24'});
  assert.equal(itemRarity(copy,M.getNode(copy,n.id)).id,'legendary');
  M.restore(copy,n.id,parentId);
  M.remove(copy,n.id);
  const entry=copy.trash.find(e=>e.rootId===n.id);
  assert.equal(entry.nodes.find(x=>x.id===n.id).rarity,'legendary');
  M.recover(copy,entry.id,parentId);
  assert.equal(M.getNode(copy,n.id).rarity,'legendary');M.validate(copy);
});
test('Excel includes resolved rarity without changing the inventory',()=>{
  const d=seed(),parentId=d.nodes.find(n=>n.kind==='room').id;
  M.newNode(d,{name:'Canon Excel',parentId,rarity:'epic'});
  M.newNode(d,{name:'MOZA Excel',parentId});
  M.newNode(d,{name:'Audeze LCD-5 Excel',parentId});
  M.newNode(d,{name:'Audeze Maxwell Excel',parentId});
  M.newNode(d,{name:'Книга Excel',parentId,categoryId:'books'});
  M.newNode(d,{name:'Audeze CRBN2 Excel',parentId});
  M.newNode(d,{name:'Штатив Gitzo Excel',parentId});
  M.newNode(d,{name:'Тумбочка под 3D-принтер Excel',parentId});
  const before=JSON.stringify(d),data=inventoryExportRows(d),column=data.headers.indexOf('Редкость');
  assert.ok(column>=0);
  assert.equal(data.active.find(row=>row[0]==='Canon Excel')[column],'Эпический');
  assert.equal(data.active.find(row=>row[0]==='MOZA Excel')[column],'Легендарный');
  assert.equal(data.active.find(row=>row[0]==='Audeze LCD-5 Excel')[column],'Легендарный');
  assert.equal(data.active.find(row=>row[0]==='Audeze Maxwell Excel')[column],'Эпический');
  assert.equal(data.active.find(row=>row[0]==='Книга Excel')[column],'Необычный');
  assert.equal(data.active.find(row=>row[0]==='Audeze CRBN2 Excel')[column],'Легендарный');
  assert.equal(data.active.find(row=>row[0]==='Штатив Gitzo Excel')[column],'Эпический');
  assert.equal(data.active.find(row=>row[0]==='Тумбочка под 3D-принтер Excel')[column],'Обычный');
  assert.equal(JSON.stringify(d),before);
});
