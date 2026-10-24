import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { nodeAppearance } from './appearance.js';
import { itemRarity } from './rarity.js';

export function paintRarity(el,doc,n) {
  const rarity=itemRarity(doc,n);
  if(rarity)el.dataset.rarity=rarity.id;
  else delete el.dataset.rarity;
  return el;
}
export function rarityBadge(doc,n) {
  const rarity=itemRarity(doc,n);
  return rarity?h('span.iv-rarity-label',{'data-rarity':rarity.id},rarity.name):null;
}

export function nodeThumbnail(doc,n,size=22) {
  if (n.photo) return paintRarity(h('img.iv-thumb',{src:n.photo,alt:'',loading:'lazy'}),doc,n);
  const appearance = nodeAppearance(doc,n);
  return paintRarity(h('span.iv-thumb.iv-category-badge',{'data-kind':appearance.kind,'data-glyph':appearance.glyph,'aria-hidden':'true'},icon(appearance.glyph,size)),doc,n);
}
