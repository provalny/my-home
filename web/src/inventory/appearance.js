import { allFurniture } from './spaces.js';
import { roomGlyph } from './room-icons.js';
import { KITCHEN_MODULE_TYPES } from './ikea-storage.js';
// One resolver for every inventory view, including location pickers.
export const FURNITURE_GLYPHS = {
  duffel60:'bag',backpack20:'backpack',travelBag30:'bag',
  trailSuv:'car',
  woodShelfLow:'rack',parrotCage:'pets',
  kallaxShelf:'shelf',ivarRack:'rack',
  officeChair:'furniture',gamingDesktop:'games',monitorStand:'tv',desktopMonitor:'tv',smallDesk:'desk',neonPorsche:'car',ikeaFloorLamp:'bulb',whiteSpeaker:'film',bookcaseTall:'shelf',bookcaseMedium:'shelf',
  pcCase:'laptop',macBook:'laptop',simCockpit:'games',simCockpitTriple:'games',printer3dEnclosed:'box',printer3dOpen:'box',printerCabinet:'dresser',
  sofa:'sofa',armchair:'furniture',coffeeTable:'desk',desk:'desk',diningSet:'dishes',
  bed:'bed',nightstand:'dresser',wardrobe:'wardrobe',bookshelf:'shelf',sideboard:'dresser',dresser:'dresser',
  kitchenBase:'stove',hoodCabinet:'fan',kitchen:'stove',island:'dishes',fridge:'fridge',tv:'tv',plant:'flower',rug:'stop',
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
  if(n.automobileId)return {glyph:'car',kind:'room'};
  if(n.carCompartment)return {glyph:n.carCompartment==='cabin'?'sofa':'box',kind:n.kind};
  if(n.kind==='room'&&n.virtual)return {glyph:'unplaced',kind:'room'};
  if(n.fridgeChamber)return {glyph:n.fridgeChamber==='freezer'?'cool':n.fridgeChamber==='fresh'?'leaf':'fridge',kind:n.kind};
  if(n.kitchenModule)return {glyph:KITCHEN_MODULE_TYPES[n.kitchenModuleType||'cabinet']?.glyph||'folder',kind:n.kind};
  if (n.kind === 'room') return {glyph:roomGlyph(n),kind:'room'};
  const type = allFurniture(doc).find(f=>f.id===n.furnitureId)?.type || n.modelType;
  if(n.kind==='furniture'&&FURNITURE_GLYPHS[type]) return {glyph:FURNITURE_GLYPHS[type],kind:categoryAppearance(doc,n.categoryId).kind};
  if(n.kind==='shelf')return {glyph:'shelf',kind:'shelf'};
  if(n.kind==='drawer')return {glyph:'dresser',kind:'drawer'};
  if ((doc.categories || []).some(c => c.id === n.categoryId)) return categoryAppearance(doc,n.categoryId);
  return { glyph:n.kind === 'furniture' ? 'furniture' : n.kind === 'item' ? 'box' : 'folder', kind:n.kind };
}
