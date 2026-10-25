import { safeURL } from './model.js';
import {searchResults} from './search-provider.js';

const MAX_PAGE=2_000_000;
const BRANDS=[[/\bsony\b|сони/i,['sony.com','sony.ru','sony.co.uk']],[/\bikea\b|ике[ая]/i,['ikea.com']],[/\bapple\b|эппл/i,['apple.com']],[/\bcanon\b|кэнон|кенон/i,['canon.com','canon-europe.com']],[/\bdji\b/i,['dji.com']],[/\bsamsung\b|самсунг/i,['samsung.com']],[/\blogitech\b/i,['logitech.com','logitechg.com']],[/\bdecathlon\b|декатлон/i,['decathlon.com','decathlon.co.uk']],[/\bnaturehike\b/i,['naturehike.com']],[/\bdeuter\b/i,['deuter.com']],[/\bosprey\b/i,['osprey.com']],[/\bbosch\b|бош/i,['bosch-home.com','bosch-professional.com']],[/\bmakita\b|макита/i,['makita.com','makitatools.com']],[/\bnintendo\b/i,['nintendo.com']],[/\bgarmin\b/i,['garmin.com']]];
export const decode = s => String(s??'').replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi,x=>{
  const known={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '};if(known[x.toLowerCase()])return known[x.toLowerCase()];const code=x[2]?.toLowerCase()==='x'?parseInt(x.slice(3,-1),16):parseInt(x.slice(2,-1),10);return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';
});
const text = s => decode(String(s??'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const short = (s,n=200) => text(s).slice(0,n);
const attr = (tag,key) => decode(tag.match(new RegExp(`\\b${key}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,'i'))?.slice(1).find(v=>v!==undefined)||'');
export function brandDomains(input) {const q=Object.values(input).join(' ');return BRANDS.find(([re])=>re.test(q))?.[1]||[];}
const onDomain=(url,domains)=>{const host=new URL(url).hostname;return domains.some(d=>host===d||host.endsWith('.'+d));};
const units={weight:{g:1,grm:1,'г':1,gram:1,grams:1,kg:1000,kgm:1000,'кг':1000,kilogram:1000,kilograms:1000,lb:453.59237,lbr:453.59237,lbs:453.59237,oz:28.349523125,onz:28.349523125},length:{cm:1,cmt:1,'см':1,mm:.1,mmt:.1,'мм':.1,m:100,mtr:100,'м':100,in:2.54,inch:2.54,inches:2.54,inh:2.54},volume:{l:1,ltr:1,'л':1,liter:1,liters:1,litre:1,litres:1,ml:.001,mlt:.001,'мл':.001}};
export function quantity(raw,kind,unit='') {
  if(raw&&typeof raw==='object'){unit=raw.unitCode||raw.unitText||unit;raw=raw.value;}
  if(typeof raw!=='string'&&typeof raw!=='number')return null;
  const m=String(raw).trim().match(/^(?:approx\.?|approximately|около|примерно|≈|~)?\s*(\d+(?:[.,]\d+)?)\s*([a-zа-я]+)?\.?$/i);if(!m)return null;
  const factor=units[kind]?.[String(m[2]||unit).trim().toLowerCase()];const n=Number(m[1].replace(',','.'))*factor;return Number.isFinite(n)&&n>0?Math.round(n*1e6)/1e6:null;
}
function propertyPairs(html) {
  const pairs=[];
  for(const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>text(x[1]));if(cells.length===2)pairs.push({name:cells[0],value:cells[1]});}
  for(const m of html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi))pairs.push({name:text(m[1]),value:text(m[2])});
  return pairs;
}
function facts(product,url,pairs=[]) {
  const result={},put=(key,value,basis)=>{if(value!=null&&value!==''&&!result[key])result[key]={value,source:url,basis:short(basis,500)};};
  put('officialName',short(product.name),'Название товара в источнике');
  // sku/GTIN are deliberately never treated as manufacturer part numbers.
  if(typeof product.mpn==='string'||typeof product.mpn==='number')put('mpn',short(product.mpn),'Артикул производителя (MPN)');
  put('weightGrams',quantity(product.weight,'weight'),'Вес самого предмета; комплектацию проверьте в источнике');
  const extra=Array.isArray(product.additionalProperty)?product.additionalProperty:product.additionalProperty?[product.additionalProperty]:[];
  const properties=[...extra,...pairs],packAxes={};
  for(const p of properties) {
    const label=text(p.name).toLowerCase(),value=p.value;
    if(/^(?:вес(?: нетто| предмета| изделия| товара)?|net weight|product weight|item weight|weight)(?:\s*[,(/]\s*(?:г|кг|g|kg)\)?)?$/.test(label))put('weightGrams',quantity(value,'weight',p.unitText||p.unitCode||label.match(/(?:[,(/]\s*)(г|кг|g|kg)\)?$/)?.[1]),p.name);
    if(/^(?:артикул производителя|код производителя|manufacturer part number|mpn)$/.test(label))put('mpn',short(value),p.name);
    // Product width/height/depth alone are NOT folded or packed dimensions.
    if(!/packed|folded|package|packaging|упаков|сложенн|транспортн/.test(label))continue;
    if(/volume|объ[её]м/.test(label))put('transportLiters',quantity(value,'volume',p.unitText||p.unitCode||label.match(/[,(/]\s*(л|l)\)?$/)?.[1]),p.name);
    const axis=/width|ширин/.test(label)?'w':/height|высот/.test(label)?'h':/length|depth|длин|глубин/.test(label)?'d':null;
    const state=/folded|сложенн/.test(label)?'folded':'packed';
    if(axis){const cm=quantity(value,'length',p.unitText||p.unitCode||label.match(/[,(/]\s*(см|мм|cm|mm)\)?$/)?.[1]);if(cm){packAxes[state]??={};packAxes[state][axis]=cm;}}
    if(/dimensions|размер|габарит/.test(label)) {
      const match=String(value).trim().match(/^(\d+(?:[.,]\d+)?)\s*[xх×*]\s*(\d+(?:[.,]\d+)?)\s*[xх×*]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|см|мм|in)?$/i);
      if(match){const axisUnit=match[4]||p.unitText||p.unitCode||label.match(/[,(/]\s*(см|мм|cm|mm)\)?$/)?.[1];const dims=match.slice(1,4).map(x=>quantity(x,'length',axisUnit));if(dims.every(Boolean))put('transportLiters',Number((dims.reduce((a,b)=>a*b,1)/1000).toPrecision(8)),`≈ По габаритам: ${p.name} — ${value}. Объём прямоугольного габарита, не точное заполнение сумки.`);}
    }
  }
  for(const [state,a] of Object.entries(packAxes))if(a.w&&a.h&&a.d)put('transportLiters',Number((a.w*a.h*a.d/1000).toPrecision(8)),`≈ По габаритам ${state==='folded'?'в сложенном виде':'в упаковке'}: ${a.w} × ${a.h} × ${a.d} см. Объём прямоугольного габарита.`);
  return result;
}
export function extractCandidates(html,url,{domains=[]}={}) {
  if(!safeURL(url)||html.length>MAX_PAGE)throw Error('Недоступная или слишком большая страница');
  if(/<title[^>]*>\s*(?:Just a moment|Access Denied|Robot Check)|id=["']challenge-form/i.test(html))throw Error('Сайт запросил проверку браузера');
  const products=[];
  function visit(x,depth=0){if(!x||depth>8)return;if(Array.isArray(x)){x.slice(0,30).forEach(v=>visit(v,depth+1));return;}if(typeof x!=='object')return;const types=[x['@type']].flat();if(types.some(t=>typeof t==='string'&&/(^|[/#])(?:Product|ProductModel)$/.test(t)))products.push(x);for(const key of ['@graph','mainEntity','hasVariant'])visit(x[key],depth+1);}
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(attr(m[1],'type').toLowerCase()==='application/ld+json'){try{visit(JSON.parse(m[2]));}catch{/* Invalid markup is not evidence. */}}
  const pairs=propertyPairs(html);
  if(!products.length){const heading=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);if(heading&&pairs.length)products.push({name:text(heading[1])});}
  return products.slice(0,12).flatMap((p,i)=>{
    if(!p.name)return[];const fields=facts(p,url,products.length===1?pairs:[]);if(!Object.keys(fields).length)return[];
    return [{id:url+'#product-'+i,url,title:short(p.name,300),sourceKind:onDomain(url,domains)?'manufacturer':'other',fields}];
  });
}
function relevant(c,input) {
  const norm=s=>String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const value=norm(c.title+' '+(c.fields?.mpn?.value||''));
  const tokens=(input.model||input.name).split(/\s+/).filter(t=>t.length>=3&&/\d/.test(t));
  if(tokens.length)return tokens.every(t=>value.includes(norm(t)));
  const words=input.name.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[];
  return words.some(w=>value.includes(norm(w)));
}
export function extractSearchText(result,{domains=[]}={}) {
  if(!safeURL(result.url)||!result.text)return null;
  const lines=result.text.replace(/!\[[^\]]*\]\([^\n]*?\)/g,'').replace(/\[([^\]]+)\]\([^\n]*?\)/g,'$1').split(/\r?\n/);
  const clean=line=>text(line.replace(/^\s*(?:[#+>*-]+\s*)+/,'').replace(/\*\*|__/g,'')).trim();
  const pairs=[];let packaging=false;
  for(let i=0;i<lines.length;i++) {
    const line=clean(lines[i]);
    if(/^(?:packaging|shipping|package(?:\s+\d+)?|упаковка|доставка)$/i.test(line))packaging=true;
    if(/^#{1,2}\s/.test(lines[i])&&!/packag|shipping|упаков|достав/i.test(line))packaging=false;
    if(/^(?:reviews?|related products?|you may also like|отзывы|похожие товары)$/i.test(line))break;
    const table=line.match(/^\|\s*([^|]+)\|\s*([^|]+)\|\s*$/);
    let label,value;
    if(table){label=table[1].trim();value=table[2].trim();}
    else {
      const inline=line.match(/^([^:]{1,90}):\s*(.+)$/);
      if(inline){label=inline[1];value=inline[2];}
      else {label=line;let j=i+1;while(j<lines.length&&!clean(lines[j]))j++;value=clean(lines[j]||'').replace(/^:\s*/,'');}
    }
    if(packaging&&/^(?:weight|вес)(?:\b|\s|,|$)/i.test(label))continue;
    // Only explicit property labels are read; prose, AI answers and vague volume are ignored.
    if(/^(?:weight|net weight|product weight|item weight|вес(?: нетто| предмета| изделия| товара)?)(?:\s*[,(/]\s*(?:г|кг|g|kg)\)?)?$/i.test(label)||/^(?:manufacturer part number|mpn|артикул производителя|код производителя)$/i.test(label)||/^(?:(?:packed|folded|package|packaging) (?:dimensions|size|volume|width|height|length|depth)|(?:размер|габариты|объём|объем|ширина|высота|длина|глубина)(?:ы)? (?:в сложенном виде|упаковки|в упаковке)|транспортный объём)(?:\s*[,(/]\s*(?:см|мм|cm|mm|л|l)\)?)?$/i.test(label))pairs.push({name:label,value});
  }
  const title=short(result.title,300),fields=facts({},result.url,pairs);
  // A search-page title is a candidate label, not an official product name.
  if(!Object.keys(fields).length)return null;
  for(const fact of Object.values(fields))fact.basis=short('По тексту страницы через Tavily · '+fact.basis,500);
  return {id:result.url+'#text',url:result.url,title,sourceKind:onDomain(result.url,domains)?'manufacturer':'other',fields};
}
export function createLookup(fetchPage,{delay=1200,searchProvider}={}) {
  let lastRequest=0;
  async function page(url,signal){signal?.throwIfAborted();const wait=Math.max(0,lastRequest+delay-Date.now());if(wait)await new Promise((resolve,reject)=>{const stop=()=>{clearTimeout(timer);reject(new DOMException('Остановлено','AbortError'));};const timer=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},wait);signal?.addEventListener('abort',stop,{once:true});});signal?.throwIfAborted();lastRequest=Date.now();const r=await fetchPage(url,signal);signal?.throwIfAborted();return r;}
  async function source(url,input,signal){const r=await page(url,signal);return extractCandidates(r.text,r.url||url,{domains:brandDomains(input)});}
  async function search(input,{signal}={}) {
    const clean={name:short(input.name),brand:short(input.brand,100),model:short(input.model,100)};
    if(!clean.name)throw Error('У предмета нет названия');
    if(!searchProvider)throw Error('Источник поиска не подключён');
    const domains=brandDomains(clean),found=[],visited=new Set();let failed=0,read=0,warning='';
    for(const phase of ['manufacturer','store']) {
      if(phase==='manufacturer'&&!domains.length)continue;
      let links;
      try{signal?.throwIfAborted();const response=await searchProvider(clean,{domains:phase==='manufacturer'?domains:[],signal});signal?.throwIfAborted();links=searchResults(response).filter(x=>!visited.has(x.url)&&relevant({title:x.title+' '+new URL(x.url).pathname},clean)&&(/\.pdf(?:[?#]|$)/i.test(x.url)===false));}
      catch(e){if(e.name==='AbortError'||!found.length)throw e;warning='Дополнительный поиск недоступен. Сохранены уже найденные сведения.';break;}
      const ordered=phase==='manufacturer'?links.filter(x=>!domains.length||onDomain(x.url,domains)):links;
      for(const link of ordered.slice(0,4)) {
        visited.add(link.url);
        let candidates=[];const textCandidate=extractSearchText(link,{domains});
        try{candidates=await source(link.url,clean,signal);read++;}
        catch(e){if(e.name==='AbortError')throw e;failed++;}
        if(!candidates.length&&textCandidate){candidates=[textCandidate];read++;}
        // A page with multiple variants never shares unscoped text properties between them.
        else if(candidates.length===1&&textCandidate&&relevant(candidates[0],clean))candidates[0].fields={...textCandidate.fields,...candidates[0].fields};
        for(const c of candidates)if(relevant(c,clean)&&!found.some(x=>x.id===c.id))found.push(c);
      }
      // Stop before stores only when the manufacturer has every requested fact.
      if(found.some(c=>c.sourceKind==='manufacturer'&&['officialName','mpn','weightGrams','transportLiters'].every(k=>c.fields[k])))break;
    }
    if(!found.length&&failed&&!read)throw Error('Найденные сайты не ответили. Проверка не завершена; попробуйте позже или добавьте ссылку.');
    return {candidates:found.sort((a,b)=>(a.sourceKind==='manufacturer'?0:1)-(b.sourceKind==='manufacturer'?0:1)).slice(0,12),warning:warning||(failed?'Часть сайтов недоступна. Показаны сведения из доступных источников.':'')};
  }
  return {search,async fromURL(url,input,{signal}={}){if(!safeURL(url))throw Error('Нужна общедоступная ссылка https:// на товар');const candidates=await source(url,input,signal);return {candidates,warning:candidates.length?'':'Страница прочитана, но характеристики товара не распознаны.'};}};
}
