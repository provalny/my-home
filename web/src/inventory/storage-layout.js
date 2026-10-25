import { isKitchenType } from './ikea-storage.js';
import { planForNode } from './spaces.js';
// Layouts refer to live inventory IDs. Rendering never creates, moves or deletes inventory.
import { automaticGrid, kitchenModules, KITCHEN_MODULE_TYPES } from './ikea-storage.js';
import { fridgeChambers } from './fridge-layout.js';
export const OPENABLE_TYPES=new Set(['woodShelfLow','kallaxShelf','ivarRack','wardrobe','slidingWardrobe','dresser','nightstand','sideboard','bookshelf','metalRack','wallShelf','shoeCabinet','hallUnit','wallUnit','kitchenBase','hoodCabinet','kitchen','island','vanity','fridge','stove','bookcaseTall','bookcaseMedium','printerCabinet']);
OPENABLE_TYPES.add('trailSuv');
export const LAYOUT_TEMPLATES=[['shelves','Полки'],['wardrobe','Шкаф: верхняя полка и две секции'],['grid','Равные секции'],['drawers','Выдвижные ящики']];
export const storageChildren=(doc,id)=>doc.nodes.filter(n=>n.parentId===id&&!n.archived&&n.kind!=='item').sort((a,b)=>a.order-b.order);
function rawLayoutZones(doc,nodeId) {
  const n=doc.nodes.find(n=>n.id===nodeId);if(!n)return [];
  if(n.kitchenModule&&!KITCHEN_MODULE_TYPES[n.kitchenModuleType||'cabinet']?.storage)return [];
  if(n.carCompartment)return [{nodeId:n.id,name:n.name,kind:n.kind,carCompartment:n.carCompartment,rect:[0,0,1,1],fill:storageFill(doc,n.id)??Math.min(100,carItemCount(doc,n.id)*12.5)}];
  const children=storageChildren(doc,nodeId);
  if(!children.length)return [{nodeId:n.id,name:n.fridgeChamber?n.name:'Основное пространство',kind:'space',rect:[0,0,1,1]}];
  const shape=planForNode(doc,n).furniture.find(f=>f.id===n.furnitureId);
  if(shape?.type==='trailSuv')return children.map((c,i)=>({nodeId:c.id,name:c.name,kind:c.kind,carCompartment:c.carCompartment||'cabin',rect:[i/children.length,0,1/children.length,1],fill:storageFill(doc,c.id)??Math.min(100,carItemCount(doc,c.id)*12.5)}));
  if(shape?.type==='fridge')return fridgeChambers(shape).flatMap(c=>{const child=children.find(n=>n.fridgeChamber===c.key);return child?[{nodeId:child.id,name:child.name,kind:child.kind,fridgeChamber:c.key,rect:[0,0,1,1]}]:[];});
  if(isKitchenType(shape?.type))return kitchenModules(shape).modules.flatMap(m=>{const child=children.find(c=>c.kitchenModule===m.key);return child?[{nodeId:child.id,name:child.name,kind:child.kind,moduleKey:m.key,moduleType:m.type,rect:[0,0,1,1]}]:[];});
  if(!n.storageLayout&&(n.autoLayout||children.some(c=>c.autoSection))){
    const {columns}=automaticGrid(n.kitchenModule?{type:'kitchen',width:.6}:shape||{type:n.modelType||'kitchen'},children.length),rows=Math.ceil(children.length/columns);
    return children.map((c,i)=>({nodeId:c.id,name:c.name,kind:c.kind,rect:[i%columns/columns,Math.floor(i/columns)/rows,1/columns,1/rows]}));
  }
  const layout=n.storageLayout||{},columns=Math.min(6,Math.max(1,layout.columns||1)),saved=layout.zones||[];
  // Stale IDs after moving/deleting a section are ignored. New sections receive free cells.
  const ids=new Set(children.map(n=>n.id));const valid=saved.filter(z=>ids.has(z.nodeId));
  const newNodes=children.filter(n=>!valid.some(z=>z.nodeId===n.id));
  if(valid.length&&newNodes.length===0)return children.map(child=>({...valid.find(z=>z.nodeId===child.id),name:child.name,kind:child.kind}));
  // If the structure changed, reflow all sections safely instead of overlapping new cells.
  const count=children.length,rows=Math.ceil(count/columns);
  return children.map((child,i)=>({nodeId:child.id,name:child.name,kind:child.kind,rect:[(i%columns)/columns,Math.floor(i/columns)/rows,1/columns,1/rows]}));
}
// A section may override its furniture's fill, including an explicit 0%.
export function storageFill(doc,nodeId){
 const seen=new Set();let n=doc.nodes.find(n=>n.id===nodeId);
 while(n&&n.kind!=='room'&&!seen.has(n.id)){seen.add(n.id);if(Number.isFinite(n.fill))return Math.max(0,Math.min(100,n.fill));n=doc.nodes.find(p=>p.id===n.parentId);}
 return null;
}
function carItemCount(doc,id,seen=new Set()){if(seen.has(id))return 0;seen.add(id);return doc.nodes.filter(n=>n.parentId===id&&!n.archived).reduce((count,n)=>count+(n.kind==='item'?1:carItemCount(doc,n.id,seen)),0);}
export function layoutZones(doc,nodeId){return rawLayoutZones(doc,nodeId).map(zone=>({...zone,fill:storageFill(doc,zone.nodeId)??storageFill(doc,nodeId)??zone.fill??null}));}
export function arrangeStorage(doc,nodeId,{template='shelves',columns=1,rows=3,replace=false}={}) {
  const n=doc.nodes.find(n=>n.id===nodeId&&!n.archived&&n.kind!=='item'&&n.kind!=='room');if(!n)throw Error('Выберите место хранения');
  columns=Number(columns);rows=Number(rows);
  if(!Number.isInteger(columns)||columns<1||columns>6||!Number.isInteger(rows)||rows<1||rows>12||!LAYOUT_TEMPLATES.some(([id])=>id===template))throw Error('Сетка: 1–6 столбцов и 1–12 рядов');
  const children=storageChildren(doc,nodeId),capacity=template==='wardrobe'?1+2*rows:columns*rows;
  if(children.length>capacity&&!replace)throw Error(`Нужно не менее ${children.length} секций: существующие места хранения не удаляются`);
  return {n,children,capacity,template,columns,rows};
}
export function sectionRects(template,columns,rows,count) {
  if(template==='wardrobe')return Array.from({length:count},(_,i)=>i===0?[0,0,1,.22]:[(i-1)%2*.5,.22+Math.floor((i-1)/2)*.78/rows,.5,.78/rows]);
  return Array.from({length:count},(_,i)=>[(i%columns)/columns,Math.floor(i/columns)/rows,1/columns,1/rows]);
}
export function validateStorageLayout(n) {
  const l=n.storageLayout;if(l==null)return;
  if(!l||!Array.isArray(l.zones)||l.zones.length>72||!Number.isInteger(l.columns)||l.columns<1||l.columns>6||!Number.isInteger(l.rows)||l.rows<1||l.rows>12)throw Error('Некорректная схема хранения');
  const seen=new Set();for(const z of l.zones){if(typeof z.nodeId!=='string'||seen.has(z.nodeId)||!Array.isArray(z.rect)||z.rect.length!==4||z.rect.some(v=>!Number.isFinite(v))||z.rect[0]<0||z.rect[1]<0||z.rect[2]<.025||z.rect[3]<.025||z.rect[0]+z.rect[2]>1.001||z.rect[1]+z.rect[3]>1.001)throw Error('Некорректные размеры секции');seen.add(z.nodeId);}
  for(let i=0;i<l.zones.length;i++)for(let j=i+1;j<l.zones.length;j++){const a=l.zones[i].rect,b=l.zones[j].rect;if(Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0])>.001&&Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1])>.001)throw Error('Секции не должны перекрываться');}
}
