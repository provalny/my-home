// Resolve live storage ancestry, without inventing positions for possessions
// that have an address but no individual 3D geometry.
export function planLocation(doc, nodeId) {
  const nodes = new Map(doc.nodes.map(n => [n.id, n]));
  const chain = [], seen = new Set();
  for (let n = nodes.get(nodeId); n; n = nodes.get(n.parentId)) {
    if (seen.has(n.id)) return { reason: 'Не удалось определить место хранения.' };
    seen.add(n.id);chain.push(n);
  }
  if (!chain.length) return { reason: 'Вещь больше не найдена.' };
  if (chain.some(n => n.archived)) return { reason: 'Объект в архиве. Сначала верните его в действующее место хранения.' };
  const room = chain.find(n => n.kind === 'room');
  if (!room || room.virtual) return { reason: 'Место на плане не назначено. Сначала переместите вещь из «Без места».' };
  if (!doc.plan.rooms.some(r => r.id === room.roomId)) return { reason: 'Комната ещё не размещена на плане.' };
  const shapes = new Map(doc.plan.furniture.map(f => [f.id, f]));
  const anchor = chain.find(n => shapes.has(n.furnitureId));
  const node = chain[0], placeId = node.kind === 'item' ? node.parentId : node.id;
  const base = { roomId: room.id, roomGeometryId: room.roomId, placeId };
  if (!anchor) return { ...base, note: chain.some(n => !['item', 'room'].includes(n.kind)) ? 'Место хранения не размещено на плане. Показана комната, в которой оно находится.' : 'Показана комната, в которой находится вещь.' };
  const path = chain.slice(0, chain.indexOf(anchor) + 1).reverse();
  const shape = shapes.get(anchor.furnitureId);
  const focus = path.find(n => shape.type === 'kitchen' && n.kitchenModule || shape.type === 'fridge' && n.fridgeChamber) || anchor;
  const section = path[path.indexOf(focus) + 1];
  return { ...base, anchorId: anchor.id, focusId: focus.id, sectionId: section?.kind !== 'item' ? section?.id || focus.id : focus.id };
}
