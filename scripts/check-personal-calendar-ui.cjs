// Simulates the authenticated phone connection with a disposable document.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{channel:'chrome'})});
  try{
    const base=process.env.METRICS_URL||'http://127.0.0.1:5215';
    const preview=await browser.newPage();await preview.goto(base+'/?section=personal-metrics');await preview.waitForFunction(()=>window.__inventory);
    let document=await preview.evaluate(()=>window.__inventory.document);await preview.close();
    const context=await browser.newContext({viewport:{width:1200,height:850}});
    await context.addInitScript(()=>{window.__HOUSE_LAN__=true;});
    await context.route('**/api/state',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({revision:document.revision,document})}));
    await context.route('**/api/save',async route=>{
      const body=route.request().postDataJSON();
      if(body.expectedRevision!==document.revision)return route.fulfill({status:409,contentType:'application/json',body:'{"error":"version conflict"}'});
      document=body.document;
      return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,revision:document.revision})});
    });
    await context.route('**/api/metrics/calendar/list',route=>route.fulfill({contentType:'application/json',body:'{"calendars":[{"id":"work","title":"Рабочий календарь"}]}'}));
    await context.route('**/api/metrics/calendar/day',route=>{
      const day=route.request().postDataJSON().day;
      const events=[
        {id:'one',calendarId:'work',title:'Встреча',start:`${day}T09:00:00+03:00`,end:`${day}T10:00:00+03:00`},
        {id:'two',calendarId:'work',title:'Работа',start:`${day}T09:30:00+03:00`,end:`${day}T11:00:00+03:00`},
      ];
      return route.fulfill({contentType:'application/json',body:JSON.stringify({events})});
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/?section=personal-metrics');await page.waitForFunction(()=>window.__inventory);
    if(await page.locator('.dt-dialog[open]').count())await page.locator('.dt-dialog').getByRole('button',{name:'Пропустить обзор'}).click();
    await page.locator('.pm-tabs').getByRole('button',{name:'Источники'}).click();
    await page.getByRole('button',{name:'Выбрать календари'}).click();
    await page.getByLabel('Учитывать Рабочий календарь').check();
    await page.getByRole('button',{name:'Сохранить выбор'}).click();
    await page.waitForFunction(()=>window.__inventory.document.personalMetrics?.settings.calendarIds?.length===1);
    await page.getByRole('button',{name:'Заполнить сегодня'}).click();
    const survey=()=>page.locator('.pm-survey-inline');
    for(const answer of ['Хорошо','Средне','Немного','Хорошо'])await survey().getByRole('button',{name:answer,exact:true}).click();
    await survey().getByRole('button',{name:'Применить подсказку'}).waitFor();
    assert.match(await survey().innerText(),/2 событий/);
    await survey().getByRole('button',{name:'Применить подсказку'}).click();
    await survey().getByRole('button',{name:'Далее'}).click();
    await survey().getByRole('button',{name:'Умеренно'}).click();
    await survey().getByRole('button',{name:'Хорошо'}).click();
    await survey().getByRole('button',{name:'Сохранить отметку'}).click();
    await page.waitForFunction(()=>window.__inventory.document.personalMetrics?.entries.length===1);
    const entry=await page.evaluate(()=>window.__inventory.document.personalMetrics.entries[0]);
    assert.equal(entry.timeBreakdown.work,120);assert.equal(entry.timeSource,'calendar');
    assert.ok(!JSON.stringify(document.personalMetrics).includes('Встреча'));
    assert.deepEqual(errors,[]);
    console.log('Calendar UI: selected source, overlapping events, daily confirmation and private titles passed.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
