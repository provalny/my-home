import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AWARDS, AWARD_GROUPS, AWARD_RARITIES, calculateAwards, syncAwards } from './awards.js';
import { RARITIES } from './rarity.js';
import { seedTravelDemo } from '../travel/demo.js';
import { seedAutomobileDemo } from '../automobile/demo.js';
import { createMonitoringDemo } from '../monitoring/demo.js';
import * as I from './model.js';
import { readFileSync } from 'node:fs';
const TODAY='2026-10-25',now=TODAY+'T12:00:00Z';
const fresh=()=>({nodes:[],categories:[]});
const get=(d,id)=>calculateAwards(d,{today:TODAY}).find(a=>a.id===id);
const day=(start,shift)=>{const d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+shift);return d.toISOString().slice(0,10);};
const dates=(length,start='2026-04-29')=>Array.from({length},(_,i)=>({date:day(start,i)}));
const seed=()=>I.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8')));

test('all awards have achievable targets, unique IDs, existing groups and catalog colors',()=>{
  assert.equal(AWARDS.length,68);assert.equal(new Set(AWARDS.map(a=>a.id)).size,68);
  assert.equal(AWARDS.filter(a=>a.hidden).length,7);
  for(const a of AWARDS){assert.ok(a.target>0);assert.ok(AWARD_GROUPS.some(g=>g.id===a.group));assert.ok(AWARD_RARITIES.some(r=>r.id===a.rarity));}
  assert.deepEqual(AWARD_RARITIES.map(r=>[r.id,r.color]),RARITIES.map(r=>[r.id,r.color]));
  for(const g of AWARD_GROUPS)assert.ok(AWARDS.some(a=>a.group===g.id));
});

test('180 daily visits are deduplicated, retained through undo and portable in backups',()=>{
  const d=fresh();
  for(const {date} of dates(180)){assert.equal(syncAwards(d,{today:date},{now:date+'T12:00:00Z',visitDay:date}),true);assert.equal(syncAwards(d,{today:date},{visitDay:date}),false);}
  assert.equal(d.awards.activity.length,180);assert.equal(get(d,'active-180').earned,true);assert.equal(get(d,'active-streak-180').earned,true);
  const undo=fresh();syncAwards(undo,{today:TODAY},{previous:d});assert.deepEqual(undo.awards,d.awards);
  const backup=JSON.parse(JSON.stringify(undo));assert.equal(syncAwards(backup,{today:TODAY}),false);assert.equal(get(backup,'active-streak-180').earned,true);
});

test('a 150 of 183 day marathon accepts gaps but cannot grant the strict 180 day streak',()=>{
  const d=fresh();d.awards={activity:dates(183,'2026-04-26').filter((_,i)=>i%6!==0)};
  assert.equal(d.awards.activity.length,152);assert.equal(get(d,'active-flex-150').met,true);assert.equal(get(d,'active-streak-180').met,false);
  assert.equal(get(d,'active-flex-150').value,150);
  const later=calculateAwards(d,{today:'2027-10-25'});assert.equal(later.find(a=>a.id==='active-flex-150').met,false);
});

test('old records, background recalculation and future dates never manufacture visit days',()=>{
  const d=fresh();d.personalMetrics={entries:dates(180),health:[]};
  syncAwards(d,{today:TODAY});assert.equal(get(d,'journal-180').met,true);assert.equal(get(d,'active-180').value,0);
  syncAwards(d,{today:TODAY});assert.equal(d.awards.activity.length,0);
  d.awards.activity=[{date:'2027-01-01'},{date:'2026-02-30'}];assert.equal(get(d,'active-180').value,0);
});

test('calendar streaks cross leap days, years and DST without duplicates or order dependence',()=>{
  for(const [start,end,length] of [['2024-02-20','2024-03-20',30],['2025-12-20','2026-01-18',30],['2026-03-20','2026-04-18',30]]){
    const d=fresh();d.awards={activity:[...dates(length,start).reverse(),{date:start}]};
    const award=calculateAwards(d,{today:end}).find(a=>a.id==='active-streak-30');assert.equal(award.met,true);
    d.awards.activity=d.awards.activity.filter(r=>r.date!==day(start,10));assert.equal(calculateAwards(d,{today:end}).find(a=>a.id==='active-streak-30').met,false);
  }
});

test('six consecutive reading and car journal months are per home/car and ignore future entries',()=>{
  const d=fresh(),records=Array.from({length:6},(_,i)=>({date:`2026-${String(i+5).padStart(2,'0')}-10`,type:'refuel'}));
  d.monitoring={apartments:[{readings:records}]};d.automobiles={vehicles:[{records}]};
  assert.equal(get(d,'monitor-six').met,true);assert.equal(get(d,'car-six').met,true);
  d.monitoring.apartments=[{readings:records.slice(0,3)},{readings:records.slice(3)}];assert.equal(get(d,'monitor-six').met,false);
  d.automobiles.vehicles[0].records=[...records.slice(0,5),{date:'2027-01-01',type:'refuel'}];assert.equal(get(d,'car-six').met,false);
});

test('on-time bills require complete payment by due date; installments and overpayments work',()=>{
  const d=fresh(),a={bills:[],payments:[]};d.monitoring={apartments:[a]};
  for(let i=5;i<=10;i++){
    const period=`2026-${String(i).padStart(2,'0')}`,id=period;
    a.bills.push({id,date:period+'-01',period,dueDate:period+'-20',amountCents:1000,adjustmentCents:0});
    a.payments.push({billId:id,date:period+'-10',amountCents:400},{billId:id,date:period+'-20',amountCents:700});
  }
  assert.equal(get(d,'paid-six').met,true);assert.equal(get(d,'paid-first').met,true);
  a.payments[7].date='2026-08-21';assert.equal(get(d,'paid-six').met,false);
  a.payments[7].date='2026-08-20';a.bills[3].dueDate='';assert.equal(get(d,'paid-six').met,false);
  a.bills.forEach(b=>{b.amountCents=0;});assert.equal(get(d,'paid-first').met,false);
});

test('all seeded demos are excluded, including old grants and monitoring mixed with real apartments',()=>{
  for(const fill of [seedTravelDemo,seedAutomobileDemo]){
    const d=seed();fill(d);d.awards={activity:dates(180),earned:{'first-item':{earnedAt:now}}};syncAwards(d,{today:TODAY},{visitDay:TODAY});
    assert.ok(calculateAwards(d,{today:TODAY}).every(a=>!a.met&&!a.earned));assert.equal(d.awards.activity.length,180);
  }
  const d=fresh();d.monitoring={apartments:[createMonitoringDemo({asOf:TODAY})]};assert.equal(get(d,'monitor-six').value,0);assert.equal(get(d,'paid-first').value,0);
  d.monitoring.apartments.push({readings:[{date:TODAY}]});assert.equal(get(d,'readings-first').met,true);assert.equal(get(d,'monitor-six').value,1);
});

test('hidden grants reveal on earning and survive deletion and older snapshots',()=>{
  const d=fresh();d.personalMetrics={entries:dates(30).map(r=>({...r,note:'Запись'}))};
  assert.equal(get(d,'journal-notes-30').hidden,true);assert.equal(get(d,'journal-notes-30').met,true);
  syncAwards(d,{today:TODAY},{now});d.personalMetrics.entries=[];syncAwards(d,{today:TODAY});
  assert.equal(get(d,'journal-notes-30').earned,true);assert.equal(get(d,'journal-notes-30').earnedAt,now);
  assert.equal(get(d,'journal-notes-30').value,0);
});

test('personal metrics count distinct nonfuture days and import source independently of physical performance',()=>{
  const d=fresh();d.personalMetrics={entries:[...dates(180),{date:'2027-01-01'},{date:'2026-02-30'}],health:dates(180).map(r=>({...r,source:'apple-health-export',steps:0}))};
  assert.equal(get(d,'journal-streak-180').met,true);assert.equal(get(d,'health-180').met,true);assert.equal(get(d,'health-import').met,true);
  d.personalMetrics.entries.splice(100,1);assert.equal(get(d,'journal-streak-180').met,false);assert.equal(get(d,'journal-180').value,179);
});

test('travel awards need real contents, actual completed dates and a successful offline save',()=>{
  const d=fresh(),t={stops:[{mode:'car'},{mode:'car'},{mode:'foot'},{mode:'bike'}],events:[{date:TODAY}],bags:[],status:'completed',endDate:'2027-01-01'};
  d.travel={trips:[t],loadouts:[{bags:[]}]};assert.equal(get(d,'trip-complete').met,false);assert.equal(get(d,'trip-modes').met,true);assert.equal(get(d,'loadouts-3').value,0);
  t.endDate=TODAY;assert.equal(get(d,'trip-complete').met,true);assert.equal(get(d,'trip-offline').met,false);t.offlineSavedAt=now;assert.equal(get(d,'trip-offline').met,true);
  t.bags=[{nodeId:'missing',items:['a','b','c','d','e']}];assert.equal(get(d,'travel-packed').met,false);
});

test('packed travel award is attainable with five weighed items and fails for overload or missing items',()=>{
  const d=fresh();d.nodes=[{id:'bag',kind:'item',fields:{'Вес, г':'500'}},...Array.from({length:5},(_,i)=>({id:'gear'+i,kind:'item',fields:{'Вес, г':'100'}}))];
  const bag={nodeId:'bag',items:d.nodes.slice(1).map(n=>n.id),maxWeightKg:2,capacityLiters:20,usedLiters:5};d.travel={trips:[{bags:[bag]}]};
  assert.equal(get(d,'travel-packed').met,true);bag.maxWeightKg=.6;assert.equal(get(d,'travel-packed').met,false);bag.maxWeightKg=2;d.nodes.pop();assert.equal(get(d,'travel-packed').met,false);
});

test('catalog awards support real car storage and explicit wear tracking, excluding built-in sections',()=>{
  const d=fresh();d.nodes=[{id:'car',kind:'room',virtual:true,automobileId:'c'},...Array.from({length:10},(_,i)=>({id:String(i),kind:'item',parentId:'car',wearMode:'automatic'}))];
  assert.equal(get(d,'all-placed').met,true);assert.equal(get(d,'wear-10').met,true);assert.equal(get(d,'first-room').met,false);
});

test('optional corrupt awards are repairable, unknown grants preserved and sync failures cannot partly mutate',()=>{
  const d=fresh();d.awards={earned:['bad'],activity:'broken'};assert.equal(syncAwards(d,{today:TODAY},{visitDay:TODAY}),true);assert.deepEqual(d.awards.activity,[{date:TODAY}]);
  d.awards.earned['future-id']={earnedAt:null};syncAwards(d,{today:TODAY});assert.ok(d.awards.earned['future-id']);
  const old=d.awards;Object.defineProperty(d,'nodes',{get(){throw Error('corrupt');}});assert.equal(syncAwards(d),false);assert.equal(d.awards,old);
});

test('cross-domain legend accepts an already earned mastery award after records are removed',()=>{
  const d=fresh();d.nodes=[{id:'room',kind:'room'},...Array.from({length:10},(_,i)=>({id:String(i),kind:'item',parentId:'room'}))];
  d.monitoring={apartments:[{readings:[{date:TODAY}]}]};d.automobiles={vehicles:[{records:[{type:'refuel',date:TODAY}]}]};
  d.travel={trips:[{status:'completed',endDate:TODAY,stops:[{},{}],events:[{date:TODAY}]}]};d.personalMetrics={entries:[{date:TODAY}]};
  syncAwards(d,{today:TODAY},{now});assert.equal(get(d,'all-domains').earned,true);
  delete d.personalMetrics;d.nodes=[];d.awards.activity=dates(180);
  assert.equal(get(d,'all-domains-180').met,true);syncAwards(d,{today:TODAY},{now});assert.equal(get(d,'all-domains-180').earned,true);
});
