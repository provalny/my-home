import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from './model.js';
import * as I from '../inventory/model.js';
import { createActionHistory } from '../inventory/action-history.js';

const seed=()=>I.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8')));
const fixture=()=>{const d=seed(),id=M.addApartment(d,{name:'Тестовая квартира',planSpaceId:'home'}),a=M.getApartment(d,id),s=a.services[0];return {d,a,s};};
const bill=(a,s,{period='2026-10',amountCents=10000,adjustmentCents=0,dueDate='2026-10-25',...rest}={})=>{const id=M.put(a,'bills',{serviceId:s.id,date:period+'-15',period,amountCents,adjustmentCents,dueDate,note:'',attachments:[],...rest});return a.bills.find(b=>b.id===id);};
const meter=(a,s,scheme='dual')=>{const id=M.put(a,'meters',{name:'Электросчётчик',serviceId:s.id,serial:'123',scheme,installedAt:'2026-01-01',retiredAt:null,verificationDate:'2026-11-01'});return a.meters.find(m=>m.id===id);};

test('old documents remain unchanged; new ledger does not alter inventory or plans',()=>{
  const d=seed(),before=structuredClone(d);M.validateMonitoring(d);assert.deepEqual(d,before);
  const id=M.addApartment(d,{name:'Отдельный мониторинг',planSpaceId:'home'}),a=M.getApartment(d,id);assert.equal(a.services.length,14);assert.equal(a.meters.length,0);assert.equal(a.bills.length,0);
  const {monitoring,...rest}=d;assert.deepEqual(rest,before);I.validate(d);assert.equal(monitoring.version,1);
});
test('apartments sharing a drawing have independent services, readings and money',()=>{
  const {d,a,s}=fixture(),second=M.getApartment(d,M.addApartment(d,{name:'Другая квартира',planSpaceId:'home'}));bill(a,s);assert.equal(M.summary(a,'2026-10').charged,10000);assert.equal(M.summary(second,'2026-10').charged,null);assert.notEqual(a.services[0].id,second.services[0].id);
  const before=structuredClone(second);M.put(a,'consumption',{serviceId:s.id,date:'2026-10-25',period:'2026-10',amount:12.5,note:''});assert.deepEqual(second,before);I.validate(d);
});
test('all expense, rate and adjustment parsing preserves kopecks and explicit zero',()=>{
  assert.equal(M.cents('1 299,99'),129999);assert.equal(M.cents('0'),0);assert.equal(M.cents('-19,01',{signed:true}),-1901);assert.equal(M.cents(''),null);assert.equal(M.decimal('0,000001'),0.000001);
  for(const v of ['1.001','-1','NaN','1e2','1,2,3'])assert.throws(()=>M.cents(v));assert.throws(()=>M.cents('',{optional:false}));assert.throws(()=>M.decimal('Infinity'));
});
test('meter readings and tariffs never create consumption or a calculated charge',()=>{
  const {d,a,s}=fixture(),m=meter(a,s);M.put(a,'readings',{meterId:m.id,serviceId:s.id,date:'2026-10-01',values:{day:100,night:40},note:''});M.put(a,'readings',{meterId:m.id,serviceId:s.id,date:'2026-10-25',values:{day:150,night:60},note:''});M.put(a,'tariffs',{serviceId:s.id,date:'2026-10-01',zone:'day',rateCents:700,name:'День',note:''});
  assert.equal(M.consumptionFor(a,s.id,'2026-10'),null);assert.equal(M.summary(a,'2026-10').charged,null);assert.equal(a.bills.length,0);I.validate(d);
});
test('manual consumption accumulates in its specified accounting period, independently of entry date',()=>{
  const {a,s}=fixture();M.put(a,'consumption',{serviceId:s.id,date:'2026-11-01',period:'2026-10',amount:0,note:''});assert.equal(M.consumptionFor(a,s.id,'2026-10'),0);M.put(a,'consumption',{serviceId:s.id,date:'2026-10-25',period:'2026-10',amount:12.5,note:''});assert.equal(M.consumptionFor(a,s.id,'2026-10'),12.5);assert.equal(M.consumptionFor(a,s.id,'2026-11'),null);
});
test('partial payments, signed adjustments and overpayments do not lose remaining balance',()=>{
  const {d,a,s}=fixture(),b=bill(a,s,{amountCents:120001,adjustmentCents:-20000});M.put(a,'payments',{billId:b.id,date:'2026-10-20',amountCents:40000,note:''});assert.equal(M.billBalance(a,b),60001);assert.equal(M.summary(a,'2026-10').balance,60001);
  M.put(a,'payments',{billId:b.id,date:'2026-10-25',amountCents:70000,note:''});assert.equal(M.billBalance(a,b),-9999);assert.equal(M.summary(a,'2026-10').balance,-9999);I.validate(d);
});
test('monthly payments follow payment date; historical debt excludes future payments and bills',()=>{
  const {a,s}=fixture();s.openingCents=10000;const b=bill(a,s);bill(a,s,{period:'2026-11',amountCents:20000});M.put(a,'payments',{billId:b.id,date:'2026-11-01',amountCents:12000,note:''});assert.equal(M.summary(a,'2026-10').balance,20000);assert.equal(M.summary(a,'2026-10').paid,null);assert.equal(M.summary(a,'2026-11').balance,28000);assert.equal(M.summary(a,'2026-11').paid,12000);
});
test('monthly reminders use last day of short months, survive reload and respect manual completion',()=>{
  const {a}=fixture();const id=M.put(a,'rules',{name:'Передать показания',kind:'submission',serviceId:null,day:31,enabled:true});let list=M.reminders(a,'2026-02-20');assert.equal(list[0].date,'2026-02-28');M.completeReminder(a,list[0]);M.completeReminder(a,list[0]);assert.equal(a.completions.length,1);list=M.reminders(JSON.parse(JSON.stringify(a)),'2026-02-20');assert.ok(!list.some(r=>r.date==='2026-02-28'));assert.ok(list.some(r=>r.ruleId===id&&r.date==='2026-03-31'));assert.equal(M.monthDay('2028-02',31),'2028-02-29');
});
test('reminders include unpaid bills, overdue tasks, meter verification and recurring submissions',()=>{
  const {a,s}=fixture();const b=bill(a,s);meter(a,s);M.put(a,'tasks',{name:'Фильтры',kind:'maintenance',serviceId:null,dueDate:'2026-10-01',completedAt:null,costCents:null,note:''});M.put(a,'rules',{name:'Отправить',kind:'submission',serviceId:s.id,day:25,enabled:true});const list=M.reminders(a,'2026-10-20');assert.ok(list.some(r=>r.billId===b.id));assert.ok(list.some(r=>r.meterId));const task=list.find(r=>r.taskId);assert.ok(task);M.completeReminder(a,task);assert.ok(!M.reminders(a,'2026-10-20').some(r=>r.id===task.id));M.put(a,'payments',{billId:b.id,date:'2026-10-20',amountCents:10000,note:''});assert.ok(!M.reminders(a,'2026-10-20').some(r=>r.billId===b.id));
});
test('changing or removing referenced services and meters cannot strand ledger entries',()=>{
  const {d,a,s}=fixture(),m=meter(a,s);M.put(a,'readings',{meterId:m.id,serviceId:s.id,date:'2026-10-01',values:{day:10,night:5},note:''});assert.throws(()=>M.remove(a,'meters',m.id));assert.throws(()=>M.remove(a,'services',s.id));s.archived=true;I.validate(d);const b=bill(a,s);M.put(a,'payments',{billId:b.id,date:'2026-10-20',amountCents:100,note:''});assert.throws(()=>M.remove(a,'bills',b.id));
});
test('replacement preserves old readings and rejects dates outside a meter lifetime',()=>{
  const {d,a,s}=fixture(),m=meter(a,s);m.retiredAt='2026-10-15';const r={meterId:m.id,serviceId:s.id,date:'2026-10-15',values:{day:200,night:100},note:''};M.put(a,'readings',r);meter(a,s,'single');I.validate(d);a.readings[0].date='2026-10-16';assert.throws(()=>I.validate(d),/периода работы/);
});
test('backup round trip and undo/redo include the separate ledger and receipts',()=>{
  const {d,a,s}=fixture(),before=structuredClone(d),b=bill(a,s,{attachments:[{id:'receipt-unique',name:'Квитанция.pdf',data:'data:application/pdf;base64,JVBERi0xLjQK'}]});const history=createActionHistory();history.record(before,{label:'Счёт',section:'monitoring'},d);const restored=JSON.parse(JSON.stringify(d));I.migrate(restored);I.validate(restored);assert.deepEqual(restored.monitoring,d.monitoring);history.applyTo(d);assert.equal(M.getApartment(d,a.id).bills.length,0);history.complete(false);history.applyTo(d,true);assert.equal(M.getApartment(d,a.id).bills[0].id,b.id);I.validate(d);
});
test('validation rejects foreign references, impossible dates and dangerous attachment formats',()=>{
  for(const corrupt of [a=>a.bills[0].serviceId='other-apartment',a=>a.bills[0].date='2026-02-30',a=>a.bills[0].amountCents=0.5,a=>a.bills[0].attachments=[{id:'html',name:'x',data:'data:text/html;base64,QQ=='}],a=>a.climate.push({id:'climate',date:'2026-10-25',temperature:20,humidity:101,note:''})]){const {d,a,s}=fixture();bill(a,s);corrupt(a);assert.throws(()=>I.validate(d));}
});
test('comparison never fabricates percentages for missing or zero baseline',()=>{
  assert.equal(M.changePercent(100,null),null);assert.equal(M.changePercent(100,0),null);assert.equal(M.changePercent(0,100),-100);assert.equal(M.changePercent(110,100),10);assert.equal(M.changePercent(100,100),0);
});
test('starting a new inventory or clearing its map preserves the independent monitoring ledger',()=>{
  const {d,a,s}=fixture();bill(a,s);const before=structuredClone(d.monitoring),next=I.createHome(d,{mode:'empty'});assert.deepEqual(next.monitoring,before);assert.notEqual(next.monitoring,d.monitoring);I.clearApartment(d);assert.deepEqual(d.monitoring,before);I.validate(next);I.validate(d);
});
