import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./bridge.js',import.meta.url),'utf8').replaceAll('export ','');
function frame(messages,parent){const window={webkit:{messageHandlers:{house:{postMessage:m=>messages.push(m)}}}};window.parent=parent||window;const context=vm.createContext({window,URLSearchParams,location:{search:''}});vm.runInContext(source,context);return context;}
test('editor import and main-frame requests have distinct IDs and resolve in the right caller',async()=>{
 const messages=[],main=frame(messages),child=frame(messages,main.window);
 const parentCall=vm.runInContext("call('inventorySystemStatus')",main),childCall=vm.runInContext("call('importPlan')",child);
 assert.equal(messages.length,2);assert.notEqual(messages[0].callId,messages[1].callId);
 main.window.house.reply(messages[1].callId,{config:{name:'Imported'}});assert.equal((await childCall).config.name,'Imported');
 main.window.house.reply(messages[0].callId,{login:'off'});assert.equal((await parentCall).login,'off');
 const cancelled=vm.runInContext("call('importPlan')",child);main.window.house.reply(messages.at(-1).callId,{cancelled:true});assert.equal((await cancelled).cancelled,true);
 const failure=vm.runInContext("call('exportPlan')",child);main.window.house.reply(messages.at(-1).callId,{error:'Disk full'});await assert.rejects(failure,/Disk full/);
});
