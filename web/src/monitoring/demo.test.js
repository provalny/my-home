import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as I from '../inventory/model.js';
import * as M from './model.js';
import { addMonitoringDemo, createMonitoringDemo } from './demo.js';

test('demo covers two years, every ledger, partial payments, overpayments and meter replacement',()=>{
  const a=createMonitoringDemo({asOf:'2026-10-25'});M.validateMonitoring({monitoring:{version:1,apartments:[a]}});
  assert.equal(new Set(a.bills.map(b=>b.period)).size,24);
  for(const key of ['meters','readings','consumption','bills','payments','tariffs','climate','tasks','rules','completions'])assert.ok(a[key].length>0,key);
  assert.equal(a.settings.remindersEnabled,false);assert.equal(a.services.length,15);assert.ok(a.meters.some(m=>m.retiredAt));
  const current=a.bills.filter(b=>b.period==='2026-10');assert.ok(current.some(b=>M.billBalance(a,b)>0&&M.billPaid(a,b)>0));assert.ok(current.some(b=>M.billBalance(a,b)<0));assert.ok(current.some(b=>b.adjustmentCents<0));
  const file=current.find(b=>b.attachments.length).attachments[0],pdf=atob(file.data.split(',')[1]);assert.ok(pdf.startsWith('%PDF-1.4'));assert.ok(pdf.includes('NOT A REAL BILL - DO NOT PAY'));assert.ok(pdf.endsWith('%%EOF\n'));
});
test('adding demo preserves existing inventory, cars and monitoring and is idempotent',()=>{
  const d=I.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8')));
  const realId=M.addApartment(d,{name:'Моя квартира',planSpaceId:'home'}),real=M.getApartment(d,realId);M.put(real,'consumption',{serviceId:real.services[0].id,date:'2026-10-20',period:'2026-10',amount:123,note:'Моя запись'});
  const before=structuredClone(d),id=addMonitoringDemo(d,{asOf:'2026-10-25'});I.validate(d);
  const {monitoring,...other}=d,{monitoring:oldMonitoring,...oldOther}=before;assert.deepEqual(other,oldOther);assert.deepEqual(M.getApartment(d,realId),oldMonitoring.apartments[0]);
  assert.equal(addMonitoringDemo(d,{asOf:'2026-10-25'}),id);assert.equal(monitoring.apartments.length,2);assert.equal(M.getApartment(d,id).bills.length,338);
});
test('demo is valid at month and year boundaries including leap February',()=>{
  for(const asOf of ['2026-01-01','2026-02-28','2028-02-29','2026-12-31']){const a=createMonitoringDemo({asOf});M.validateMonitoring({monitoring:{version:1,apartments:[a]}});assert.ok(a.climate.every(c=>c.date<=asOf));}
});
