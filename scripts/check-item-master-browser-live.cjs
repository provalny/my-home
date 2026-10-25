// Opt-in network test in a fresh, isolated demo context. No response fixtures.
const assert=require('node:assert/strict');
const {chromium}=require('/Users/maksimefimov/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const context=await browser.newContext({viewport:{width:1480,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.ITEM_MASTER_URL||'http://127.0.0.1:5234')+'/?section=item-master&demo=item-master');
  await page.getByRole('button',{name:'Пропустить обзор',exact:true}).click();
  await page.getByRole('searchbox',{name:'Поиск в мастере предметов'}).fill('WH-1000XM5');
  const row=page.getByRole('checkbox',{name:/Выбрать:.*WH-1000XM5/});
  await row.check();await page.getByRole('button',{name:'Искать выбранные',exact:true}).click();
  await page.waitForFunction(()=>window.__inventory.document.nodes.some(n=>n.name.includes('WH-1000XM5')&&(n.itemResearch||n.itemResearchError)),null,{timeout:180000});
  const item=await page.evaluate(()=>window.__inventory.document.nodes.find(n=>n.name.includes('WH-1000XM5')));
  assert.ok(item.itemResearch,item.itemResearchError);
  assert.ok(item.itemResearch.candidates.some(c=>c.sourceKind==='manufacturer'&&Math.abs(c.fields.weightGrams?.value-250)<1));
  assert.equal(item.itemResearch.chosen,null);
  await page.screenshot({path:'/tmp/item-master-real-search.png',fullPage:true});
  await page.reload();await page.getByRole('button',{name:'Проверено',exact:true}).click();
  await page.getByRole('searchbox',{name:'Поиск в мастере предметов'}).fill('WH-1000XM5');
  await page.getByRole('checkbox',{name:/Выбрать:.*WH-1000XM5/}).check();
  assert.equal(await page.getByRole('button',{name:'Искать выбранные',exact:true}).isEnabled(),false);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,candidates:item.itemResearch.candidates.length,weightGrams:250,checks:'real free search, source parsing, save, reload, exclusion from next search'}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
