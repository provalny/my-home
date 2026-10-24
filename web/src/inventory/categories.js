// Delete only checked entries. Unchecked descendants keep the closest surviving parent.
export function planCategoryRemoval(doc,categoryIds) {
  const ids=new Set(categoryIds),byId=new Map(doc.categories.map(c=>[c.id,c]));
  if(!ids.size||[...ids].some(id=>!byId.has(id)))throw Error('Выберите существующие категории для удаления');
  const parents=new Map();
  for(const c of doc.categories)if(!ids.has(c.id)&&ids.has(c.parentId)) {
    let parent=c.parentId;const seen=new Set([c.id]);
    while(ids.has(parent)) {
      if(seen.has(parent))throw Error('Некорректная иерархия категорий');
      seen.add(parent);parent=byId.get(parent)?.parentId||null;
    }
    parents.set(c.id,parent||null);
  }
  const nodes=[...doc.nodes,...(doc.trash||[]).flatMap(entry=>entry.nodes)];
  return {ids,parents,cleared:nodes.filter(n=>ids.has(n.categoryId)).length};
}
export function removeCategories(doc,categoryIds) {
  const plan=planCategoryRemoval(doc,categoryIds);
  doc.categories=doc.categories.filter(c=>!plan.ids.has(c.id));
  for(const c of doc.categories)if(plan.parents.has(c.id))c.parentId=plan.parents.get(c.id);
  for(const n of [...doc.nodes,...(doc.trash||[]).flatMap(entry=>entry.nodes)])if(plan.ids.has(n.categoryId))n.categoryId='';
  return {removed:plan.ids.size,cleared:plan.cleared,reparented:plan.parents.size};
}
