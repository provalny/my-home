import { roomGlyph } from './room-icons.js';
// One resolver for every inventory view, including location pickers.
export const FURNITURE_GLYPHS = {
  sofa:'sofa',armchair:'furniture',coffeeTable:'desk',desk:'desk',diningSet:'dishes',
  bed:'bed',nightstand:'dresser',wardrobe:'wardrobe',bookshelf:'shelf',sideboard:'dresser',dresser:'dresser',
  kitchen:'stove',island:'dishes',fridge:'fridge',tv:'tv',plant:'flower',rug:'stop',
  vanity:'dry',bathtub:'bath',toilet:'toilet',metalRack:'rack',tireStack:'tire',
  washingMachine:'washer',dishwasher:'dishes',stove:'stove',microwave:'microwave',
  shoeCabinet:'shoes',hallUnit:'door',cornerSofa:'sofa',slidingWardrobe:'wardrobe',
  wallUnit:'tv',wallShelf:'shelf',laundryBasket:'food',showerCabin:'shower',crossover:'car',
};
const GLYPHS = { furniture:'furniture', electronics:'laptop', clothes:'clothes', food:'food', dishes:'dishes', tools:'tools', sport:'sport', books:'book', medicine:'medicine', decor:'palette', cleaning:'cleaning', cosmetics:'sparkles', linen:'bed', documents:'documents', hobby:'hobby', pets:'pets', outdoor:'outdoor', accessories:'key' };
const PRESETS = { 'Молочные продукты':'milk', 'Обувь':'shoes', 'Компьютеры':'laptop', 'Бытовая техника':'cool', 'Периферия':'plug' };
export function rememberCategoryIcons(doc) {
  for (const c of doc.categories || []) if (!c.icon && PRESETS[c.name]) c.icon = PRESETS[c.name];
}
export function categoryAppearance(doc, categoryId) {
  const categories = new Map((doc.categories || []).map(c => [c.id,c]));
  let c = categories.get(categoryId), glyph = null, kind = 'default';
  const seen = new Set();
  while (c && !seen.has(c.id)) {
    seen.add(c.id);
    glyph ||= c.icon || PRESETS[c.name] || GLYPHS[c.kind];
    if (c.kind && c.kind !== 'default') kind = c.kind;
    c = categories.get(c.parentId);
  }
  return { glyph:glyph || GLYPHS[kind] || 'box', kind };
}
export function nodeAppearance(doc, n) {
  if (n.kind === 'room') return {glyph:roomGlyph(n),kind:'room'};
  const type = doc.plan?.furniture?.find(f=>f.id===n.furnitureId)?.type || n.modelType;
  if(n.kind==='furniture'&&FURNITURE_GLYPHS[type]) return {glyph:FURNITURE_GLYPHS[type],kind:categoryAppearance(doc,n.categoryId).kind};
  if(n.kind==='shelf')return {glyph:'shelf',kind:'shelf'};
  if(n.kind==='drawer')return {glyph:'dresser',kind:'drawer'};
  if ((doc.categories || []).some(c => c.id === n.categoryId)) return categoryAppearance(doc,n.categoryId);
  return { glyph:n.kind === 'furniture' ? 'furniture' : n.kind === 'item' ? 'box' : 'folder', kind:n.kind };
}
