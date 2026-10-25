import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const runtime=fs.readFileSync(new URL('./inventory/demo-runtime.js',import.meta.url),'utf8').replaceAll('export ','');
const source=runtime+'\n'+fs.readFileSync(new URL('./bridge.js',import.meta.url),'utf8').replace(/^import .*demo-runtime.js';$/m,'').replaceAll('export ','');
function frame(messages,parent,showcase=false){const location={search:showcase?'?demo=showcase':''},window={location,webkit:{messageHandlers:{house:{postMessage:m=>messages.push(m)}}}};window.parent=parent||window;const context=vm.createContext({window,URLSearchParams,location});vm.runInContext(source,context);return context;}
test('editor import and main-frame requests have distinct IDs and resolve in the right caller',async()=>{
 const messages=[],main=frame(messages),child=frame(messages,main.window);
 const parentCall=vm.runInContext("call('inventorySystemStatus')",main),childCall=vm.runInContext("call('importPlan')",child);
 assert.equal(messages.length,2);assert.notEqual(messages[0].callId,messages[1].callId);
 main.window.house.reply(messages[1].callId,{config:{name:'Imported'}});assert.equal((await childCall).config.name,'Imported');
 main.window.house.reply(messages[0].callId,{login:'off'});assert.equal((await parentCall).login,'off');
 const cancelled=vm.runInContext("call('importPlan')",child);main.window.house.reply(messages.at(-1).callId,{cancelled:true});assert.equal((await cancelled).cancelled,true);
 const failure=vm.runInContext("call('exportPlan')",child);main.window.house.reply(messages.at(-1).callId,{error:'Disk full'});await assert.rejects(failure,/Disk full/);
});
test('showcase cannot send native messages or forward calls into its real parent',async()=>{
 const messages=[],main=frame(messages),demo=frame(messages,main.window,true);
 assert.equal(vm.runInContext('isNative',demo),false);
 vm.runInContext("post('saveInventory',{document:{demo:true}})",demo);
 await assert.rejects(vm.runInContext("call('saveInventory')",demo),/Доступно только/);
 assert.equal(messages.length,0);
 // An editor embedded inside the demo inherits isolation even without a query parameter.
 const editor=frame(messages,demo.window);
 assert.equal(vm.runInContext('isNative',editor),false);
 await assert.rejects(vm.runInContext("call('inventoryExport')",editor),/Доступно только/);
 assert.equal(messages.length,0);
});
test('showcase storage is memory-only and disappears with a fresh frame',()=>{
 const messages=[],demo=frame(messages,null,true);
 vm.runInContext("window.localStorage.setItem('my-home-inventory:v1','sample')",demo);
 assert.equal(demo.window.localStorage.getItem('my-home-inventory:v1'),'sample');
 const fresh=frame(messages,null,true);
 assert.equal(fresh.window.localStorage.getItem('my-home-inventory:v1'),null);
 assert.equal(fresh.window.sessionStorage.length,0);
});
