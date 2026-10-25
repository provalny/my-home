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
