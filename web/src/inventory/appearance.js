// One category-to-icon mapping for every inventory view, including location pickers.
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
  if (n.kind === 'room') return {glyph:'home',kind:'room'};
  if ((doc.categories || []).some(c => c.id === n.categoryId)) return categoryAppearance(doc,n.categoryId);
  return { glyph:n.kind === 'furniture' ? 'furniture' : n.kind === 'item' ? 'box' : 'folder', kind:n.kind };
}
