// Run against a local Vite server. Playwright creates a separate, disposable browser profile.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const path=require('node:path');

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{channel:'chrome'})});
  try {
    const context=await browser.newContext({viewport:{width:1360,height:900}});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto((process.env.METRICS_URL||'http://127.0.0.1:5215')+'/?section=personal-metrics');
    await page.waitForFunction(()=>window.__inventory);
    assert.equal(await page.locator('.pm-card').count(),6);
    const dialog=()=>page.locator('dialog[open]').last();
    await dialog().waitFor();
    for(const answer of ['Хорошо','Средне','Немного','Хорошо','8 ч']){
      await dialog().getByRole('button',{name:answer,exact:true}).click();
    }
    await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
    const saved=await page.evaluate(()=>window.__inventory.document.personalMetrics.entries);
    assert.equal(saved.length,1);
    assert.deepEqual([saved[0].mood,saved[0].energy,saved[0].tension,saved[0].productivity,saved[0].busyMinutes],[4,3,2,4,480]);
    await page.locator('.pm-tabs').getByRole('button',{name:'История',exact:true}).click();
    assert.equal(await page.locator('.pm-history-row').count(),1);
    await page.locator('.pm-tabs').getByRole('button',{name:'Источники',exact:true}).click();
    const xml='<?xml version="1.0"?><HealthData><Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="'+saved[0].date+' 10:00:00 +0300" endDate="'+saved[0].date+' 10:05:00 +0300" value="8123"/></HealthData>';
    await page.locator('.pm-file').setInputFiles({name:'export.xml',mimeType:'text/xml',buffer:Buffer.from(xml)});
    await page.waitForFunction(()=>window.__inventory.document.personalMetrics.health.length===1);
    assert.equal(await page.evaluate(()=>window.__inventory.document.personalMetrics.health[0].steps),8123);
    await page.reload();await page.waitForFunction(()=>window.__inventory);
    assert.equal(await page.locator('dialog[open]').count(),0);
    assert.match((await page.locator('.pm-cards').innerText()).replace(/\u00a0/g,' '),/8 123 шагов/);
    await page.screenshot({path:path.resolve('docs/images/personal-metrics-overview.png')});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.resolve('docs/images/personal-metrics-mobile.png')});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('.pm-tabs').getByRole('button',{name:'Источники',exact:true}).click();
    await page.getByRole('button',{name:'Внести вручную',exact:true}).click();
    await dialog().getByLabel('Шаги',{exact:true}).fill('9000');
    await dialog().getByRole('button',{name:'Сохранить',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
    await page.locator('.pm-file').setInputFiles({name:'export.xml',mimeType:'text/xml',buffer:Buffer.from(xml)});
    await page.locator('.iv-toast').getByText('Из Apple Health загружено дней: 1').waitFor();
    assert.deepEqual(await page.evaluate(()=>{const h=window.__inventory.document.personalMetrics.health[0];return [h.steps,h.source];}),[9000,'manual']);
    assert.deepEqual(errors,[]);
    console.log('Personal metrics UI: daily questionnaire, history, Apple Health XML, persistence and mobile passed.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
