import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionHistory, describeAction, historyShortcut } from './action-history.js';

test('saved editor and catalog actions undo and redo in one order with their destinations', () => {
  const history = createActionHistory();
  let doc = { plan: { name: 'Before' }, item: 'Before' };
  let before=structuredClone(doc);doc.plan.name = 'After';
  history.record(before, { label: 'План', section: 'space' },doc);
  before=structuredClone(doc);doc.item = 'After';
  history.record(before, { label: 'Вещь', section: 'catalog' },doc);
  for (const [redo, label, section, plan, item] of [
    [false, 'Вещь', 'catalog', 'After', 'Before'],
    [false, 'План', 'space', 'Before', 'Before'],
    [true, 'План', 'space', 'After', 'Before'],
    [true, 'Вещь', 'catalog', 'After', 'After'],
  ]) {
    const entry = history.peek(redo);
    assert.equal(entry.label, label);
    assert.equal(entry.section, section);
    const next = history.applyTo(structuredClone(doc),redo);
    history.complete(redo);
    doc = next;
    assert.deepEqual(doc, { plan: { name: plan }, item });
  }
  assert.equal(history.peek(true), undefined);
});

test('new action discards redo; bounded changes are isolated; clear removes both directions', () => {
  const history=createActionHistory(2);let doc={value:0};
  for(let i=1;i<=3;i++){const before=structuredClone(doc);doc.value=i;history.record(before,{label:String(i),section:'space'},doc);}
  assert.equal(history.applyTo(structuredClone(doc)).value,2);
  doc=history.applyTo(doc);history.complete(false);
  doc=history.applyTo(doc);history.complete(false);assert.equal(doc.value,1);assert.equal(history.peek(),undefined);
  history.record(doc,{label:'New',section:'catalog'},{value:9});assert.equal(history.peek(true),undefined);
  history.complete(false);history.clear();assert.equal(history.peek(),undefined);assert.equal(history.peek(true),undefined);
});

test('descriptions identify changed data and show geometry changes in the apartment', () => {
  const before = { plan: {}, events: [], nodes: [{ id: 'a', name: 'Вещь' }], settings: {}, categories: [] };
  const changed = structuredClone(before);changed.plan.name = 'План';
  assert.deepEqual(describeAction(before, changed, 'catalog'), { label: 'Изменение пространства', section: 'space' });
  const moved = structuredClone(before);moved.events.push({ id: '1', type: 'move', nodeId: 'a', name: 'Вещь' });
  assert.deepEqual(describeAction(before, moved, 'unplaced'), { label: 'Перемещение: Вещь', section: 'unplaced' });
  const renamed = structuredClone(before);renamed.nodes[0].name = 'Новое название';
  assert.equal(describeAction(before, renamed, 'catalog').label, 'Изменение: Новое название');
});

test('undo shortcuts support Mac, Windows and Russian layouts without intercepting other commands', () => {
  assert.equal(historyShortcut({ code: 'KeyZ', key: 'я', metaKey: true }), 'undo');
  assert.equal(historyShortcut({ code: 'KeyZ', key: 'Я', metaKey: true, shiftKey: true }), 'redo');
  assert.equal(historyShortcut({ key: 'z', ctrlKey: true }), 'undo');
  assert.equal(historyShortcut({ code: 'KeyY', ctrlKey: true }), 'redo');
  assert.equal(historyShortcut({ code: 'KeyY', metaKey: true }), null);
  assert.equal(historyShortcut({ code: 'KeyZ' }), null);
  assert.equal(historyShortcut({ code: 'KeyZ', ctrlKey: true, altKey: true }), null);
});

import * as M from './model.js';
const seed=()=>{const d={format:M.FORMAT,version:1,revision:0,plan:{rooms:[],furniture:[]},nodes:[],categories:[],events:[],settings:{reminderDays:3}};M.ensureUnplaced(d);return d;};
test('undo and redo restore purchase amounts, dates and cancelled sale events',()=>{
  let doc=seed();const history=createActionHistory();
  const commit=fn=>{const before=structuredClone(doc);fn(doc);history.record(before,{label:'Тест',section:'catalog'},doc);};
  const step=redo=>{doc=history.applyTo(doc,redo);history.complete(redo);M.record(doc,'undo',{id:'application',name:'Отмена / повтор'});M.validate(doc);};
  let id;commit(d=>{id=M.newNode(d,{name:'Покупка',parentId:M.UNPLACED_ID,acquisition:'purchase',purchasedAt:'2026-10-24',purchaseCents:10000}).id;});
  step(false);assert.equal(M.totals(doc).items,0);assert.equal(doc.events.filter(e=>e.type==='purchase').length,0);
  step(true);assert.equal(M.totals(doc).items,1);assert.equal(doc.events.filter(e=>e.type==='purchase').length,1);
  commit(d=>M.updateNode(d,id,{purchaseCents:20000,purchasedAt:'2026-09-01'}));step(false);
  assert.equal(doc.events.find(e=>e.type==='purchase').purchaseCents,10000);assert.equal(doc.events.find(e=>e.type==='purchase').effectiveDate,'2026-10-24');
  step(true);assert.equal(doc.events.find(e=>e.type==='purchase').purchaseCents,20000);
  commit(d=>M.archive(d,id,{reason:'Продано',date:'2026-10-24',saleCents:5000}));step(false);
  assert.equal(M.getNode(doc,id).archived,null);assert.equal(doc.events.filter(e=>e.type==='archive').length,0);
  step(true);assert.equal(doc.events.filter(e=>e.type==='archive').length,1);assert.equal(doc.events.find(e=>e.type==='archive').saleCents,5000);
  assert.ok(doc.events.some(e=>e.type==='undo'));
});
test('small edits do not retain unchanged photos or all other inventory cards',()=>{
 const history=createActionHistory(),photo='data:image/jpeg;base64,'+'A'.repeat(1000000);
 const before={nodes:Array.from({length:1000},(_,i)=>({id:String(i),name:'До',photo})),events:[]};
 const after=structuredClone(before);after.nodes[0].name='После';history.record(before,{label:'Имя',section:'catalog'},after);
 assert.ok(JSON.stringify(history.peek()).length<1000);
 after.nodes[0].name='Постороннее';history.applyTo(after);assert.equal(after.nodes[0].name,'До');assert.equal(after.nodes[0].photo,photo);
});
test('entity additions, deletions, reordering, settings and photos survive both directions',()=>{
 const history=createActionHistory(),before={nodes:[{id:'a',photo:'old'},{id:'b',photo:null}],plan:{rooms:[],points:[1,2]},settings:{motion:'on'}};
 const after={nodes:[{id:'c',photo:'new'},{id:'a',photo:null}],plan:{rooms:[{id:'r',name:'Комната'}],points:[2,3]},settings:{motion:'off',other:true}};
 history.record(before,{label:'План',section:'space'},after);
 const restored=history.applyTo(structuredClone(after));assert.deepEqual(restored,before);history.complete(false);
 assert.deepEqual(history.applyTo(restored,true),after);
});
