// Isolated browser contexts with invented data. Never opens the user's browser profile.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/maksimefimov/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const key='my-home-inventory:v1',tourKey=key+':demo-tour-v1';
(async()=>{
  const M=await import(pathToFileURL(path.resolve('web/src/inventory/model.js')));
  const seed=M.createHome(M.demo(JSON.parse(fs.readFileSync('web/public/plans/home.json','utf8'))));
  seed.settings.categorySetup={version:1,status:'skipped',packIds:[]};
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const errors=[];
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(({seed,key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{seed,key});
    await page.goto(process.env.DEMO_TOUR_URL||'http://127.0.0.1:5225');
    const tour=page.locator('.dt-dialog');
    await tour.waitFor();assert.equal(await tour.locator('.dt-step').count(),10);
    assert.equal(await tour.locator('.dt-counter').textContent(),'Карточка 1 из 10');
    assert.equal(await tour.getByRole('button',{name:'Назад',exact:true}).isDisabled(),true);
    const before=await page.evaluate(()=>window.__inventory.document);
    fs.mkdirSync('docs/images',{recursive:true});
    await page.screenshot({path:'docs/images/demo-tour-dark.png'});
    await tour.getByRole('button',{name:'Далее',exact:true}).click();
    await tour.getByRole('button',{name:'Далее',exact:true}).click();
    await page.reload();await tour.waitFor();
    assert.equal(await tour.locator('.dt-counter').textContent(),'Карточка 3 из 10');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await tour.locator('.dt-counter').textContent(),'Карточка 2 из 10');
    await page.keyboard.press('ArrowRight');
    assert.equal(await tour.locator('.dt-counter').textContent(),'Карточка 3 из 10');
    for(let i=0;i<10;i++){
      await tour.locator('.dt-step').nth(i).click();
      assert.equal(await tour.locator('.dt-counter').textContent(),`Карточка ${i+1} из 10`);
      assert.equal(await tour.locator('.dt-instructions li').count(),3);
      assert.equal(await tour.locator('#dt-title').evaluate(el=>document.activeElement===el),true);
    }
    await tour.getByRole('button',{name:'Посмотреть живое демо',exact:true}).click();
    await tour.waitFor({state:'detached'});
    await page.locator('.sc-dialog').waitFor();
    await page.getByRole('button',{name:'Завершить демо',exact:true}).click();
    await page.locator('.sc-dialog').waitFor({state:'detached'});
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).status,tourKey),'completed');
    assert.deepEqual(await page.evaluate(()=>window.__inventory.document),before);
    await page.reload();await page.waitForFunction(()=>window.__inventory);
    assert.equal(await tour.count(),0);
    await page.getByRole('button',{name:'Настройки',exact:true}).click();
    await page.getByRole('tab',{name:'Приложение',exact:true}).click();
    await page.getByRole('button',{name:'Включить демо-режим',exact:true}).click();
    assert.equal(await tour.locator('.dt-counter').textContent(),'Карточка 1 из 10');
    // App-wide shortcuts must not steal focus from the modal guide.
    await page.keyboard.press('Meta+k');
    assert.equal(await tour.evaluate(el=>el.contains(document.activeElement)),true);
    await page.keyboard.press('Escape');await tour.waitFor({state:'detached'});
    assert.equal(await page.getByRole('button',{name:'Включить демо-режим',exact:true}).evaluate(el=>document.activeElement===el),true);
    await page.reload();await page.waitForFunction(()=>window.__inventory);assert.equal(await tour.count(),0);
    await page.getByRole('button',{name:'Включить светлую тему',exact:true}).click();
    await page.getByRole('button',{name:'Настройки',exact:true}).click();
    await page.getByRole('tab',{name:'Приложение',exact:true}).click();
    await page.getByRole('button',{name:'Включить демо-режим',exact:true}).click();
    await page.screenshot({path:'docs/images/demo-tour-light.png'});
    await page.setViewportSize({width:390,height:844});
    for(let i=0;i<10;i++){
      await tour.locator('.dt-step').nth(i).click();
      const bounds=await tour.evaluate(el=>{const r=el.getBoundingClientRect(),f=el.querySelector('.dt-footer').getBoundingClientRect(),b=el.querySelector('.dt-body');return {left:r.left,right:r.right,bottom:r.bottom,footer:f.bottom,overflow:b.scrollWidth>b.clientWidth};});
      assert.ok(bounds.left>=0&&bounds.right<=390&&bounds.bottom<=844&&bounds.footer<=844&&!bounds.overflow,JSON.stringify(bounds));
    }
    await page.screenshot({path:'docs/images/demo-tour-mobile.png'});
    await tour.getByRole('button',{name:'Пропустить обзор',exact:true}).click();
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).status,tourKey),'skipped');
    // First launch must show one dialog at a time, with category setup following the guide.
    const fresh=await browser.newContext(),first=await fresh.newPage();
    first.on('pageerror',e=>errors.push(e.message));
    const withoutSetup=structuredClone(seed);delete withoutSetup.settings.categorySetup;
    await first.addInitScript(({key,doc})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(doc));},{key,doc:withoutSetup});
    await first.goto(process.env.DEMO_TOUR_URL||'http://127.0.0.1:5225');
    await first.locator('.dt-dialog').waitFor();assert.equal(await first.locator('dialog[open]').count(),1);assert.equal(await first.locator('.cw-dialog').count(),0);
    await first.getByRole('button',{name:'Пропустить обзор',exact:true}).click();
    await first.locator('.cw-dialog').waitFor();assert.equal(await first.locator('dialog[open]').count(),1);
    await first.getByRole('button',{name:'Настроить позже',exact:true}).click();
    await first.locator('.cw-dialog').waitFor({state:'detached'});
    await first.reload();await first.waitForFunction(()=>window.__inventory);assert.equal(await first.locator('dialog[open]').count(),0);
    assert.deepEqual(errors,[]);
    console.log('Demo tour UI passed: 10 cards, progress restore, completion, skip/Escape, settings replay, unchanged inventory, keyboard focus, light/dark, mobile, category setup order.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
