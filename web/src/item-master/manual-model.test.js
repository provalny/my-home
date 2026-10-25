import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createActionHistory} from '../inventory/action-history.js';
import {manualValue,missingFields,manualItems,planManualChanges,applyManualChanges,manualField,availableManualFields} from './manual-model.js';
const node=(id='a',fields={})=>({id,kind:'item',name:'Вещь '+id,parentId:'room:unplaced',quantity:3,fields});
const complete=()=>({'Артикул производителя':'MPN','Цвет':'Синий','Вес, г':'700','Транспортный объём, л':'2'});
const plan=(n,values)=>({id:n.id,fields:planManualChanges(n,values)});
test('manual scope includes checked items with any missing field, and supports completely blank or field-specific filters',()=>{
  const d={nodes:[node('empty'),node('partial',{'Вес, г':'10'}),{...node('full',complete()),purchaseCents:20000},{...node('checked'),itemResearch:{checkedAt:'2026-10-25'}},{...node('archived'),archived:{}},{...node('room'),kind:'room'},{...node('built'),kind:'furniture',autoSection:true}]};
  assert.deepEqual(manualItems(d).map(n=>n.id),['empty','partial','checked']);
  assert.deepEqual(manualItems(d,{filter:'empty',columns:['weightGrams']}).map(n=>n.id),['empty','checked']);
  assert.deepEqual(manualItems(d,{filter:'weightGrams',query:'partial'}),[]);
  assert.equal(manualItems(d,{filter:'all'}).length,4);
});
test('explicit zero and legacy weights count as entered; furniture estimates and invalid volumes need clarification',()=>{
  assert.equal(manualValue(node('x',{'Вес, кг':'1,25'}),'weightGrams'),'1250');
  assert.ok(!missingFields(node('x',{'Вес, г':'0'})).includes('weightGrams'));
  const estimated={...node('x',{'Вес, г':'25000'}),kind:'furniture',weightEstimate:{grams:25000}};
  assert.ok(missingFields(estimated).includes('weightGrams'));
  for(const volume of ['0','abc','-2',''])assert.ok(missingFields(node('x',{'Транспортный объём, л':volume})).includes('transportLiters'));
});
test('batch manual edits rename ordinary items and preserve identity, quantity, location, other fields and completed search history',()=>{
  const a=node('a',{'Вес, г':'700','Цвет':'Синий'}),b={...node('b',{'Вес, г':'25000'}),kind:'furniture',weightEstimate:{grams:25000}};
  a.itemResearch={checkedAt:'2026-10-25T00:00:00Z',status:'not_found',candidates:[]};
  const history=structuredClone(a.itemResearch),d={nodes:[a,b]};
  applyManualChanges(d,[plan(a,{name:'Новое имя',mpn:'A-1',transportLiters:'1,25'}),plan(b,{weightGrams:'25000'})]);
  assert.equal(a.fields['Вес, г'],'700');assert.equal(a.fields['Цвет'],'Синий');assert.equal(a.fields['Транспортный объём, л'],'1.25');assert.equal(a.name,'Новое имя');assert.equal(a.quantity,3);assert.equal(a.parentId,'room:unplaced');assert.deepEqual(a.itemResearch,history);assert.equal(b.weightEstimate,undefined);
});
test('manual numeric errors, unknown fields, changed and archived items never partially apply a batch',()=>{
  const a=node('a'),b=node('b'),d={nodes:[a,b]};
  for(const values of [{weightGrams:'-1'},{weightGrams:'500 g'},{transportLiters:'0'},{mpn:'x'.repeat(201)},{name:''}])assert.throws(()=>plan(a,values));
  const plans=[plan(a,{mpn:'A'}),plan(b,{mpn:'B'})];b.fields['Артикул производителя']='new';const before=structuredClone(d);
  assert.throws(()=>applyManualChanges(d,plans),/изменились/);assert.deepEqual(d,before);
  delete b.fields['Артикул производителя'];b.archived={};assert.throws(()=>applyManualChanges(d,plans),/архиве/);assert.equal(a.fields['Артикул производителя'],undefined);
});
test('undo of manual filling restores values and keeps the search completion marker',()=>{
  const n=node();n.itemResearch={checkedAt:'2026-10-25T00:00:00Z',status:'not_found',candidates:[]};const d={nodes:[n]},before=structuredClone(d),history=createActionHistory();
  applyManualChanges(d,[plan(n,{mpn:'NEW',weightGrams:'550'})]);history.record(before,{label:'Ручные параметры'},d);
  history.applyTo(d,false);history.complete(false);assert.deepEqual(d,before);
});
test('overriding a searched fact removes its applied provenance without resetting checked history',()=>{
  const n=node('x',{'Артикул производителя':'AUTO'});n.itemResearch={checkedAt:'2026-10-25',appliedCandidateId:'auto',applied:{mpn:{value:'AUTO'}}};
  applyManualChanges({nodes:[n]},[plan(n,{mpn:'MANUAL'})]);assert.equal(n.itemResearch.checkedAt,'2026-10-25');assert.equal(n.itemResearch.applied.mpn,undefined);assert.equal(n.itemResearch.appliedCandidateId,undefined);
});

test('selected columns determine missing parameters; zero price is filled and hidden fields do not affect filtering',()=>{
  const a={...node('a',{'Цвет':'Синий'}),purchaseCents:0},b=node('b',{'Цвет':'Красный'}),d={nodes:[a,b]};
  assert.deepEqual(manualItems(d,{columns:['color']}).map(n=>n.id),[]);
  assert.deepEqual(manualItems(d,{columns:['purchaseCents']}).map(n=>n.id),['b']);
  assert.deepEqual(manualItems(d,{columns:['color','purchaseCents'],filter:'purchaseCents'}).map(n=>n.id),['b']);
  assert.equal(manualValue(a,'purchaseCents'),'0.00');
});
test('price and custom fields use the ordinary card, price history and undo',()=>{
  const n=node('x',{'Объём, л':'3','Артикул':'OLD'}),d={nodes:[n],events:[]},before=structuredClone(d),h=createActionHistory();
  applyManualChanges(d,[plan(n,{name:'Обновлённое имя',color:'Зелёный',purchaseCents:'1 234,56',transportLiters:'4',mpn:'NEW','attr:Сезон':'Лето'})]);
  assert.equal(n.name,'Обновлённое имя');assert.equal(n.purchaseCents,123456);assert.equal(n.fields['Цвет'],'Зелёный');assert.equal(n.fields['Сезон'],'Лето');assert.equal(n.fields['Объём, л'],'4');assert.equal(n.fields['Транспортный объём, л'],undefined);assert.equal(n.fields['Артикул'],'NEW');assert.equal(n.fields['Цена'],undefined);assert.equal(d.events.length,1);assert.equal(d.events[0].type,'value');
  h.record(before,{label:'Изменения'},d);h.applyTo(d,false);h.complete(false);assert.deepEqual(d,before);
});
test('field chooser supports category and existing custom fields but excludes official-name and unsafe keys',()=>{
  const d={nodes:[node('x',{'Сезон':'Лето','Официальное название':'old'})]};
  const fields=availableManualFields(d);assert.ok(fields.some(f=>f.label==='Автор'));assert.ok(fields.some(f=>f.label==='Сезон'));assert.ok(!fields.some(f=>f.label==='Официальное название'));
  assert.equal(manualField('attr:__proto__'),null);assert.equal(manualField('officialName'),null);
});
