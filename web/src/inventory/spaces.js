// The original plan stays at the version-1 envelope's root for old backups and
// the native bridge. Extra spaces share the very same cards, ledger and settings.
export const PRIMARY_SPACE_ID = 'home';
export const SPACE_TYPES = [['apartment','Квартира'],['work','Работа'],['garage','Гараж'],['other','Другое']];
export function listSpaces(doc) {
  return [{id:PRIMARY_SPACE_ID,name:doc.space?.name||doc.plan.name||'Моя квартира',type:doc.space?.type||'apartment',plan:doc.plan},...(doc.spaces||[])];
}
export const getSpace=(doc,id)=>listSpaces(doc).find(s=>s.id===id);
export function createSpaceResolver(doc) {
  const byId=new Map(doc.nodes.map(n=>[n.id,n])),spaces=new Map(listSpaces(doc).map(s=>[s.id,s])),cache=new Map();
  return nodeOrId=>{let n=typeof nodeOrId==='string'?byId.get(nodeOrId):nodeOrId;const chain=[],seen=new Set();
    while(n&&n.kind!=='room'&&!cache.has(n.id)){if(seen.has(n.id))return null;seen.add(n.id);chain.push(n.id);n=byId.get(n.parentId);}
    const space=cache.has(n?.id)?cache.get(n.id):n&&!n.virtual?spaces.get(n.spaceId||PRIMARY_SPACE_ID)||null:null;
    for(const id of chain)cache.set(id,space);return space;
  };
}
export const spaceForNode=(doc,node)=>createSpaceResolver(doc)(node);
export const planForNode=(doc,node)=>spaceForNode(doc,node)?.plan||doc.plan;
export const allFurniture=doc=>listSpaces(doc).flatMap(s=>s.plan.furniture);
