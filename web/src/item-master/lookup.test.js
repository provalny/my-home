import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractCandidates,quantity,parseSearch,createLookup} from './lookup.js';
import {publicIPv4} from '../../item-master-server.js';
const page=p=>'<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Example X20',...p})+'</script>';
const url='https://example.com/product';
test('extracts attributed MPN and product weight without copying SKU or shipping weight',()=>{
  const [c]=extractCandidates(page({mpn:'M-20',sku:'SHOP-19',weight:{value:1.2,unitCode:'KGM'},offers:{shippingDetails:{weight:{value:2,unitCode:'KGM'}}}}),url);
  assert.equal(c.fields.mpn.value,'M-20');assert.equal(c.fields.weightGrams.value,1200);assert.equal(c.fields.weightGrams.source,url);
  const [sku]=extractCandidates(page({sku:'SHOP-19',offers:{shippingDetails:{weight:'2 kg'}}}),url);assert.equal(sku.fields.mpn,undefined);assert.equal(sku.fields.weightGrams,undefined);
});
test('capacity and assembled dimensions never become transport volume',()=>{
  const [c]=extractCandidates(page({width:'30 cm',height:'50 cm',depth:'20 cm',additionalProperty:[{name:'Вместимость',value:'30 л'},{name:'Объём',value:'30 л'},{name:'Вес в упаковке',value:'2 кг'}]}),url);
  assert.equal(c.fields.transportLiters,undefined);assert.equal(c.fields.weightGrams,undefined);
});
test('packed size gives labelled estimate and explicit packed volume is accepted',()=>{
  const [c]=extractCandidates(page({additionalProperty:[{name:'Размер в сложенном виде',value:'20 × 10 × 5 см'}]}),url);assert.equal(c.fields.transportLiters.value,1);assert.match(c.fields.transportLiters.basis,/≈/);
  const [p]=extractCandidates(page({additionalProperty:[{name:'Packed volume',value:2,unitCode:'LTR'}]}),url);assert.equal(p.fields.transportLiters.value,2);
  const [tiny]=extractCandidates(page({additionalProperty:[{name:'Packed dimensions',value:'1 x 1 x 1 mm'}]}),url);assert.equal(tiny.fields.transportLiters.value,.000001);
});
test('dimensions for folded and packaged states are not mixed',()=>{
  const [c]=extractCandidates(page({additionalProperty:[{name:'Packed width',value:'20 cm'},{name:'Folded height',value:'10 cm'},{name:'Packed depth',value:'5 cm'}]}),url);assert.equal(c.fields.transportLiters,undefined);
});
test('table properties work on a single product page; multiple variants remain separate',()=>{
  const html='<h1>Example X20</h1><table><tr><th>Артикул производителя</th><td>AB-20</td></tr><tr><th>Вес, г</th><td>750</td></tr></table>';
  const [c]=extractCandidates(html,url);assert.equal(c.fields.mpn.value,'AB-20');assert.equal(c.fields.weightGrams.value,750);
  const variants='<script type="application/ld+json">'+JSON.stringify({'@type':'ProductGroup',hasVariant:[{'@type':'Product',name:'X20 Red',mpn:'RED'},{'@type':'Product',name:'X20 Blue',mpn:'BLUE'}]})+'</script>';
  assert.deepEqual(extractCandidates(variants,url).map(c=>c.fields.mpn.value),['RED','BLUE']);
});
test('strict units reject bare numbers, ranges and unsupported claims',()=>{assert.equal(quantity('1,25 кг','weight'),1250);assert.equal(quantity('2 lb','weight'),907.18474);for(const raw of ['1-2 kg','250','-1 kg','250 g with battery','NaN kg'])assert.equal(quantity(raw,'weight'),null);});
test('search distinguishes empty results, changed markup and a challenge',()=>{
  assert.equal(parseSearch('<div class="no-results">No results found</div>').length,0);
  assert.throws(()=>parseSearch('<html>unknown markup</html>'));assert.throws(()=>parseSearch('<form id="challenge-form">'));
  const results=parseSearch('<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fp">Example &amp; X20</a>');assert.deepEqual(results,[{url:'https://example.com/p',title:'Example & X20'}]);
});
test('manufacturer is queried first; incomplete data falls back without mixing candidate facts',async()=>{
  const requests=[];
  const reader=async u=>{requests.push(u);if(u.includes('duckduckgo'))return {url:u,text:'<a class="result__a" href="https://www.sony.com/product">Sony X20</a>'};return {url:u,text:page({name:'Sony X20',mpn:'X20'})};};
  const result=await createLookup(reader,{delay:0}).search({name:'Sony X20',brand:'Sony',model:'X20'});
  assert.match(decodeURIComponent(requests[0]),/site:sony.com/);assert.equal(result.candidates[0].sourceKind,'manufacturer');assert.equal(requests.filter(u=>u.includes('duckduckgo')).length,2);
});
test('abort does not deliver a completed result and network failure is not not-found',async()=>{
  const c=new AbortController();c.abort();await assert.rejects(createLookup(async()=>({text:''}),{delay:0}).search({name:'Thing'},{signal:c.signal}),{name:'AbortError'});
  await assert.rejects(createLookup(async()=>{throw Error('offline');},{delay:0}).search({name:'Thing'}),/offline/);
});
test('public fetch address policy rejects local, metadata, multicast and reserved networks',()=>{for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','172.16.1.1','100.64.0.1','0.0.0.0','224.0.0.1','198.19.1.1','203.0.113.1'])assert.equal(publicIPv4(ip),false,ip);assert.equal(publicIPv4('1.1.1.1'),true);});
test('a later search failure preserves the manufacturer facts already obtained',async()=>{
  let searches=0;
  const result=await createLookup(async u=>{if(u.includes('duckduckgo')){if(searches++)throw Error('rate limit');return {url:u,text:'<a class="result__a" href="https://www.sony.com/x20">Sony X20</a>'};}return {url:u,text:page({name:'Sony X20',mpn:'M-20'})};},{delay:0}).search({name:'Sony X20',brand:'Sony',model:'X20'});
  assert.equal(result.candidates.length,1);assert.match(result.warning,/Дополнительный поиск/);
});
