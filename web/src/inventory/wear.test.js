import {test} from 'node:test';
import assert from 'node:assert/strict';
import {itemWear,validateWear} from './wear.js';
test('legacy manual wear is preserved, zero is distinct from unknown',()=>{assert.equal(itemWear({wear:0}),0);assert.equal(itemWear({wear:35}),35);assert.equal(itemWear({wear:null}),null);});
test('automatic wear uses calendar lifetime and clamps before purchase and after expiry',()=>{
 const n={wearMode:'automatic',purchasedAt:'2024-01-01',usefulLifeMonths:12,wear:80};assert.equal(itemWear(n,'2024-07-02'),50);assert.equal(itemWear(n,'2023-12-31'),0);assert.equal(itemWear(n,'2025-01-01'),100);assert.equal(itemWear(n,'2026-01-01'),100);
});
test('month ends, leap dates and missing inputs do not roll into a wrong month',()=>{
 const n={wearMode:'automatic',purchasedAt:'2024-01-31',usefulLifeMonths:1};assert.equal(itemWear(n,'2024-02-29'),100);assert.equal(itemWear({...n,purchasedAt:'2024-02-31'},'2024-03-01'),null);assert.equal(itemWear({...n,usefulLifeMonths:0}),null);
});
test('invalid automatic settings are rejected; manual and JSON round trips remain valid',()=>{
 assert.throws(()=>validateWear({wearMode:'automatic',purchasedAt:'',usefulLifeMonths:12}));assert.throws(()=>validateWear({usefulLifeMonths:1.2}));const n=JSON.parse(JSON.stringify({wearMode:'automatic',purchasedAt:'2025-01-01',usefulLifeMonths:24}));validateWear(n);assert.equal(itemWear(n,'2026-01-01'),50);validateWear({wear:30});
});

test('inventory saves automatic wear settings, validates them and preserves them in backups',async()=>{
 const M=await import('./model.js'),{readFileSync}=await import('node:fs');const d=M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8'))),n=d.nodes.find(n=>n.kind==='item');
 M.updateNode(d,n.id,{wearMode:'automatic',purchasedAt:'2025-10-24',usefulLifeMonths:24});M.validate(d);const copy=JSON.parse(JSON.stringify(d));M.migrate(copy);M.validate(copy);assert.equal(itemWear(M.getNode(copy,n.id),'2026-10-24'),50);
 M.updateNode(copy,n.id,{wearMode:'manual',wear:31});M.validate(copy);assert.equal(itemWear(M.getNode(copy,n.id),'2026-10-24'),31);
});

test('items without wear settings use their addition date and 36 calendar months',()=>{
 const n={createdAt:'2024-01-01T12:00:00Z',wear:null};assert.equal(itemWear(n,'2024-01-01'),0);assert.equal(itemWear(n,'2025-07-02'),50);assert.equal(itemWear(n,'2027-01-01'),100);
 assert.equal(itemWear({...n,purchasedAt:'2020-01-01',usefulLifeMonths:1},'2024-01-01'),0);
});
test('explicit standard mode ignores a previous manual value and survives backups',()=>{
 const n=JSON.parse(JSON.stringify({createdAt:'2024-01-01T12:00:00Z',wear:90,wearMode:'standard'}));validateWear(n);assert.equal(itemWear(n,'2024-01-01'),0);assert.equal(itemWear({...n,wearMode:'manual',wear:23},'2024-01-01'),23);
});
