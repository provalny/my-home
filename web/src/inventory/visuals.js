import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { nodeAppearance } from './appearance.js';

export function nodeThumbnail(doc,n,size=22) {
  if (n.photo) return h('img.iv-thumb',{src:n.photo,alt:'',loading:'lazy'});
  const appearance = nodeAppearance(doc,n);
  return h('span.iv-thumb.iv-category-badge',{'data-kind':appearance.kind,'data-glyph':appearance.glyph,'aria-hidden':'true'},icon(appearance.glyph,size));
}
