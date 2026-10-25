import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAppleHealthXML } from './health-import.js';

function xmlFile(contents,chunkSize=13,name='export.xml') {
  const bytes=new TextEncoder().encode(contents);
  return {name,async *stream(){for(let i=0;i<bytes.length;i+=chunkSize)yield bytes.slice(i,i+chunkSize);}};
}

test('Apple Health XML parses across stream chunks and avoids duplicate step sources', async () => {
  const xml=`<?xml version="1.0"?><HealthData>
    <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-10-25 10:00:00 +0300" endDate="2026-10-25 10:01:00 +0300" value="3000"/>
    <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-10-25 18:00:00 +0300" endDate="2026-10-25 18:01:00 +0300" value="2000"/>
    <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Watch" unit="count" startDate="2026-10-25 10:00:00 +0300" endDate="2026-10-25 10:01:00 +0300" value="4500"/>
    <Record type="HKQuantityTypeIdentifierAppleExerciseTime" sourceName="Watch" unit="min" startDate="2026-10-25 12:00:00 +0300" endDate="2026-10-25 12:30:00 +0300" value="30"/>
    <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="2026-10-24 23:00:00 +0300" endDate="2026-10-25 06:00:00 +0300" value="HKCategoryValueSleepAnalysisAsleepCore"/>
    <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="2026-10-25 06:00:00 +0300" endDate="2026-10-25 07:00:00 +0300" value="HKCategoryValueSleepAnalysisAwake"/>
  </HealthData>`;
  const rows=await parseAppleHealthXML(xmlFile(xml),{since:'2026-10-24'});
  assert.deepEqual(rows,[{date:'2026-10-25',sleepMinutes:420,steps:5000,activityMinutes:30,source:'apple-health-export'}]);
});

test('invalid file and unrelated records are rejected', async () => {
  await assert.rejects(parseAppleHealthXML(xmlFile('<HealthData/>',8,'export.zip')),/export.xml/);
  await assert.rejects(parseAppleHealthXML(xmlFile('<HealthData/>')),/не найдены записи/);
});
