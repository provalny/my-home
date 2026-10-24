import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from './model.js';
import { createInventoryWorkbook, inventoryExportRows } from './excel-export.js';
import { isSection } from './ikea-storage.js';
const seed=()=>M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8')));
test('Excel export contains all spaces, preserves both numeric prices, archive and custom fields without changing the document',()=>{
  const d=seed(),spaceId=M.addSpace(d,{name:'Гараж',type:'garage'}),room=d.nodes.find(n=>n.spaceId===spaceId),item=M.newNode(d,{name:'=HYPERLINK("bad") & <ключ>',parentId:room.id,purchaseCents:12345,currentCents:0,fields:{'Серийный номер':'0000123'}}),belt=d.nodes.find(n=>n.name==='Ремень');
  M.archive(d,belt.id,{reason:'Продано',date:'2026-10-24',saleCents:5000});const snapshot=JSON.stringify(d),rows=inventoryExportRows(d),column=name=>rows.headers.indexOf(name),own=rows.active.find(row=>row[0]===item.name);
  assert.equal(own[column('Пространство')],'Гараж');assert.equal(own[column('Цена покупки, ₽')].value,123.45);assert.equal(own[column('Текущая оценка, ₽')].value,0);assert.equal(own[column('Серийный номер')],'0000123');assert.equal(rows.archive.length,1);
  assert.equal(rows.active.length+rows.archive.length,d.nodes.filter(n=>n.kind!=='room'&&!isSection(n)).length);
  const bytes=createInventoryWorkbook(d),content=new TextDecoder().decode(bytes);assert.deepEqual([...bytes.slice(0,4)],[80,75,3,4]);assert.ok(content.includes('&amp; &lt;ключ&gt;'));assert.ok(!content.includes('<f>'));assert.ok(content.includes('pane ySplit="1"'));assert.equal(JSON.stringify(d),snapshot);
});
test('bulk deletion validates the whole selection and removes overlapping selections only once',()=>{
  const d=seed(),wardrobe=d.nodes.find(n=>n.name==='Шкаф в спальне'),shirt=d.nodes.find(n=>n.name==='Футболка Nike'),before=JSON.stringify(d);
  assert.throws(()=>M.removeMany(d,[shirt.id,'missing']));assert.equal(JSON.stringify(d),before);
  const entries=M.removeMany(d,[shirt.id,wardrobe.id,shirt.id]);assert.equal(entries.length,1);assert.equal(M.getNode(d,shirt.id),undefined);M.validate(d);M.recover(d,entries[0].id,wardrobe.parentId);M.validate(d);assert.ok(M.getNode(d,shirt.id));
});
test('bulk preservation saves unselected possessions but still deletes explicitly selected children',()=>{
  const d=seed(),wardrobe=d.nodes.find(n=>n.name==='Шкаф в спальне'),shirt=d.nodes.find(n=>n.name==='Футболка Nike'),hoodie=d.nodes.find(n=>n.name==='Худи');
  M.removeMany(d,[shirt.id,wardrobe.id],{together:false});assert.equal(M.getNode(d,shirt.id),undefined);assert.equal(hoodie.parentId,M.UNPLACED_ID);assert.ok(M.children(d,M.UNPLACED_ID).every(n=>!isSection(n)));M.validate(d);
});
