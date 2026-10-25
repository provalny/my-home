// Opt-in live check. Uses only two public sample models, never the inventory.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createLookup} from '../web/src/item-master/lookup.js';
import {fetchPublicPage,searchPublicProducts} from '../web/item-master-server.js';

const report=[];
for(const input of [{name:'Sony WH-1000XM5',brand:'Sony',model:'WH-1000XM5'},{name:'IKEA KALLAX',brand:'IKEA',model:'90637303'}].filter(input=>!process.argv[2]||input.brand===process.argv[2])) {
  const lookup=createLookup(fetchPublicPage,{searchProvider:async(input,{domains})=>searchPublicProducts(input,domains)});
  const result=await lookup.search(input);
  const candidates=result.candidates.map(c=>({title:c.title,url:c.url,sourceKind:c.sourceKind,fields:Object.fromEntries(Object.entries(c.fields).map(([k,f])=>[k,f.value]))}));
  report.push({input,candidates,warning:result.warning});
  await writeFile('/tmp/item-master-live-report.json',JSON.stringify(report,null,2));
  assert.ok(candidates.length,`No candidates for ${input.name}`);
  if(input.brand==='Sony')assert.ok(candidates.some(c=>c.sourceKind==='manufacturer'&&Math.abs(c.fields.weightGrams-250)<1),'Sony official weight missing');
  if(input.brand==='IKEA')assert.ok(candidates.some(c=>c.sourceKind==='manufacturer'&&String(c.fields.mpn).replace(/\D/g,'')==='90637303'),'IKEA manufacturer article missing');
  console.log(JSON.stringify(report.at(-1),null,2));
}
console.log('Live search checks passed. Report: /tmp/item-master-live-report.json');
