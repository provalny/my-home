// Saved actions form one ordered history: plan geometry and inventory cards
// must be restored together. Only commit a step after persistence succeeds.
export function createActionHistory(limit = 20) {
  const past = [], future = [];
  return {
    peek(redo = false) { return (redo ? future : past).at(-1); },
    record(document, description) {
      past.push({ document: structuredClone(document), ...description });
      if (past.length > limit) past.shift();
      future.length = 0;
    },
    complete(redo, current) {
      const source = redo ? future : past, target = redo ? past : future;
      const entry = source.pop();
      if (entry) target.push({ ...entry, document: structuredClone(current) });
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
  const changed = key => JSON.stringify(before[key]) !== JSON.stringify(after[key]);
  if (changed('plan')) return { label: 'Изменение квартиры', section: 'space' };
  if (changed('categories')||changed('collections')) return { label: 'Изменение категорий и подборок', section: 'categories' };
  if (changed('settings')) return { label: 'Изменение настроек', section: 'settings' };
  const previousEvents = new Set(before.events.map(e => e.id));
  const events = after.events.filter(e => !previousEvents.has(e.id));
  const names = { addition: 'Добавление', purchase: 'Покупка', move: 'Перемещение', archive: 'Архивирование', value: 'Изменение стоимости', restore: 'Возврат из архива', delete: 'Удаление', recover: 'Восстановление' };
  if (events.length) {
    const event = events[0], count = new Set(events.map(e => e.nodeId)).size;
    return { label: `${names[event.type] || 'Изменение'}: ${event.name}${count > 1 ? ` и ещё ${count - 1}` : ''}`, section };
  }
  const previousNodes = new Map(before.nodes.map(n => [n.id, JSON.stringify(n)]));
  const nodes = after.nodes.filter(n => previousNodes.get(n.id) !== JSON.stringify(n));
  return { label: nodes.length ? `Изменение: ${nodes[0].name}${nodes.length > 1 ? ` и ещё ${nodes.length - 1}` : ''}` : 'Изменение данных', section };
}
