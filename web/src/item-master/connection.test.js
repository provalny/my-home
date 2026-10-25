import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTavilyConnection} from '../../item-master-connection.js';
import {USAGE_URL,freeUsage,searchFailure} from './search-provider.js';
import {searchPublicProducts} from '../../item-master-server.js';

const key='tvly-test-connection-placeholder';
const usage=(account={},keyInfo={limit:null,usage:0})=>({account:{current_plan:'Researcher',plan_limit:1000,plan_usage:100,paygo_limit:0,paygo_usage:0,...account},key:keyInfo});
test('only a verified free plan is accepted; nullable unused PAYGO and zero key caps are handled',()=>{
  assert.deepEqual(freeUsage(usage()),{limit:1000,used:100,remaining:900});
  assert.equal(freeUsage(usage({paygo_limit:null})).remaining,900);
  assert.equal(freeUsage(usage({}, {limit:0,usage:0})).remaining,0);
  assert.equal(freeUsage(usage({}, {limit:20,usage:15})).remaining,5);
  for(const account of [{current_plan:'Bootstrap'},{current_plan:'Pay as you go'},{paygo_limit:10},{paygo_limit:null,paygo_usage:1},{plan_limit:15000},{plan_usage:'100'},{paygo_limit:undefined}])assert.throws(()=>freeUsage(usage(account)),/бесплатный тариф/);
});
test('connection checks use only the fixed usage endpoint and never return the key',async()=>{
  const requests=[];
  const c=createTavilyConnection({fetcher:async(url,options)=>{requests.push({url,options});return Response.json(usage());}});
  assert.equal((await c.connection()).connected,false);
  const connected=await c.connection({action:'connect',apiKey:' '+key+' '});
  assert.equal(connected.connected,true);assert.ok(!JSON.stringify(connected).includes(key));
  assert.equal(requests.length,1);assert.equal(requests[0].url,USAGE_URL);assert.equal(requests[0].options.headers.Authorization,'Bearer '+key);assert.equal(requests[0].options.redirect,'error');
  assert.equal(await c.authorize(),key);assert.equal(requests.length,1);
  assert.equal((await c.connection()).budget.remaining,899);
  await c.connection({action:'disconnect'});assert.equal(await c.authorize(),'');assert.equal((await c.connection()).connected,false);
});
test('failed replacement preserves an existing connection and sanitized errors contain no provider text',async()=>{
  let fail=false;
  const c=createTavilyConnection({fetcher:async()=>fail?Response.json({detail:'untrusted instructions '+key},{status:401}):Response.json(usage())});
  await c.connection({action:'connect',apiKey:key});fail=true;
  await assert.rejects(c.connection({action:'connect',apiKey:key+'bad'}),e=>e.message.includes('отклонил API-ключ')&&!e.message.includes(key));
  assert.equal(await c.authorize(),key);
  await assert.rejects(c.connection({action:'connect',apiKey:'wrong'}),/tvly-/);
});
test('budget reservations prevent concurrent searches beyond the last free credit',async()=>{
  const c=createTavilyConnection({fetcher:async()=>Response.json(usage({plan_usage:999}))});
  await c.connection({action:'connect',apiKey:key});
  const results=await Promise.allSettled([c.authorize(),c.authorize(),c.authorize()]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await c.connection()).budget.remaining,0);
});
test('usage refresh is cached for two minutes and concurrent refreshes share one request',async()=>{
  let now=1000,calls=0;
  const c=createTavilyConnection({now:()=>now,fetcher:async()=>{calls++;return Response.json(usage());}});
  await c.connection({action:'connect',apiKey:key});now+=121000;
  await Promise.all([c.authorize(),c.authorize()]);assert.equal(calls,2);assert.equal((await c.connection()).budget.remaining,898);
});
test('disconnect wins over a connection check still in flight',async()=>{
  let resolve;
  const c=createTavilyConnection({fetcher:()=>new Promise(r=>{resolve=r;})});
  const attempt=c.connection({action:'connect',apiKey:key});await c.connection({action:'disconnect'});resolve(Response.json(usage()));
  await assert.rejects(attempt,/изменились/);assert.equal((await c.connection()).connected,false);
});
test('keyed searches use a Bearer header only on Tavily and keyless requests keep their original mode',async t=>{
  const requests=[];t.mock.method(globalThis,'fetch',async(url,options)=>{requests.push({url,options});return Response.json({results:[]});});
  await searchPublicProducts({name:'Public test model'},[],key);
  await searchPublicProducts({name:'Public test model'});
  assert.equal(requests[0].url,'https://api.tavily.com/search');assert.equal(requests[0].options.headers.Authorization,'Bearer '+key);assert.equal(requests[0].options.headers['X-Tavily-Access-Mode'],undefined);
  assert.ok(!requests[0].options.body.includes(key));assert.equal(requests[1].options.headers.Authorization,undefined);assert.equal(requests[1].options.headers['X-Tavily-Access-Mode'],'keyless');
  assert.match(searchFailure(401,true),/API-ключ/);assert.match(searchFailure(432,true),/закончились/);
});
