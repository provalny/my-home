// History keeps reversible changes, not twenty copies of photos and the entire ledger.
export function sameValue(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b,key) && sameValue(a[key],b[key]));
}
const entities = value => Array.isArray(value) && value.every(x => x && typeof x.id === 'string') && new Set(value.map(x=>x.id)).size === value.length;
function diff(before, after) {
  if (before === after) return null;
  if (entities(before) && entities(after)) {
    const old = new Map(before.map(x=>[x.id,x])), next = new Map(after.map(x=>[x.id,x]));
    const remove = before.filter(x=>!next.has(x.id)).map(x=>x.id), changes = [];
    for (const value of after) { const patch = diff(old.get(value.id),value); if (patch) changes.push([value.id,patch]); }
    const order = sameValue(before.map(x=>x.id),after.map(x=>x.id)) ? null : after.map(x=>x.id);
    return remove.length || changes.length || order ? {kind:'entities',remove,changes,order} : null;
  }
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
    const remove = Object.keys(before).filter(key=>!Object.hasOwn(after,key)), changes = [];
    for (const key of Object.keys(after)) { const patch = diff(before[key],after[key]); if (patch) changes.push([key,patch]); }
    return remove.length || changes.length ? {kind:'object',remove,changes} : null;
  }
  return sameValue(before,after) ? null : {kind:'value',value:structuredClone(after)};
}
function apply(value, patch) {
  if (!patch) return value;
  if (patch.kind === 'value') return structuredClone(patch.value);
  if (patch.kind === 'object') {
    value ||= {};
    for (const key of patch.remove) delete value[key];
    for (const [key,change] of patch.changes) value[key] = apply(value[key],change);
    return value;
  }
  const removed = new Set(patch.remove), values = new Map(value.filter(x=>!removed.has(x.id)).map(x=>[x.id,x]));
  for (const [id,change] of patch.changes) values.set(id,apply(values.get(id),change));
  // Audit entries created by undo/redo remain visible without reintroducing cancelled purchases.
  if (!patch.order) return [...values.values()];
  const ordered = new Set(patch.order);
  return [...patch.order.filter(id=>values.has(id)).map(id=>values.get(id)), ...[...values].filter(([id])=>!ordered.has(id)).map(([,v])=>v)];
}
function weight(value) {
  if (typeof value === 'string') return value.length * 2;
  if (!value || typeof value !== 'object') return 8;
  return Object.entries(value).reduce((sum,[key,v])=>sum+key.length*2+weight(v),0);
}
export function createActionHistory(limit = 20, byteLimit = 16 * 1024 * 1024) {
  const past = [], future = [];
  return {
    peek(redo = false) { return (redo ? future : past).at(-1); },
    record(before, description, after) {
      if (!after) throw Error('History requires the saved result');
      const forward = diff(before,after), backward = diff(after,before);
      if (!forward) return;
      const entry = {...description,forward,backward};entry.bytes=weight(entry);
      past.push(entry);future.length=0;
      let bytes=past.reduce((sum,e)=>sum+e.bytes,0);
      while (past.length > limit || past.length > 1 && bytes > byteLimit) bytes-=past.shift().bytes;
    },
    applyTo(document, redo = false) {
      const entry=this.peek(redo);
      if (!entry) return document;
      return apply(document,redo?entry.forward:entry.backward);
    },
    complete(redo) {
      const source = redo ? future : past, target = redo ? past : future;
      const entry = source.pop();if (entry) target.push(entry);
    },
    clear() { past.length = 0; future.length = 0; },
  };
}

export function historyShortcut(event) {
  if (event.altKey || !(event.metaKey || event.ctrlKey)) return null;
  const key = event.code || event.key.toLowerCase();
  if (key === 'KeyZ' || key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (event.ctrlKey && !event.metaKey && (key === 'KeyY' || key === 'y')) return 'redo';
  return null;
}

export const editingText = element => Boolean(element?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])'));

export function describeAction(before, after, section) {
  const changed = key => !sameValue(before[key],after[key]);
  if (changed('plan')||changed('spaces')||changed('space')) return { label: 'Изменение пространства', section: 'space' };
  if (changed('categories')||changed('collections')) return { label: 'Изменение категорий и подборок', section: 'categories' };
  if (changed('settings')) return { label: 'Изменение настроек', section: 'settings' };
  const previousEvents = new Set(before.events.map(e => e.id));
  const events = after.events.filter(e => !previousEvents.has(e.id));
  const names = { addition: 'Добавление', purchase: 'Покупка', move: 'Перемещение', archive: 'Архивирование', value: 'Изменение стоимости', restore: 'Возврат из архива', delete: 'Удаление', recover: 'Восстановление' };
  if (events.length) {
    const event = events[0], count = new Set(events.map(e => e.nodeId)).size;
    return { label: `${names[event.type] || 'Изменение'}: ${event.name}${count > 1 ? ` и ещё ${count - 1}` : ''}`, section };
  }
  const previousNodes = new Map(before.nodes.map(n => [n.id,n]));
  const nodes = after.nodes.filter(n => !sameValue(previousNodes.get(n.id),n));
  return { label: nodes.length ? `Изменение: ${nodes[0].name}${nodes.length > 1 ? ` и ещё ${nodes.length - 1}` : ''}` : 'Изменение данных', section };
}
