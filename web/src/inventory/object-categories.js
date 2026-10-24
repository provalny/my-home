import { randomID } from '../uuid.js';
import { allFurniture } from './spaces.js';
import { objectSection } from '../editor/object-sections.js';
import { EXTRA_MODEL_INFO } from '../three/furniture-info.js';

const roots = [
  ['furniture', 'Мебель', 'furniture', 'furniture'],
  ['appliances', 'Бытовая техника', 'washer', 'electronics'],
  ['electronics', 'Домашняя электроника', 'laptop', 'electronics'],
  ['decor', 'Уют', 'palette', 'decor'],
];
const legacyNames = {electronics:['Электроника'], decor:['Декор']};
function findObjectCategory(doc,key,name) {
  return doc.categories.find(c=>c.presetKey===key)
    || doc.categories.find(c=>c.id===key&&!c.parentId)
    || doc.categories.find(c=>c.name===name&&(!c.parentId||key==='appliances'&&c.parentId==='electronics'));
}
export function ensureObjectCategories(doc) {
  const ids = {};
  for (const [key,name,icon,kind] of roots) {
    let c = findObjectCategory(doc,key,name);
    if (!c) {
      c = {id:doc.categories.some(c=>c.id===key)?randomID():key,name,icon,kind,parentId:null,presetKey:key};
      doc.categories.push(c);
    }
    if (legacyNames[key]?.includes(c.name)) c.name = name;
    if (key === 'appliances' && c.parentId === 'electronics') c.parentId = null;
    c.icon ||= icon;
    ids[key] = c.id;
  }
  return ids;
}
export function modelCategoryId(doc, type) {
  const section = objectSection(type);
  const key = section === 'cozy' ? 'decor' : section === 'furniture' && EXTRA_MODEL_INFO[type]?.category === 'other' ? 'other' : section;
  if (key === 'other') {
    let c=doc.categories.find(c=>c.id==='other'&&!c.parentId);
    if(!c&&doc.settings.objectCategoriesVersion!==1){c={id:doc.categories.some(c=>c.id==='other')?randomID():'other',name:'Другое',parentId:null,kind:'default'};doc.categories.push(c);}
    return c?.id||'';
  }
  // After migration, missing categories were deliberately removed by the user.
  // Saving a plan or adding a model must not silently recreate them.
  if(doc.settings.objectCategoriesVersion===1)return findObjectCategory(doc,key,roots.find(r=>r[0]===key)?.[1])?.id||'';
  return ensureObjectCategories(doc)[key];
}
export function migrateObjectCategories(doc) {
  if (doc.settings.objectCategoriesVersion === 1) return;
  const ids=ensureObjectCategories(doc);
  const defaultIds=new Set(['furniture','electronics','decor','other',...Object.values(ids)]);
  for(const c of doc.categories) if(c.name==='Бытовая техника' && (c.parentId==='electronics'||c.id===ids.appliances))defaultIds.add(c.id);
  const shapes=[...allFurniture(doc),...(doc.trash||[]).flatMap(e=>e.furniture||[])];
  for(const n of [...doc.nodes,...(doc.trash||[]).flatMap(e=>e.nodes||[])]) {
    const type=n.modelType||shapes.find(f=>f.id===n.furnitureId)?.type;
    if(n.kind==='furniture'&&type&&defaultIds.has(n.categoryId))n.categoryId=modelCategoryId(doc,type);
  }
  doc.settings.objectCategoriesVersion=1;
}
