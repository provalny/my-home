import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from './model.js';
import { createActionHistory } from './action-history.js';
import { EXCEL_FILE_LIMIT, EXCEL_IMPORT_LIMIT, inventoryImportRows, importInventoryRows, previewInventoryImport, readInventoryExcel } from './excel-import.js';

const seed = () => M.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json', import.meta.url), 'utf8')));
const fixture = () => new File([readFileSync(new URL('./fixtures/quick-import.xlsx', import.meta.url))], 'Вещи.xlsx');

test('optional headings, sparse columns, empty rows, decimal comma and zero weight preserve column positions', () => {
  const items = inventoryImportRows([[], ['Название', 'Категория', 'Подкатегория', 'Вес, г'], ['  Ложка  '], [], ['Гайка', null, null, 0], ['Футболка', 'Одежда', 'Летняя', '12,5']]);
  assert.deepEqual(items, [
    { row: 3, name: 'Ложка', category: '', subcategory: '', weight: '', priceCents: null },
    { row: 5, name: 'Гайка', category: '', subcategory: '', weight: '0', priceCents: null },
    { row: 6, name: 'Футболка', category: 'Одежда', subcategory: 'Летняя', weight: '12.5', priceCents: null },
  ]);
  assert.equal(inventoryImportRows([['Название'], ['Кружка']])[0].name, 'Кружка');
  assert.equal(inventoryImportRows([['Кружка']])[0].name, 'Кружка');
  assert.equal(inventoryImportRows([['Название', '', '', '', 'Цена, ₽'], ['Чайник', '', '', '', '1 299,50']])[0].priceCents, 129950);
  assert.equal(inventoryImportRows([['Чайник', '', '', '', 0]])[0].priceCents, 0);
});

test('import creates separate unplaced things and reuses categories only under the same parent', () => {
  const d = seed(), before = structuredClone(d), root = d.categories.find(c => c.id === 'clothes');
  d.categories.push({ id: 'existing-child', name: 'Летняя', parentId: root.id, kind: 'default' });
  const rows = [['Название', 'Категория', 'Подкатегория', 'Вес'], ['Футболка', root.name.toUpperCase(), ' летняя ', 250], ['Кабель', 'Новая категория', 'Летняя', '0,5'], ['Кружка'], ['Кружка']];
  const added = importInventoryRows(d, rows, { duplicateMode:'add' });
  M.validate(d);
  assert.equal(added.length, 4);
  for (const node of added) {
    assert.equal(node.kind, 'item');assert.equal(node.parentId, M.UNPLACED_ID);
    assert.equal(node.quantity, 1);assert.equal(node.purchaseCents, null);assert.equal(node.acquisition, 'existing');
    assert.equal(node.archived, null);assert.equal(node.furnitureId, undefined);
  }
  assert.equal(added[0].categoryId, 'existing-child');assert.deepEqual(added[0].fields, { 'Вес, г': '250' });
  assert.notEqual(added[1].categoryId, 'existing-child');
  assert.equal(M.categoryName(d, added[1].categoryId), 'Новая категория / Летняя');
  assert.deepEqual(added[1].fields, { 'Вес, г': '0.5' });
  assert.equal(added[2].categoryId, '');assert.deepEqual(added[2].fields, {});assert.notEqual(added[2].id, added[3].id);
  assert.deepEqual(d.plan, before.plan);assert.deepEqual(d.trash, before.trash);
  assert.deepEqual(d.nodes.filter(n => before.nodes.some(old => old.id === n.id)), before.nodes);
  assert.equal(d.events.length, before.events.length + 4);
  const count = d.categories.length;
  importInventoryRows(d, [['Кабель 2', 'НОВАЯ КАТЕГОРИЯ', 'летняя']]);
  assert.equal(d.categories.length, count);
});

test('preview warns about catalogue matches and file repeats without changing data; default import skips both', () => {
  const d=seed(), before=JSON.stringify(d);
  const rows=[['Название','Категория','Подкатегория','Вес','Цена'],
    [' macbook ','Электроника',null,null,149990],['Ноутбук','Электроника',null,null,'3 500,25'],
    ['НОУТБУК',null,null,null,50],['Зарядка',null,null,null,0]];
  const preview=previewInventoryImport(d,rows);
  assert.equal(JSON.stringify(d),before);
  assert.equal(preview.existingDuplicates.length,1);
  assert.equal(preview.fileDuplicates.length,1);
  assert.deepEqual(preview.newItems.map(item=>item.name),['Ноутбук','Зарядка']);
  assert.equal(previewInventoryImport(d,[['Шкаф в спальне']]).existingDuplicates.length,1);
  const added=importInventoryRows(d,rows);
  M.validate(d);
  assert.deepEqual(added.map(n=>n.name),['Ноутбук','Зарядка']);
  assert.deepEqual(added.map(n=>n.purchaseCents),[350025,0]);
  assert.equal(importInventoryRows(d,rows).length,0);
  assert.equal(d.nodes.filter(n=>n.name==='Ноутбук').length,1);
});

test('explicit add-all can import intentional identical things', () => {
  const d=seed();
  const added=importInventoryRows(d,[['MacBook'],['MacBook']],{duplicateMode:'add'});
  assert.equal(added.length,2);
  assert.notEqual(added[0].id,added[1].id);
  M.validate(d);
});

test('one undo removes the whole import including new categories; redo restores it', () => {
  const before = seed(), after = structuredClone(before), history = createActionHistory();
  importInventoryRows(after, [['Рюкзак', 'Поход', 'Снаряжение', 500], ['Карабин']]);
  history.record(before, { label: 'Импорт вещей из Excel', section: 'settings' }, after);
  const undone = history.applyTo(structuredClone(after));M.validate(undone);assert.deepEqual(undone, before);
  history.complete(false);const redone = history.applyTo(undone, true);M.validate(redone);assert.deepEqual(redone, after);
});

test('invalid rows reject the entire import before any mutation and report the Excel row', () => {
  const invalid = [
    [['', 'Категория'], /Строка 2.*первом/],
    [['Вещь', '', 'Подкатегория'], /Строка 2.*втором/],
    [['Вещь', '', '', -1], /Строка 2.*вес/],
    [['Вещь', '', '', 'тяжёлый'], /Строка 2.*вес/],
    [['Вещь', '', '', true], /Строка 2.*вес/],
    [[new Date()], /Строка 2.*текстом/],
    [['Вещь', {}, ''], /Строка 2.*текстом/],
    [['Вещь', '', '', '', '', 'Лишнее'], /Строка 2.*пять/],
    [['Вещь', '', '', '', 'не цена'], /Строка 2.*цена/],
    [['Вещь', '', '', '', -1], /Строка 2.*цена/],
    [['Вещь', '', '', '', '1,234'], /Строка 2.*цена/],
    [['А'.repeat(201)], /Строка 2.*200/],
  ];
  for (const [row, error] of invalid) {
    const d = seed(), before = JSON.stringify(d);
    assert.throws(() => importInventoryRows(d, [['Верная вещь', 'Новая категория'], row]), error);
    assert.equal(JSON.stringify(d), before);
  }
  for (const rows of [[], [[], [null]], [['Название', 'Категория', 'Подкатегория', 'Вес']]]) assert.throws(() => inventoryImportRows(rows), /нет вещей/);
  assert.throws(() => inventoryImportRows(Array.from({ length: EXCEL_IMPORT_LIMIT + 1 }, () => ['Вещь'])), /не больше 5000/);
});

test('compressed Excel with shared strings and sparse cells reads only the first sheet', async () => {
  const rows = await readInventoryExcel(fixture()), parsed = inventoryImportRows(rows), d = seed();
  assert.deepEqual(parsed.map(item => item.name), ['Кружка & блюдце', 'Термос', 'Одна вещь']);
  assert.equal(parsed[1].row, 4);assert.equal(parsed[1].weight, '125.5');
  assert.equal(parsed[1].category, '');assert.equal(parsed[1].subcategory, '');
  const items = importInventoryRows(d, rows);M.validate(d);
  assert.equal(items.length, 3);assert.equal(M.categoryName(d, items[0].categoryId), 'Посуда тест / Кружки');
});

test('wrong formats, empty, oversized and broken workbooks provide actionable errors', async () => {
  await assert.rejects(readInventoryExcel(new File(['test'], 'old.xls')), /пересохранить/);
  await assert.rejects(readInventoryExcel(new File([], 'empty.xlsx')), /пуст/);
  await assert.rejects(readInventoryExcel({ name: 'large.xlsx', size: EXCEL_FILE_LIMIT + 1 }), /10 МБ/);
  await assert.rejects(readInventoryExcel(new File(['not a zip'], 'broken.xlsx')), /пересохраните/);
});
