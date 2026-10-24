import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createLANClient } from './lan-client.js';
import { randomID } from '../uuid.js';

test('pairing consumes fragment, uses same-origin HTTP-only session and loads Mac document',async()=>{
  const calls=[],history=[];
  const client=createLANClient({fetcher:async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>path==='/api/pair'?{ok:true}:{document:{revision:5,nodes:[]}}};}});
  const document=await client.connect({hash:'#pair=secret',pathname:'/',search:'?mode=inventory'},{replaceState:(...args)=>history.push(args)});
  assert.equal(document.revision,5);assert.equal(calls.length,2);
  assert.equal(calls[0].path,'/api/pair');assert.deepEqual(JSON.parse(calls[0].options.body),{key:'secret'});
  assert.equal(calls[0].options.headers['X-Life-Assistant'],'1');assert.equal(calls[0].options.credentials,'same-origin');
  assert.equal(history[0][2],'/?mode=inventory');assert.equal(calls[1].path,'/api/state');
});
test('expired or wrong QR stops boot without reading or creating a separate inventory',async()=>{
  let calls=0,removed=false;
  const client=createLANClient({fetcher:async()=>{calls++;return {ok:false,status:401,json:async()=>({error:'Новый QR'})};}});
  await assert.rejects(client.connect({hash:'#pair=old'},{replaceState:()=>removed=true}),e=>e.status===401);
  assert.equal(calls,1);assert.equal(removed,false);
});
test('reopening a paired tab only reads state; stale save retains conflict status',async()=>{
  const calls=[];
  const client=createLANClient({fetcher:async(path,options)=>{calls.push({path,options});return path==='/api/save'?{ok:false,status:409,json:async()=>({error:'Обновите данные'})}:{ok:true,json:async()=>({document:{revision:2}})};}});
  assert.equal((await client.connect({hash:''})).revision,2);
  await assert.rejects(client.save({revision:3},2,true),e=>e.status===409);
  assert.deepEqual(JSON.parse(calls[1].options.body),{document:{revision:3},expectedRevision:2,restore:true});
  await client.state(2);assert.equal(calls[2].path,'/api/state?revision=2');
});
test('network errors never claim an edit was saved',async()=>{
  const client=createLANClient({fetcher:async()=>{throw Error('fetch failed');}});
  await assert.rejects(client.save({revision:2},1),/Нет связи с Mac/);
});
test('UUIDs work on HTTP without randomUUID, retaining RFC4122 version and randomness',()=>{
  const source={getRandomValues:array=>webcrypto.getRandomValues(array)};
  const ids=new Set(Array.from({length:1000},()=>randomID(source)));
  assert.equal(ids.size,1000);
  for(const id of ids)assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
