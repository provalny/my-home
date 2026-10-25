import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractCandidates,quantity,extractSearchText,createLookup} from './lookup.js';
import {searchRequest,searchResults,searchFailure,SEARCH_HEADERS} from './search-provider.js';
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
test('keyless request whitelists inventory fields and never enables paid or AI answer options',()=>{
  const request=searchRequest({name:'Sony X20',brand:'Sony',model:'X20',notes:'PRIVATE',location:'PRIVATE'});
  assert.ok(!JSON.stringify(request).includes('PRIVATE'));assert.equal(request.include_answer,false);assert.equal(request.auto_parameters,false);assert.equal(SEARCH_HEADERS['X-Tavily-Access-Mode'],'keyless');assert.equal(SEARCH_HEADERS.Authorization,undefined);
  assert.throws(()=>searchRequest({name:'Thing'},['https://example.com']));
  assert.deepEqual(searchResults({results:[]}),[]);assert.throws(()=>searchResults({error:'unexpected provider instructions'}),/не завершена/);assert.match(searchFailure(429),/лимит бесплатного поиска/);
  assert.deepEqual(searchResults({results:[{url:'https://127.0.0.1/',title:'Thing'}]}),[]);
});
const results=(title='Sony X20',url='https://www.sony.com/product',raw_content='')=>({results:[{title,url,raw_content}]});
test('manufacturer is queried first; incomplete data falls back without mixing candidate facts',async()=>{
  const requests=[];
  const reader=async u=>({url:u,text:page({name:'Sony X20',mpn:'X20'})});
  const searchProvider=async(input,{domains})=>{requests.push({input,domains});return results();};
  const result=await createLookup(reader,{delay:0,searchProvider}).search({name:'Sony X20',brand:'Sony',model:'X20',notes:'PRIVATE'});
  assert.ok(requests[0].domains.includes('sony.com'));assert.deepEqual(requests[1].domains,[]);assert.equal(requests.length,2);assert.equal(result.candidates[0].sourceKind,'manufacturer');assert.equal(requests[0].input.notes,undefined);
});
test('abort does not deliver a completed result and network failure is not not-found',async()=>{
  const searchProvider=async()=>{throw Error('offline');};
  const c=new AbortController();c.abort();await assert.rejects(createLookup(async()=>({text:''}),{delay:0,searchProvider}).search({name:'Thing'},{signal:c.signal}),{name:'AbortError'});
  await assert.rejects(createLookup(async()=>({text:''}),{delay:0,searchProvider}).search({name:'Thing'}),/offline/);
});
test('public fetch address policy rejects local, metadata, multicast and reserved networks',()=>{for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','172.16.1.1','100.64.0.1','0.0.0.0','224.0.0.1','198.19.1.1','203.0.113.1'])assert.equal(publicIPv4(ip),false,ip);assert.equal(publicIPv4('1.1.1.1'),true);});
test('a later search failure preserves the manufacturer facts already obtained',async()=>{
  let searches=0;
  const searchProvider=async()=>{if(searches++)throw Error('rate limit');return results();};
  const result=await createLookup(async u=>({url:u,text:page({name:'Sony X20',mpn:'M-20'})}),{delay:0,searchProvider}).search({name:'Sony X20',brand:'Sony',model:'X20'});
  assert.equal(result.candidates.length,1);assert.match(result.warning,/Дополнительный поиск/);
});
test('full page markdown supplies explicit facts but search snippets and generated answers never do',()=>{
  const [r]=searchResults(results('Sony WH-1000XM5',url,'# Specifications\n## Size & Weight\n### WEIGHT\n\n: Approx. 250 g\n'));
  const c=extractSearchText(r);assert.equal(c.fields.weightGrams.value,250);assert.equal(c.fields.officialName,undefined);assert.equal(c.fields.weightGrams.source,url);
  const [snippet]=searchResults({answer:'Weight: 999 g',results:[{title:'Sony X20',url,content:'Weight: 999 g'}]});assert.equal(extractSearchText(snippet),null);
  const packed=extractSearchText({title:'Thing',url,text:'## Packaging\n### KALLAX\nWeight: 20 kg\nWidth: 40 cm\nHeight: 80 cm\nLength: 90 cm\n'});assert.equal(packed,null);
  assert.equal(extractSearchText({title:'Thing',url,text:'Capacity: 50 l\nWeight: 1-2 kg'}),null);
});
test('matching full text can survive a blocked source; nearby models are rejected',async()=>{
  const searchProvider=async()=>({results:[{title:'Sony WH-1000XM5 specifications',url:'https://www.sony.com/wh',raw_content:'Weight: 250 g'},{title:'Sony WF-1000XM5 specifications',url:'https://www.sony.com/wf',raw_content:'Weight: 6 g'}]});
  const result=await createLookup(async()=>{throw Error('blocked');},{delay:0,searchProvider}).search({name:'Sony WH-1000XM5',model:'WH-1000XM5'});
  assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].fields.weightGrams.value,250);
});
test('unscoped markdown is not merged into several product variants',async()=>{
  const html='<script type="application/ld+json">'+JSON.stringify({'@type':'ProductGroup',hasVariant:[{'@type':'Product',name:'Sony X20 Red'},{'@type':'Product',name:'Sony X20 Blue'}]})+'</script>';
  const result=await createLookup(async u=>({url:u,text:html}),{delay:0,searchProvider:async()=>results('Sony X20',url,'Weight: 250 g')}).search({name:'Sony X20'});
  assert.equal(result.candidates.length,2);assert.ok(result.candidates.every(c=>!c.fields.weightGrams));
});

test('manufacturer article in search URL is sufficient to open the page and verify its MPN',async()=>{
  const searchProvider=async()=>results('KALLAX shelving unit','https://www.ikea.com/us/p/kallax-90637303/');
  const result=await createLookup(async u=>({url:u,text:page({name:'KALLAX shelving unit',mpn:'90637303'})}),{delay:0,searchProvider}).search({name:'IKEA KALLAX',model:'90637303'});
  assert.equal(result.candidates[0].fields.mpn.value,'90637303');
});
