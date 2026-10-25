import test from 'node:test';
import assert from 'node:assert/strict';
import {minutesForEvents} from './calendar-model.js';

test('calendar suggestion merges overlapping appointments and respects unchecked events',()=>{
  const events=[
    {id:'a',start:'2026-10-25T09:00:00+03:00',end:'2026-10-25T10:00:00+03:00'},
    {id:'b',start:'2026-10-25T09:30:00+03:00',end:'2026-10-25T11:00:00+03:00'},
    {id:'c',start:'2026-10-25T12:00:00+03:00',end:'2026-10-25T12:45:00+03:00'},
  ];
  assert.equal(minutesForEvents(events),165);
  assert.equal(minutesForEvents(events,new Set(['a','c'])),105);
});
