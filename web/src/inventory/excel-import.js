import { ensureUnplaced, id, newNode, UNPLACED_ID } from './model.js';

export const EXCEL_IMPORT_LIMIT = 5000;
export const EXCEL_FILE_LIMIT = 10 * 1024 * 1024;
const blank = value => value == null || typeof value === 'string' && !value.trim();
const key = value => value.trim().normalize('NFC').toLocaleLowerCase('ru');
const headers = [
  ['название', 'название предмета', 'наименование', 'name'],
  ['категория', 'category'], ['подкатегория', 'subcategory'], ['вес', 'вес, г', 'вес (г)', 'weight'],
];
function text(value, label, row) {
  if (blank(value)) return '';
  if (!['string', 'number'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value)) throw Error(`Строка ${row}: ${label} должно быть текстом.`);
  const result = String(value).trim();
  if (result.length > 200) throw Error(`Строка ${row}: ${label} длиннее 200 символов.`);
  return result;
}

// Column positions are fixed, even when intermediate cells are empty.
export function inventoryImportRows(rows) {
  if (!Array.isArray(rows)) throw Error('Не удалось прочитать строки Excel.');
  const items = [];
  let first = true;
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i];
    if (cells == null) continue;
    if (!Array.isArray(cells)) throw Error(`Строка ${i + 1}: неверный формат.`);
    if (cells.every(blank)) continue;
    const row = i + 1;
    if (cells.slice(4).some(value => !blank(value))) throw Error(`Строка ${row}: нужны только четыре столбца: название, категория, подкатегория, вес в граммах.`);
    if (first && !blank(cells[0]) && headers[0].includes(key(String(cells[0]))) && [1, 2, 3].every(col => blank(cells[col]) || headers[col].includes(key(String(cells[col]))))) {
      first = false;
      continue;
    }
    first = false;
    const name = text(cells[0], 'название', row), category = text(cells[1], 'название категории', row), subcategory = text(cells[2], 'название подкатегории', row);
    if (!name) throw Error(`Строка ${row}: заполните название в первом столбце.`);
    if (subcategory && !category) throw Error(`Строка ${row}: для подкатегории укажите категорию во втором столбце.`);
    let weight = '';
    if (!blank(cells[3])) {
      const value = cells[3];
      const normalized = String(value).trim().replace(',', '.');
      if (!['number', 'string'].includes(typeof value) || !/^\d+(?:\.\d+)?$/.test(normalized) || !Number.isFinite(Number(normalized)) || Number(normalized) > Number.MAX_SAFE_INTEGER) throw Error(`Строка ${row}: вес должен быть числом в граммах, не меньше нуля.`);
      weight = String(Number(normalized));
    }
    items.push({ row, name, category, subcategory, weight });
    if (items.length > EXCEL_IMPORT_LIMIT) throw Error(`За один раз можно добавить не больше ${EXCEL_IMPORT_LIMIT} вещей.`);
  }
  if (!items.length) throw Error('На первом листе нет вещей. Заполните хотя бы первый столбец — название.');
  return items;
}

// Validate every row before changing anything; the caller commits one undoable save.
export function importInventoryRows(doc, rows) {
  const items = inventoryImportRows(rows);
  if (doc.nodes.length + items.length + (doc.nodes.some(n => n.id === UNPLACED_ID) ? 0 : 1) > 50000) throw Error('После импорта будет больше 50 000 объектов. Уменьшите файл.');
  ensureUnplaced(doc);
  const categories = new Map(doc.categories.map(c => [JSON.stringify([c.parentId || '', key(c.name)]), c.id]));
  function categoryId(name, parentId = '') {
    if (!name) return '';
    const lookup = JSON.stringify([parentId, key(name)]);
    if (!categories.has(lookup)) {
      const category = { id: id(), name, parentId: parentId || null, kind: 'default' };
      doc.categories.push(category);
      categories.set(lookup, category.id);
    }
    return categories.get(lookup);
  }
  return items.map(item => {
    const parent = categoryId(item.category);
    return newNode(doc, { name: item.name, kind: 'item', parentId: UNPLACED_ID,
      categoryId: item.subcategory ? categoryId(item.subcategory, parent) : parent,
      fields: item.weight === '' ? {} : { 'Вес, г': item.weight } });
  });
}

export async function readInventoryExcel(file) {
  if (!file || !/\.xlsx$/i.test(file.name || '')) throw Error('Выберите файл Excel .xlsx. Старый .xls нужно пересохранить в формате .xlsx.');
  if (!file.size) throw Error('Файл пуст. Выберите заполненный файл Excel .xlsx.');
  if (file.size > EXCEL_FILE_LIMIT) throw Error('Размер Excel-файла больше 10 МБ. Разделите его на несколько файлов.');
  let rows;
  try {
    const { readSheet } = await import('read-excel-file/universal');
    rows = await readSheet(await file.arrayBuffer(), 1);
  } catch {
    throw Error('Не удалось прочитать Excel. Откройте файл и пересохраните его как .xlsx без пароля.');
  }
  inventoryImportRows(rows);
  return rows;
}
