// Disposable browser profile and invented data; never reads the user's stored inventory.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const I=await import(pathToFileURL(path.resolve('web/src/inventory/model.js'))), A=await import(pathToFileURL(path.resolve('web/src/inventory/awards.js')));
 const doc=I.createHome(I.demo(JSON.parse(fs.readFileSync('web/public/plans/home.json','utf8'))));
 doc.settings.categorySetup={version:1,status:'completed',packIds:[],excludedCategories:[],excludedCollections:[]};
 const room=doc.nodes.find(n=>n.kind==='room'&&!n.virtual);
 for(let i=0;i<100;i++)I.newNode(doc,{name:'Проверочная вещь '+i,parentId:room.id,...(i<30?{photo:'data:image/png;base64,iVBORw0KGgo=',purchaseCents:1000,fields:{Материал:'Хлопок'}}:{})});
 const today=A.awardToday(),day=(offset)=>{const d=new Date(today+'T12:00:00');d.setDate(d.getDate()+offset);return A.awardToday(d);};
 doc.awards={activity:Array.from({length:183},(_,i)=>({date:day(i-182)})).filter((_,i)=>i%6!==0)};
 A.syncAwards(doc,{}, {now:new Date().toISOString(),visitDay:today});
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(d=>{if(!localStorage.getItem('my-home-inventory:v1'))localStorage.setItem('my-home-inventory:v1',JSON.stringify(d));},doc);
  await page.goto(process.env.AWARDS_URL||'http://127.0.0.1:5221');
  await page.waitForFunction(()=>window.__inventory);
  await page.evaluate(()=>window.__inventory.go('awards'));
  await page.locator('.aw-grid').waitFor();
  assert.equal(await page.locator('.aw-card').count(),68);
  assert.equal(await page.locator('.aw-concealed').count(),7);
  assert.ok(await page.locator('.aw-card.earned').count()>5);
  assert.equal(await page.locator('.aw-concealed progress').count(),0);
  const concealed=await page.locator('.aw-concealed').allTextContents();
  for(const text of concealed){assert.ok(!text.includes('Матрёшка'));assert.ok(!text.includes('180'));}
  await page.getByRole('combobox',{name:'Редкость наград'}).selectOption('legendary');
  assert.ok(await page.locator('.aw-card').count()>5);assert.equal(await page.locator('.aw-concealed').count(),0);
  await page.getByRole('combobox',{name:'Редкость наград'}).selectOption('all');
  await page.getByRole('combobox',{name:'Состояние наград'}).selectOption('secret');assert.equal(await page.locator('.aw-card').count(),7);
  await page.getByRole('combobox',{name:'Состояние наград'}).selectOption('all');
  await page.getByRole('searchbox',{name:'Найти награду',exact:true}).fill('Матрёшка');assert.equal(await page.locator('.aw-card').count(),0);
  await page.getByRole('searchbox',{name:'Найти награду',exact:true}).fill('');
  await page.locator('.aw-tabs').getByRole('button',{name:/Личные метрики/}).click();assert.equal(await page.locator('.aw-card').count(),9);
  await page.locator('.aw-tabs').getByRole('button',{name:/Все разделы/}).click();
  const heights=await page.locator('.aw-card').evaluateAll(cards=>cards.slice(0,3).map(c=>c.getBoundingClientRect().height));assert.ok(Math.max(...heights)-Math.min(...heights)<1);
  fs.mkdirSync('docs/images',{recursive:true});
  await page.screenshot({path:path.resolve('docs/images/awards-0.4.66-dark.png')});
  await page.getByRole('button',{name:'Включить светлую тему',exact:true}).click();
  await page.screenshot({path:path.resolve('docs/images/awards-0.4.66-light.png')});
  assert.equal(await page.locator('.aw-card').count(),68);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await page.locator('.aw-card').evaluateAll(cards=>cards.every(c=>c.getBoundingClientRect().right<=innerWidth)));
  await page.screenshot({path:path.resolve('docs/images/awards-0.4.66-mobile.png')});
  await page.getByRole('combobox',{name:'Состояние наград'}).selectOption('earned');const earned=await page.locator('.aw-card').count();assert.ok(earned>5);
  await page.reload();await page.waitForFunction(()=>window.__inventory);await page.evaluate(()=>window.__inventory.go('awards'));
  await page.getByRole('combobox',{name:'Состояние наград'}).selectOption('earned');assert.equal(await page.locator('.aw-card').count(),earned);
  await page.evaluate(({today})=>{
   const d=JSON.parse(localStorage.getItem('my-home-inventory:v1'));
   d.personalMetrics={version:1,entries:Array.from({length:30},(_,i)=>{const day=new Date(today+'T12:00:00');day.setDate(day.getDate()-i);return {date:day.toISOString().slice(0,10),mood:3,energy:null,tension:null,productivity:null,busyMinutes:null,note:'Проверочная заметка',updatedAt:new Date().toISOString()};}),health:[],settings:{dailyPrompt:false,skippedOn:null}};
   localStorage.setItem('my-home-inventory:v1',JSON.stringify(d));
  },{today});
  await page.reload();await page.waitForFunction(()=>window.__inventory);await page.evaluate(()=>window.__inventory.go('awards'));
  await page.getByRole('combobox',{name:'Состояние наград'}).selectOption('secret');
  assert.equal(await page.locator('.aw-card').count(),7);assert.equal(await page.locator('.aw-concealed').count(),6);
  await page.getByRole('heading',{name:'Между строк',exact:true}).waitFor();
  assert.equal(await page.locator('.aw-card.earned').count(),1);
  assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('my-home-inventory:v1')).awards.earned['journal-notes-30']));
  assert.deepEqual(errors,[]);
  console.log('Awards UI passed: badges, six rarities, secret masking and search, all groups, filtering, persistence, equal heights, light/dark and mobile.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
