export const CATEGORY_ICONS = [
  ['box','Коробка'],['folder','Папка'],['home','Дом'],['furniture','Мебель'],
  ['sofa','Диван'],['bed','Кровать'],['wardrobe','Шкаф'],['shelf','Стеллаж'],['desk','Стол'],
  ['clothes','Одежда'],['shoes','Обувь'],['key','Аксессуары'],['laptop','Компьютер'],
  ['monitor','Монитор'],['phone','Телефон'],['camera','Фото и видео'],['film','Аудио и кино'],
  ['plug','Периферия'],['bridge','Сетевое оборудование'],['games','Игры'],
  ['washer','Стиральная машина'],['fridge','Холодильник'],['stove','Приготовление пищи'],
  ['microwave','Микроволновая печь'],['coffee','Кофе'],['cool','Холод'],['fan','Вентиляция'],
  ['dishes','Посуда'],['food','Продукты'],['milk','Молочные продукты'],
  ['tools','Инструменты'],['sport','Спорт'],['outdoor','Туризм'],['car','Транспорт'],
  ['medicine','Аптечка'],['cleaning','Уборка'],['bath','Ванная'],['dry','Уход и гигиена'],
  ['book','Книги'],['documents','Документы'],['hobby','Творчество'],['palette','Искусство'],
  ['pets','Животные'],['flower','Растения'],['leaf','Сад'],['bulb','Освещение'],
  ['sparkles','Декор'],['trophy','Коллекция'],['clock','Часы'],['shield','Защита'],
];

// Validate the complete destination chain before touching the saved tree.
export function planCategoryMove(doc,categoryId,parentId=null) {
  const byId=new Map(doc.categories.map(c=>[c.id,c])),category=byId.get(categoryId);
  if(!category)throw Error('Категория не найдена');
  if(parentId!==null&&!byId.has(parentId))throw Error('Родительская категория не найдена');
  const seen=new Set();
  for(let id=parentId;id;id=byId.get(id)?.parentId){
    if(id===categoryId)throw Error('Нельзя перенести категорию в себя или свою подкатегорию');
    if(seen.has(id)||!byId.has(id))throw Error('Некорректная иерархия категорий');
    seen.add(id);
  }
  return {categoryId,parentId,changed:(category.parentId||null)!==parentId};
}
export function moveCategory(doc,categoryId,parentId=null) {
  const plan=planCategoryMove(doc,categoryId,parentId);
  if(plan.changed)doc.categories.find(c=>c.id===categoryId).parentId=parentId;
  return plan;
}
// A drop beside another row changes the sibling order; a drop in its centre
// nests the dragged category. The canonical category IDs and item links stay put.
export function placeCategory(doc,categoryId,targetId=null,position='inside') {
  if(!['inside','before','after'].includes(position))throw Error('Некорректное место переноса');
  const target=targetId==null?null:doc.categories.find(c=>c.id===targetId);
  if(targetId!=null&&!target)throw Error('Категория назначения не найдена');
  if(targetId===categoryId)throw Error('Выберите другую категорию');
  const parentId=position==='inside'?targetId:(target?.parentId||null);
  const plan=planCategoryMove(doc,categoryId,parentId);
  const siblings=doc.categories.filter(c=>(c.parentId||null)===parentId&&c.id!==categoryId)
    .sort((a,b)=>(a.order??Number.MAX_SAFE_INTEGER)-(b.order??Number.MAX_SAFE_INTEGER)||a.name.localeCompare(b.name,'ru'));
  const index=position==='inside'?siblings.length:siblings.findIndex(c=>c.id===targetId)+(position==='after'?1:0);
  const category=doc.categories.find(c=>c.id===categoryId),previousOrder=category.order;
  category.parentId=parentId;
  siblings.splice(Math.max(0,index),0,category);
  siblings.forEach((c,i)=>{c.order=i;});
  return {...plan,changed:plan.changed||previousOrder!==category.order,order:category.order};
}
export function setCategoryIcon(doc,categoryId,glyph) {
  const category=doc.categories.find(c=>c.id===categoryId);
  if(!category)throw Error('Категория не найдена');
  if(glyph!==null&&!CATEGORY_ICONS.some(([id])=>id===glyph))throw Error('Выберите значок категории из набора');
  if(glyph===null)delete category.icon;else category.icon=glyph;
}

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
