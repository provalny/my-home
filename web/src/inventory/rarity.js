import { isSection } from './ikea-storage.js';
import { titleRarity } from './rarity-keywords.js';

export const RARITIES = [
  { id:'poor', name:'Низкое качество', color:'#9d9d9d' },
  { id:'common', name:'Обычный', color:'#ffffff' },
  { id:'uncommon', name:'Необычный', color:'#1eff00' },
  { id:'rare', name:'Редкий', color:'#0070dd' },
  { id:'epic', name:'Эпический', color:'#a335ee' },
  { id:'legendary', name:'Легендарный', color:'#ff8000' },
];
const EPIC_MODELS = new Set(['macBook','simCockpitTriple','printer3dEnclosed','printer3dOpen']);
export const hasRarity = n => Boolean(n && n.kind !== 'room' && !isSection(n));
// Resolve on read so existing cards also inherit new rules without data migration.
export function defaultRarity(doc,n) {
  const title=titleRarity(n?.name);
  if(EPIC_MODELS.has(n?.modelType)&&title!=='legendary')return 'epic';
  return title||'common';
}
export function itemRarity(doc,n) {
  if(!hasRarity(n))return null;
  const chosen=RARITIES.find(r=>r.id===n.rarity);
  return chosen||RARITIES.find(r=>r.id===defaultRarity(doc,n));
}
export function rarityDistribution(doc) {
  const rows=RARITIES.map(r=>({...r,count:0})),byId=new Map(rows.map(r=>[r.id,r]));
  // Match the overview's item count: physical items and furniture, one card each.
  for(const n of doc.nodes)if(!n.archived&&['item','furniture'].includes(n.kind)) {
    const rarity=itemRarity(doc,n);
    if(rarity)byId.get(rarity.id).count++;
  }
  const total=rows.reduce((sum,r)=>sum+r.count,0);
  return {total,rows:rows.map(r=>({...r,percent:total?r.count/total*100:0}))};
}
export function validateRarity(n) {
  if(n.rarity == null)return;
  if(!hasRarity(n)||!RARITIES.some(r=>r.id===n.rarity))throw Error('Некорректная редкость предмета');
}
