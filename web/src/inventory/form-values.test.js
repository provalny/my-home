import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measurementChanges} from './form-values.js';

test('an unrelated form edit preserves estimated and imported measurements',()=>{
 const n={kind:'furniture',fields:{'Вес, г':'25000','Объём, л':'1,2','Бренд':'Sony'},weightEstimate:{grams:25000}};
 const result=measurementChanges(n,n.fields,'','1,2');assert.deepEqual(result.fields,n.fields);assert.equal(result.weightChanged,false);assert.equal(result.volumeChanged,false);
 const explicit=measurementChanges(n,n.fields,'800','0,9');assert.deepEqual(explicit.fields,{'Вес, г':'800','Транспортный объём, л':'0.9','Бренд':'Sony'});assert.equal(explicit.weightChanged,true);assert.equal(n.fields['Вес, г'],'25000');
});
test('clearing measurements removes both field aliases and signals removal of legacy top-level values',()=>{
 const n={fields:{'Вес, кг':'2','Объём, л':'4'},weightKg:2,volumeLiters:4};const result=measurementChanges(n,n.fields,'','');assert.deepEqual(result.fields,{});assert.ok(result.weightChanged&&result.volumeChanged);
 for(const [weight,volume]of [['-1','2'],['NaN','2'],['10g','2'],['2','0'],['2','Infinity'],['1e40','3']])assert.throws(()=>measurementChanges(n,n.fields,weight,volume));
 assert.equal(measurementChanges(n,n.fields,'0','2').fields['Вес, г'],'0');
});
