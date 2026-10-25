import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from './model.js';
import {dayShift,series,summary} from './insights.js';

test('seven-day trend keeps unanswered days empty and compares previous period',()=>{
  const doc={};
  M.putEntry(doc,{date:'2026-10-24',mood:4,productivity:3,timeBreakdown:{work:240,chores:60,commute:30,other:0},rest:4,causes:['work'],recovery:['walk']});
  M.putEntry(doc,{date:'2026-10-25',mood:2,productivity:4,timeBreakdown:{work:360,chores:0,commute:60,other:0},rest:2,causes:['work','sleep']});
  M.putEntry(doc,{date:'2026-10-17',mood:5});
  M.putHealth(doc,{date:'2026-10-25',sleepMinutes:420,steps:7000,source:'manual'});
  M.putWeight(doc,{date:'2026-10-25',kg:72.5});
  const mood=series(doc,'mood',7,'2026-10-25');
  assert.equal(mood.length,7);assert.deepEqual(mood.slice(-3).map(row=>row.value),[null,4,2]);
  const week=summary(doc,7,'2026-10-25');
  assert.equal(week.metrics.mood.value,3);assert.equal(week.metrics.mood.previous,5);
  assert.equal(week.metrics.mood.count,2);assert.equal(week.metrics.sleepMinutes.value,420);
  assert.equal(week.time.work.minutes,600);assert.deepEqual(week.causes[0],['work',2]);
  assert.equal(week.metrics.weightKg.value,72.5);
});

test('day arithmetic crosses month, year and leap day',()=>{
  assert.equal(dayShift('2026-01-01',-1),'2025-12-31');
  assert.equal(dayShift('2024-03-01',-1),'2024-02-29');
});
