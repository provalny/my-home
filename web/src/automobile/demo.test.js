import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as I from '../inventory/model.js';
import * as A from './model.js';
import { seedAutomobileDemo } from './demo.js';
const seed=()=>I.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8')));

test('auto demo fills two independent cars, six months, storage, service, tires and trip kits',()=>{
 const d=seed(),plan=structuredClone(d.plan),existing=new Map(d.nodes.map(n=>[n.id,structuredClone(n)]));
 assert.equal(seedAutomobileDemo(d,{referenceDate:'2026-10-25'}),true);I.validate(d);assert.equal(A.cars(d).length,2);
 const [one,two]=A.cars(d);assert.equal(new Set(one.records.map(r=>r.date.slice(0,7))).size,6);assert.ok(one.records.length>50);assert.ok(two.records.length>40);
 assert.equal(A.metrics(one,'2026-10').distance,1240);assert.equal(A.metrics(one,'2026-10').consumption,7.8);assert.equal(A.metrics(two,'2026-10').distance,850);
 assert.ok(A.metrics(one,'2026-10').total>0);assert.ok(A.metrics(one).byCategory.length>=7);
 assert.equal(one.kits.length,2);assert.ok(one.kits[0].entries.every(e=>e.packed));assert.ok(one.kits[1].entries.every(e=>!e.packed));
 assert.equal(one.tires.length,2);assert.ok(one.tires.some(t=>t.sessions.some(s=>s.endOdometer==null)));
 assert.ok(one.records.some(r=>r.type==='service'&&r.consumptions.length===2));assert.equal(d.nodes.find(n=>n.name==='Моторное масло 5W-30').quantity,1);
 assert.ok(d.nodes.filter(n=>A.carForNode(d,n)?.id===one.id&&!n.carCompartment&&n.kind==='item').length>=20);
 assert.deepEqual(d.plan,plan);for(const [id,node]of existing)assert.deepEqual(I.getNode(d,id),node);
 assert.ok(d.nodes.every(n=>n.demo));assert.ok(d.events.every(e=>e.demo));assert.ok(one.records.every(r=>r.date<='2026-10-25'));
 const before=JSON.stringify(d);assert.equal(seedAutomobileDemo(d,{referenceDate:'2026-10-25'}),false);assert.equal(JSON.stringify(d),before);
 I.migrate(d);I.validate(JSON.parse(JSON.stringify(d)));
});
test('demo never replaces a document with an existing car',()=>{const d=seed();A.addCar(d,{name:'Своя машина'});const before=JSON.stringify(d);assert.equal(seedAutomobileDemo(d),false);assert.equal(JSON.stringify(d),before);});
test('demo history remains valid at month/year boundaries without future records',()=>{for(const referenceDate of ['2026-01-01','2024-03-02','2026-12-31']){const d=seed();seedAutomobileDemo(d,{referenceDate});I.validate(d);assert.ok(A.cars(d).every(c=>c.records.every(r=>r.date<=referenceDate)));}});
