const assert = require('node:assert/strict');
const {chromium} = require('/Users/maksimefimov/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const context=await browser.newContext({viewport:{width:1480,height:1000}}),p=await context.newPage(),errors=[],requests=[];
  let connected=false;const fakeKey='tvly-test-connection-placeholder';
  p.on('pageerror',e=>errors.push(e.stack));
  await p.route('**/api/item-master/*',async route=>{
   const body=route.request().postDataJSON();requests.push(body);assert.ok(!JSON.stringify(body).includes('PRIVATE'));
   if(route.request().url().endsWith('/connection')){
    if(body.action==='connect'){assert.equal(body.apiKey,fakeKey);connected=true;}
    if(body.action==='disconnect')connected=false;
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({connected,canManage:true,storage:'server-session',budget:connected?{limit:1000,used:100,remaining:900}:null})});
   }
   if(route.request().url().endsWith('/search')){
    assert.deepEqual(Object.keys(body).sort(),['domains','input']);assert.deepEqual(Object.keys(body.input).sort(),['brand','model','name']);
    if(body.input.model==='E00')return route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'Достигнут лимит бесплатного поиска. Попробуйте позже.'})});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:body.input.model==='A00'?[]:[{title:'Тестовый рюкзак X20',url:'https://example.com/product-x20',raw_content:null}]})});
   }
   assert.deepEqual(Object.keys(body),['url']);
   const html='<script type="application/ld+json">'+JSON.stringify({'@type':'ProductGroup',hasVariant:['Red','Blue'].map((color,i)=>({'@type':'Product',name:'Тестовый рюкзак '+(body.url.includes('a00')?'A00':'X20')+' '+color,mpn:'EX-'+(body.url.includes('a00')?'A00':'X20')+'-'+color,weight:{value:650+i*50,unitCode:'GRM'},additionalProperty:[{name:'Packed dimensions',value:'20 x 10 x 5 cm'}]}))})+'</script>';
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({url:body.url,text:html})});
  });
  const base=process.env.ITEM_MASTER_URL||'http://127.0.0.1:5234';
  await p.goto(base+'/?section=item-master&demo=item-master');await p.waitForFunction(()=>window.__inventory);await p.getByRole('button',{name:'Пропустить обзор',exact:true}).click();
  const ids=await p.evaluate(async()=>{
   const M=await import('/src/inventory/model.js'),d=window.__inventory.document;d.settings.motion='off';
   const added=['X20','A00','E00'].map(model=>M.newNode(d,{name:'Тестовый рюкзак '+model,parentId:M.UNPLACED_ID,fields:{'Бренд':'Example','Модель':model,'Вес, г':'700'},notes:'PRIVATE',quantity:2}));
   localStorage.setItem('my-home-inventory:v1:item-master-demo-v1',JSON.stringify(d));return added.map(n=>n.id);
  });
  await p.reload();await p.waitForFunction(()=>window.__inventory);
  await p.getByRole('button',{name:'Подключить Tavily',exact:true}).click();
  const setup=()=>p.locator('dialog[open]').last();
  assert.equal(await setup().getByLabel('API-ключ Tavily',{exact:true}).getAttribute('type'),'password');
  await setup().getByLabel('API-ключ Tavily',{exact:true}).fill('bad');await setup().getByRole('button',{name:'Проверить и подключить',exact:true}).click();await setup().getByRole('status').filter({hasText:'tvly-'}).waitFor();
  await setup().getByLabel('API-ключ Tavily',{exact:true}).fill(fakeKey);await setup().getByRole('button',{name:'Проверить и подключить',exact:true}).click();
  await setup().getByRole('button',{name:'Отключить Tavily',exact:true}).waitFor();
  assert.equal(await setup().getByLabel('API-ключ Tavily',{exact:true}).inputValue(),'');
  assert.equal(await p.evaluate(key=>Object.values(localStorage).some(v=>v.includes(key)),fakeKey),false);
  assert.equal(await p.evaluate(key=>JSON.stringify(window.__inventory.document).includes(key),fakeKey),false);
  await setup().getByRole('button',{name:'Готово',exact:true}).click();
  await p.reload();await p.getByRole('button',{name:'Настроить Tavily',exact:true}).waitFor();
  const search=p.getByRole('searchbox',{name:'Поиск в мастере предметов'});await search.fill('X20');
  await p.getByRole('checkbox',{name:'Выбрать: Тестовый рюкзак X20',exact:true}).check();
  await p.getByRole('button',{name:'Искать выбранные',exact:true}).click();
  await p.waitForFunction(id=>window.__inventory.document.nodes.find(n=>n.id===id).itemResearch,ids[0]);
  assert.equal(await p.getByRole('radio').count(),2);await p.getByRole('radio',{name:'Выбрать модель: Тестовый рюкзак X20 Red',exact:true}).check();
  await p.getByRole('button',{name:'Сравнить и применить',exact:true}).click();
  const dialog=()=>p.locator('dialog[open]').last();
  assert.equal(await dialog().getByRole('checkbox',{name:'Тестовый рюкзак X20 · Вес, г',exact:true}).isChecked(),false);
  assert.equal(await dialog().getByRole('checkbox',{name:'Тестовый рюкзак X20 · Название',exact:true}).isChecked(),false);
  console.log('comparison ready');
  await dialog().getByRole('button',{name:'Применить выбранные поля',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('dialog[open]'));
  let n=await p.evaluate(id=>window.__inventory.document.nodes.find(n=>n.id===id),ids[0]);assert.equal(n.fields['Вес, г'],'700');assert.equal(n.fields['Артикул производителя'],'EX-X20-Red');assert.equal(n.fields['Транспортный объём, л'],'1');assert.equal(n.name,'Тестовый рюкзак X20');assert.equal(n.quantity,2);
  await p.locator('.iv-history-buttons button').first().click();await p.waitForFunction(id=>!window.__inventory.document.nodes.find(n=>n.id===id).fields['Артикул производителя'],ids[0]);
  assert.ok((await p.evaluate(id=>window.__inventory.document.nodes.find(n=>n.id===id),ids[0])).itemResearch.checkedAt);
  await p.reload();await p.waitForFunction(()=>window.__inventory);await p.getByRole('button',{name:'Проверено',exact:true}).click();await search.fill('X20');
  await p.getByRole('checkbox',{name:'Выбрать: Тестовый рюкзак X20',exact:true}).check();assert.equal(await p.getByRole('button',{name:'Искать выбранные',exact:true}).isEnabled(),false);
  await p.getByRole('button',{name:'Не проверено',exact:true}).click();await search.fill('A00');await p.getByRole('checkbox',{name:'Выбрать: Тестовый рюкзак A00',exact:true}).check();await p.getByRole('button',{name:'Искать выбранные',exact:true}).click();await p.waitForFunction(id=>window.__inventory.document.nodes.find(n=>n.id===id).itemResearch?.status==='not_found',ids[1]);
  await p.getByRole('button',{name:'Не проверено',exact:true}).click();await search.fill('E00');await p.getByRole('checkbox',{name:'Выбрать: Тестовый рюкзак E00',exact:true}).check();await p.getByRole('button',{name:'Искать выбранные',exact:true}).click();await p.waitForFunction(id=>window.__inventory.document.nodes.find(n=>n.id===id).itemResearchError,ids[2]);assert.equal(await p.evaluate(id=>Boolean(window.__inventory.document.nodes.find(n=>n.id===id).itemResearch),ids[2]),false);
  await p.getByRole('button',{name:'Проверено',exact:true}).click();await search.fill('A00');if(!await p.getByRole('button',{name:'Добавить ссылку',exact:true}).count())await p.getByRole('button',{name:'Открыть',exact:true}).click();await p.getByRole('button',{name:'Добавить ссылку',exact:true}).click();await dialog().getByRole('textbox',{name:'Ссылка на товар'}).fill('https://example.com/product-a00');await dialog().getByRole('button',{name:'Прочитать',exact:true}).click();await p.waitForFunction(id=>window.__inventory.document.nodes.find(n=>n.id===id).itemResearch?.candidates.length===2,ids[1]);await p.getByRole('radio',{name:'Выбрать модель: Тестовый рюкзак A00 Blue',exact:true}).check();
  await p.getByRole('button',{name:'Сравнить выбранные',exact:true}).click();assert.equal(await dialog().locator('.im-compare-item').count(),2);await dialog().getByRole('button',{name:'Применить выбранные поля',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal(await p.evaluate(ids=>ids.slice(0,2).every(id=>window.__inventory.document.nodes.find(n=>n.id===id).fields['Артикул производителя']),ids),true);
  await p.getByRole('button',{name:'Все предметы',exact:true}).click();await search.fill('Тестовый');console.log('desktop flow passed');
  await p.setViewportSize({width:390,height:844});console.log('mobile viewport');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.getByRole('button',{name:'Открыть',exact:true}).first().click();await p.getByRole('button',{name:'Сравнить и применить',exact:true}).click();await p.screenshot({path:'/tmp/item-master-mobile-comparison.png',fullPage:true});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.keyboard.press('Escape');await p.getByRole('button',{name:'Настроить Tavily',exact:true}).click();
  await setup().getByRole('button',{name:'Обновить остаток',exact:true}).click();await setup().getByRole('status').filter({hasText:'Подключение проверено'}).waitFor();
  await p.screenshot({path:'/tmp/item-master-api-mobile.png',fullPage:true});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await setup().getByRole('button',{name:'Отключить Tavily',exact:true}).click();await setup().getByRole('status').filter({hasText:'Ключ удалён'}).waitFor();await setup().getByRole('button',{name:'Готово',exact:true}).click();await p.getByRole('button',{name:'Подключить Tavily',exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,requests:requests.length,checks:'search, model choices, comparison, protected manual fields, apply, undo, restart exclusion, empty result, failed search, API connect/reload/refresh/disconnect, no key in inventory or localStorage, mobile'},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
