import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionHistory, describeAction, historyShortcut } from './action-history.js';

test('saved editor and catalog actions undo and redo in one order with their destinations', () => {
  const history = createActionHistory();
  let doc = { plan: { name: 'Before' }, item: 'Before' };
  history.record(doc, { label: 'План', section: 'space' });
  doc.plan.name = 'After';
  history.record(doc, { label: 'Вещь', section: 'catalog' });
  doc.item = 'After';
  for (const [redo, label, section, plan, item] of [
    [false, 'Вещь', 'catalog', 'After', 'Before'],
    [false, 'План', 'space', 'Before', 'Before'],
    [true, 'План', 'space', 'After', 'Before'],
    [true, 'Вещь', 'catalog', 'After', 'After'],
  ]) {
    const entry = history.peek(redo);
    assert.equal(entry.label, label);
    assert.equal(entry.section, section);
    const next = structuredClone(entry.document);
    history.complete(redo, doc);
    doc = next;
    assert.deepEqual(doc, { plan: { name: plan }, item });
  }
  assert.equal(history.peek(true), undefined);
});

test('new action discards redo, bounded snapshots are isolated, clearing removes both directions', () => {
  const history = createActionHistory(2), doc = { value: 0 };
  for (let i = 0; i < 3; i++) { doc.value = i; history.record(doc, { label: String(i), section: 'space' }); }
  doc.value = 9;
  assert.equal(history.peek().document.value, 2);
  history.complete(false, doc);
  assert.equal(history.peek().document.value, 1);
  history.complete(false, doc);
  assert.equal(history.peek(), undefined);
  history.record(doc, { label: 'New', section: 'catalog' });
  assert.equal(history.peek(true), undefined);
  history.complete(false, doc);
  history.clear();
  assert.equal(history.peek(), undefined);
  assert.equal(history.peek(true), undefined);
});

test('descriptions identify changed data and show geometry changes in the apartment', () => {
  const before = { plan: {}, events: [], nodes: [{ id: 'a', name: 'Вещь' }], settings: {}, categories: [] };
  const changed = structuredClone(before);changed.plan.name = 'План';
  assert.deepEqual(describeAction(before, changed, 'catalog'), { label: 'Изменение квартиры', section: 'space' });
  const moved = structuredClone(before);moved.events.push({ id: '1', type: 'move', nodeId: 'a', name: 'Вещь' });
  assert.deepEqual(describeAction(before, moved, 'unplaced'), { label: 'Перемещение: Вещь', section: 'unplaced' });
  const renamed = structuredClone(before);renamed.nodes[0].name = 'Новое название';
  assert.equal(describeAction(before, renamed, 'catalog').label, 'Изменение: Новое название');
});

test('undo shortcuts support Mac, Windows and Russian layouts without intercepting other commands', () => {
  assert.equal(historyShortcut({ code: 'KeyZ', key: 'я', metaKey: true }), 'undo');
  assert.equal(historyShortcut({ code: 'KeyZ', key: 'Я', metaKey: true, shiftKey: true }), 'redo');
  assert.equal(historyShortcut({ key: 'z', ctrlKey: true }), 'undo');
  assert.equal(historyShortcut({ code: 'KeyY', ctrlKey: true }), 'redo');
  assert.equal(historyShortcut({ code: 'KeyY', metaKey: true }), null);
  assert.equal(historyShortcut({ code: 'KeyZ' }), null);
  assert.equal(historyShortcut({ code: 'KeyZ', ctrlKey: true, altKey: true }), null);
});
