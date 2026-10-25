// Disposable browser contexts only; changes in the showcase must never reach storage or native/LAN saves.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/maksimefimov/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url=process.env.SHOWCASE_URL||'http://127.0.0.1:5225',key='my-home-inventory:v1',tourKey=key+':demo-tour-v1';
(async()=>{
 const I=await import(pathToFileURL(path.resolve('web/src/inventory/model.js'))),plan=JSON.parse(fs.readFileSync('web/public/plans/home.json','utf8'));
 const seed=I.createHome(I.demo(plan));seed.settings.categorySetup={version:1,status:'skipped',packIds:[]};
 I.newNode(seed,{name:'Личная вещь · контроль',parentId:I.UNPLACED_ID});
 const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],writes=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const r=route.request();if(r.method()==='POST')writes.push(r.url());if(!r.url().startsWith(url)&&/^https?:/.test(r.url()))return route.abort();return route.continue();});
  await page.addInitScript(({key,seed})=>{if(window===window.top&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key,seed});
  await page.goto(url);await page.locator('.dt-dialog').waitFor();
  await page.locator('.dt-step').last().click();
  await page.getByRole('button',{name:'Посмотреть живое демо',exact:true}).click();
  const demo=page.locator('.sc-dialog'),picker=demo.getByRole('combobox',{name:'Раздел демонстрации'});
  await picker.waitFor();await page.waitForFunction(()=>!document.querySelector('.sc-guide select').disabled);
  const frame=page.frames().find(f=>f.url().includes('demo=showcase'));assert.ok(frame);
  const base=await page.evaluate(()=>window.__inventory.document),stored=await page.evaluate(key=>localStorage.getItem(key),key);
  const doc=await frame.evaluate(()=>window.__inventory.document);
  assert.equal(doc.demoProfile.type,'showcase');assert.ok(doc.nodes.length>100);assert.ok(doc.automobiles.vehicles.length>=2);
  assert.equal(doc.monitoring.apartments.length,1);assert.equal(doc.personalMetrics.entries.length,21);assert.ok(doc.travel.trips.length);
  assert.ok(!JSON.stringify(doc).includes('Личная вещь · контроль'));
  assert.equal(await frame.evaluate(key=>localStorage.getItem(key),key),null);
  fs.mkdirSync('docs/images',{recursive:true});
  await frame.locator('.iv-scene canvas').first().waitFor({timeout:15000});
  await page.screenshot({path:'docs/images/showcase-apartment.png'});
  const options=await picker.locator('option').allTextContents();assert.ok(options.length>=30);
  for(let i=0;i<options.length;i++){
   await picker.selectOption(String(i));
   assert.ok(!(await demo.locator('.sc-status').textContent()).includes('не открылся'),options[i]);
   if(options[i].includes('Демо-автомобиль'))await page.screenshot({path:'docs/images/showcase-car.png'});
   if(options[i].includes('Редактор')){await frame.locator('.iv-editor').waitFor();const editor=frame.childFrames()[0];await editor.waitForFunction(()=>window.__LIFE_ASSISTANT_SHOWCASE__);assert.equal(await editor.evaluate(key=>localStorage.getItem(key),key),null);}
  }
  // Exercise real mutation paths: additions and editor saves remain ephemeral.
  await frame.evaluate(async()=>{
   const {newNode,UNPLACED_ID}=await import('/src/inventory/model.js');
   window.__inventory.showcaseGo({section:'editor'});
   const pending=structuredClone(window.__inventoryPlan);pending.name='Изменённая демо-квартира';await window.__inventorySavePlan(pending);
   window.__inventoryCloseEditor();
  });
  assert.equal(await frame.evaluate(()=>window.__inventory.document.plan.name),'Изменённая демо-квартира');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),stored);
  assert.deepEqual(await page.evaluate(()=>window.__inventory.document),base);
  await page.setViewportSize({width:390,height:844});await picker.selectOption('0');
  assert.ok(await demo.evaluate(el=>{const r=el.getBoundingClientRect(),f=el.querySelector('.sc-footer').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&f.bottom<=innerHeight;}));
  await page.screenshot({path:'docs/images/showcase-mobile.png'});
  await page.getByRole('button',{name:'Завершить демо',exact:true}).click();await demo.waitFor({state:'detached'});
  assert.ok(!page.frames().some(f=>f.url().includes('demo=showcase')));
  assert.deepEqual(await page.evaluate(()=>window.__inventory.document),base);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),stored);
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).status,tourKey),'completed');
  await page.reload();await page.waitForFunction(()=>window.__inventory);assert.equal(await demo.count(),0);
  await page.getByRole('button',{name:'Включить светлую тему',exact:true}).click();
  await page.getByRole('button',{name:'Меню',exact:true}).click();await page.getByRole('button',{name:'Настройки',exact:true}).click();
  await page.getByRole('tab',{name:'Приложение',exact:true}).click();
  await page.getByRole('button',{name:'Посмотреть демо-квартиру и разделы',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.sc-guide select').disabled);
  const replay=page.frames().find(f=>f.url().includes('demo=showcase'));
  assert.equal(await replay.evaluate(()=>window.__inventory.document.plan.name),'Демо-квартира');
  assert.equal(await replay.evaluate(()=>document.documentElement.dataset.inventoryTheme),'light');
  await page.setViewportSize({width:1440,height:1050});
  await page.screenshot({path:'docs/images/showcase-light.png'});
  // Reload during the demo resumes it with fresh examples; exit then removes it again.
  await page.reload();await page.waitForFunction(()=>document.querySelector('.sc-guide select')&&!document.querySelector('.sc-guide select').disabled);
  await page.getByRole('button',{name:'Завершить демо',exact:true}).click();await demo.waitFor({state:'detached'});
  // Simulate native and LAN flags in a showcase: neither bridge calls nor LAN requests may occur.
  const guarded=await context.newPage();guarded.on('pageerror',e=>errors.push(e.message));
  await guarded.addInitScript(seed=>{window.__HOUSE_LAN__=true;window.__HOUSE_BOOT__={mode:'inventory',inventory:seed,inventorySettings:{lastBackupAt:'2026-10-25'}};window.__nativeCalls=[];window.webkit={messageHandlers:{house:{postMessage:m=>window.__nativeCalls.push(m)}}};},seed);
  await guarded.goto(url+'/?demo=showcase');await guarded.waitForFunction(()=>window.__inventory);
  assert.equal(await guarded.evaluate(()=>window.__inventory.document.demoProfile.type),'showcase');
  assert.deepEqual(await guarded.evaluate(()=>window.__nativeCalls),[]);
  await guarded.evaluate(async()=>{window.__inventory.showcaseGo({section:'editor'});const plan=structuredClone(window.__inventoryPlan);plan.name='Демо в Mac';await window.__inventorySavePlan(plan);window.__inventoryCloseEditor();});
  assert.deepEqual(await guarded.evaluate(()=>window.__nativeCalls),[]);
  // A truly new user returns to an empty home, never to the old default demo seed.
  const cleanContext=await browser.newContext(),clean=await cleanContext.newPage();
  await clean.goto(url);await clean.locator('.dt-dialog').waitFor();
  await clean.locator('.dt-step').last().click();await clean.getByRole('button',{name:'Посмотреть живое демо',exact:true}).click();
  await clean.waitForFunction(()=>document.querySelector('.sc-guide select')?.disabled===false);
  await clean.getByRole('button',{name:'Завершить демо',exact:true}).click();
  await clean.locator('.cw-dialog').waitFor();await clean.getByRole('button',{name:'Настроить позже',exact:true}).click();await clean.locator('.cw-dialog').waitFor({state:'detached'});
  const empty=await clean.evaluate(()=>window.__inventory.document);
  assert.equal(empty.nodes.filter(n=>n.kind==='item'||n.kind==='furniture').length,0);
  assert.equal(empty.automobiles?.vehicles.length||0,0);assert.equal(empty.monitoring?.apartments.length||0,0);
  assert.equal(empty.personalMetrics?.entries.length||0,0);assert.equal(empty.travel?.trips.length||0,0);
  await clean.reload();await clean.waitForFunction(()=>window.__inventory);assert.equal(await clean.locator('dialog[open]').count(),0);
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  console.log(`Showcase UI passed: ${options.length} screens, real 3D apartment and cars, populated tabs, ephemeral editor saves, mobile, replay/resume, removal, native/LAN isolation, unchanged personal storage.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
