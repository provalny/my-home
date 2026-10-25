import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from './model.js';

test('daily answers are saved once per date and can be changed', () => {
  const doc={};
  M.putEntry(doc,{date:'2026-10-25',mood:4,energy:3,tension:2,productivity:5,busyMinutes:480,note:''});
  M.putEntry(doc,{date:'2026-10-25',mood:3,note:'Устал'});
  assert.equal(doc.personalMetrics.entries.length,1);
  assert.equal(M.entryOn(doc,'2026-10-25').mood,3);
  assert.equal(M.entryOn(doc,'2026-10-25').note,'Устал');
  assert.equal(M.entryOn(doc,'2026-10-25').energy,null);
  assert.equal(M.validatePersonalMetrics(doc),true);
});

test('skipped prompt is cleared after saving an answer', () => {
  const doc={};
  M.skipPrompt(doc,'2026-10-25');
  assert.equal(M.data(doc).settings.skippedOn,'2026-10-25');
  M.putEntry(doc,{date:'2026-10-25',mood:4});
  assert.equal(M.data(doc).settings.skippedOn,null);
});

test('health values validate and manual correction replaces imported day', () => {
  const doc={};
  M.putHealth(doc,{date:'2026-10-25',sleepMinutes:420,steps:8000,activityMinutes:45,source:'apple-health-export'});
  M.putHealth(doc,{date:'2026-10-25',sleepMinutes:450,steps:8300,activityMinutes:50,source:'manual'});
  assert.equal(doc.personalMetrics.health.length,1);
  assert.equal(M.healthOn(doc,'2026-10-25').source,'manual');
  assert.equal(M.healthOn(doc,'2026-10-25').steps,8300);
  assert.throws(()=>M.putHealth(doc,{date:'2026-10-25',steps:-1}),/Некорректные данные/);
  assert.equal(M.validatePersonalMetrics(doc),true);
});

test('invalid and empty entries are rejected', () => {
  assert.throws(()=>M.putEntry({}, {date:'2026-02-30',mood:4}),/Некорректная/);
  assert.throws(()=>M.putEntry({}, {date:'2026-10-25'}),/Выберите/);
  assert.throws(()=>M.putEntry({}, {date:'2026-10-25',busyMinutes:1441}),/Некорректная/);
});

test('new check-in keeps time categories, tags and recovery without altering old entries',()=>{
  const doc={};
  M.putEntry(doc,{date:'2026-10-25',mood:4,energy:3,tension:2,productivity:4,
    timeBreakdown:{work:300,chores:30,commute:90,other:0},timeSource:'calendar',loadScore:3,rest:4,
    causes:['work','sleep'],recovery:['walk']});
  const row=M.entryOn(doc,'2026-10-25');
  assert.equal(row.busyMinutes,420);
  assert.deepEqual(row.causes,['work','sleep']);
  assert.equal(row.timeSource,'calendar');
  assert.equal(M.validatePersonalMetrics(doc),true);
  const old={};M.putEntry(old,{date:'2026-10-24',mood:3,busyMinutes:240});
  M.putEntry(old,{date:'2026-10-24',mood:4,busyMinutes:240,timeBreakdown:{work:null,chores:null,commute:null,other:null}});
  assert.equal(M.entryOn(old,'2026-10-24').busyMinutes,240);
  assert.equal(M.validatePersonalMetrics(old),true);
});

test('weight is optional, once per day, and validates precision',()=>{
  const doc={};
  M.putWeight(doc,{date:'2026-10-25',kg:72.5});M.putWeight(doc,{date:'2026-10-25',kg:72.4});
  assert.equal(doc.personalMetrics.weight.length,1);
  assert.equal(M.weightOn(doc,'2026-10-25').kg,72.4);
  assert.throws(()=>M.putWeight(doc,{date:'2026-10-25',kg:72.45}),/точностью/);
  assert.equal(M.validatePersonalMetrics(doc),true);
});

test('forged tags, time totals and calendar mappings are rejected',()=>{
  const doc={};M.putEntry(doc,{date:'2026-10-25',mood:3});
  assert.throws(()=>M.putEntry(doc,{date:'2026-10-25',mood:3,causes:['unknown']}),/Некорректная/);
  assert.throws(()=>M.putEntry(doc,{date:'2026-10-25',mood:3,timeBreakdown:{work:1000,chores:500}}),/Некорректная/);
  M.ensure(doc).settings.calendarMappings={abc:'invalid'};
  assert.throws(()=>M.validatePersonalMetrics(doc),/Некорректный раздел/);
});
