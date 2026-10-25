import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as M from './model.js';
import {createActionHistory} from '../inventory/action-history.js';
import {itemVolumeLiters} from '../travel/model.js';
const node=()=>({id:'one',name:'Мой рюкзак',kind:'item',parentId:'room:unplaced',fields:{'Вес, г':'700'},quantity:2});
const candidate=()=>({id:'product-1',url:'https://example.com/product',title:'Рюкзак Example 20',sourceKind:'store',fields:{officialName:{value:'Рюкзак Example 20',source:'https://example.com/product',basis:'Название'},mpn:{value:'EX-20',source:'https://example.com/product',basis:'MPN'},weightGrams:{value:650,source:'https://example.com/product',basis:'Вес предмета'},transportLiters:{value:4,source:'https://example.com/product',basis:'В сложенном виде'}}});
function ready(){const n=node(),d={nodes:[n]};M.saveResult(d,n.id,{candidates:[candidate()]},M.fingerprint(n));M.chooseCandidate(d,n.id,'product-1');return d;}
test('scope includes belongings and unplaced, excludes archived, rooms and built-in sections',()=>{
  const d={nodes:['item','box','furniture','room','shelf','drawer','compartment'].map((kind,i)=>({...node(),kind,id:String(i)}))};
  d.nodes.push({...node(),id:'archived',archived:{}},{...node(),id:'section',autoSection:true},{...node(),id:'module',kind:'furniture',kitchenModule:'module'});
  assert.deepEqual(M.items(d).map(n=>n.kind),['item','box','furniture']);
});
test('only permitted data leaves a card',()=>{const n={...node(),photo:'secret',notes:'secret',fields:{'Бренд':'Example','Модель':'X','Место':'secret','Серийный номер':'secret'}};assert.deepEqual(M.searchInput(n),{name:'Мой рюкзак',brand:'Example',model:'X'});});
test('no-result and partial searches stay excluded after restart, rename and move',()=>{
  for(const candidates of [[],[candidate()]]){let d={nodes:[node()]};M.saveResult(d,'one',{candidates},M.fingerprint(d.nodes[0]));d=JSON.parse(JSON.stringify(d));d.nodes[0].name='Новое имя';d.nodes[0].parentId='car';assert.equal(M.pending(d).length,0);M.validateResearch(d);}
});
test('errors do not mark unchecked items as checked and preserve prior successful results',()=>{
  const d={nodes:[node()]};M.saveError(d,'one','Недоступно');assert.equal(M.pending(d).length,1);M.saveResult(d,'one',{candidates:[]},M.fingerprint(d.nodes[0]));const before=structuredClone(d.nodes[0].itemResearch);M.saveError(d,'one','Ошибка повторного поиска');assert.deepEqual(d.nodes[0].itemResearch,before);assert.equal(M.pending(d).length,0);
});
test('search results reject stale identity and removed/archived items',()=>{const d={nodes:[node()]},fp=M.fingerprint(d.nodes[0]);d.nodes[0].name='Другой товар';assert.throws(()=>M.saveResult(d,'one',{candidates:[]},fp));d.nodes[0].archived={};assert.throws(()=>M.saveResult(d,'one',{candidates:[]},M.fingerprint(d.nodes[0])));});
test('applying selected facts preserves name, manual weight, quantity and location; undo preserves checked marker',()=>{
  const d=ready(),n=d.nodes[0],before=structuredClone(d),h=createActionHistory();
  M.applyChanges(d,[{id:n.id,candidateId:n.itemResearch.chosen,checkedAt:n.itemResearch.checkedAt,fields:M.planChanges(n,['mpn','transportLiters'])}]);
  assert.equal(n.name,'Мой рюкзак');assert.equal(n.fields['Вес, г'],'700');assert.equal(n.quantity,2);assert.equal(n.parentId,'room:unplaced');assert.equal(n.fields['Транспортный объём, л'],'4');
  h.record(before,{label:'Применение',section:'item-master'},d);h.applyTo(d);assert.deepEqual(d,before);assert.equal(M.pending(d).length,0);
});
test('manual weight is replaceable only when explicitly selected; estimates are removed',()=>{
  const d=ready(),n=d.nodes[0];n.weightKg=.7;n.fields['Вес, кг']='0.7';n.weightEstimate={grams:700};M.applyChanges(d,[{id:n.id,candidateId:n.itemResearch.chosen,checkedAt:n.itemResearch.checkedAt,fields:M.planChanges(n,['weightGrams'])}]);
  assert.equal(n.fields['Вес, г'],'650');assert.equal(n.fields['Вес, кг'],undefined);assert.equal(n.weightEstimate,undefined);assert.equal(n.weightKg,undefined);
});
test('batch application is atomic when a card changes after comparison',()=>{
  const d=ready(),n=d.nodes[0],plan={id:n.id,candidateId:n.itemResearch.chosen,checkedAt:n.itemResearch.checkedAt,fields:M.planChanges(n,['mpn','weightGrams'])};n.fields['Вес, г']='900';assert.throws(()=>M.applyChanges(d,[plan]));assert.equal(n.fields['Артикул производителя'],undefined);
});
test('unsafe URLs, invented fields and malformed candidates cannot enter saved results',()=>{
  for(const url of ['file:///etc/passwd','http://example.com','https://user:secret@example.com','https://127.0.0.1','https://[::1]','https://device.local'])assert.equal(M.safeURL(url),null);
  const d={nodes:[node()]},bad=candidate();bad.fields.sku={value:'x',source:bad.url,basis:'sku'};assert.throws(()=>M.saveResult(d,'one',{candidates:[bad]},M.fingerprint(d.nodes[0])));
});
test('batch applies facts to multiple chosen items, keeping their checked records and distinct manual weights',()=>{
  const d=ready(),two=structuredClone(d.nodes[0]);two.id='two';two.fields['Вес, г']='800';d.nodes.push(two);
  const plans=d.nodes.map(n=>({id:n.id,candidateId:n.itemResearch.chosen,checkedAt:n.itemResearch.checkedAt,fields:M.planChanges(n,['mpn','transportLiters'])}));M.applyChanges(d,plans);
  assert.deepEqual(d.nodes.map(n=>n.fields['Вес, г']),['700','800']);assert.ok(d.nodes.every(n=>n.fields['Артикул производителя']==='EX-20'&&M.checked(n)));
  assert.equal(itemVolumeLiters({...two,fields:{'Транспортный объём, л':'4','Объём, л':'30'}}),4);
});

test('applying a found name explicitly changes the ordinary name and creates no official-name attribute',()=>{
  const d=ready(),n=d.nodes[0];const fields=M.planChanges(n,['officialName','name']);assert.equal(fields.length,1);assert.equal(fields[0].key,'name');
  M.applyChanges(d,[{id:n.id,candidateId:n.itemResearch.chosen,checkedAt:n.itemResearch.checkedAt,fields}]);
  assert.equal(n.name,'Рюкзак Example 20');assert.equal(n.fields['Официальное название'],undefined);assert.equal(n.fields['Название'],undefined);assert.ok(M.checked(n));
});
