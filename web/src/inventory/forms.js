import './forms.css';
import { itemWear, resolvedWearMode } from './wear.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import * as M from './model.js';
import { nodeThumbnail, rarityBadge } from './visuals.js';
import { colorPicker } from './colors.js';
import { EQUIPMENT_FIELDS } from './equipment.js';
import { collectionPicker } from './category-wizard.js';
import { RARITIES, hasRarity, itemRarity } from './rarity.js';

const DRAFT_PREFIX = 'my-home-inventory:form-draft:v1:';
const RECENT_KEY = 'my-home-inventory:recent-places:v1';
const CONSUMABLES = new Set(['food', 'medicine', 'cleaning', 'cosmetics']);
const EXPIRING = new Set(['food', 'medicine', 'cleaning', 'cosmetics']);
const PRIMARY_FIELDS = { clothes:['Размер','Бренд','Цвет'], electronics:['Бренд','Модель'], furniture:['Ширина, см','Высота, см','Глубина, см'], books:['Автор'], sport:['Размер'], default:['Бренд','Модель','Цвет'] };
const button = (text, action, cls = '') => h(`button.iv-btn${cls ? '.' + cls : ''}`, { type: 'button', onclick: action }, text);
const input = (value = '', props = {}) => h('input', { value: value ?? '', ...props });
const field = (label, control, extra = '') => h(`div.iv-field${extra ? '.' + extra : ''}`, h('label', { for: control.id || (control.id = `if-${M.id()}`) }, label), control);
function select(options, value, props = {}) {
  const el = h('select', props, ...options.map(([key, text]) => h('option', { value: key }, text)));
  el.value = value ?? '';
  return el;
}
function stored(key, fallback = null) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function rememberPlace(id) {
  try { const old = stored(RECENT_KEY, []); localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...(Array.isArray(old) ? old : []).filter(x => x !== id)].slice(0, 5))); } catch { /* choosing a place remains possible without local storage */ }
}

/** A searchable location tree. The returned element has value, disabled, refresh and focus methods. */
export function createLocationPicker({ getDoc, value = '', excludeIds = [], movingId = null, onChange, required = false, label = 'Место хранения' }) {
  const excluded = new Set(excludeIds);
  let current = value || '', disabled = false;
  const details = h('details.if-location');
  const caption = h('span.if-location-caption');
  const summary = h('summary', { 'aria-label': label, 'aria-required': required ? 'true' : null }, icon('folder', 15), caption, h('span.if-location-chevron', '⌄'));
  const search = input('', { type: 'search', placeholder: 'Найти комнату, шкаф или коробку', 'aria-label': `${label}: поиск` });
  const recentList = h('div.if-location-recent');
  const tree = h('div.if-location-tree', { role: 'tree', 'aria-label': `${label}: места` });
  const panel = h('div.if-location-panel', search, recentList, tree);
  const collapsed = new Set();
  details.append(summary, panel);
  const root = h('div.if-location-root', details);
  // The label helper can focus the summary through this wrapper as well.
  root.tabIndex = -1;
  function available() {
    return M.destinations(getDoc(), movingId).filter(n => !excluded.has(n.id));
  }
  function selectedCaption() {
    const doc = getDoc(), selected = available().find(n => n.id === current);
    caption.textContent = selected ? M.address(doc, selected) : 'Выберите место хранения';
    caption.classList.toggle('if-location-placeholder', !selected);
    summary.setAttribute('title', caption.textContent);
  }
  function choose(n) {
    if (disabled) return;
    current = n.id; rememberPlace(n.id); selectedCaption(); details.open = false; summary.focus();
    root.dispatchEvent(new Event('change', { bubbles: true }));
    onChange?.(current, n);
  }
  function option(n, level, full = false) {
    const doc = getDoc();
    const el = h('button.if-location-option', { type: 'button', role: 'treeitem', 'aria-level': level + 1, 'aria-selected': String(n.id === current), onclick: () => choose(n) },
      nodeThumbnail(doc,n,15),
      h('span', h('strong', n.kind==='room'&&!n.virtual?M.address(doc,n):n.name), full ? h('small', M.address(doc, n)) : null), n.id === current ? icon('check', 14) : null);
    el.style.setProperty('--depth', String(level));
    el.addEventListener('keydown', e => {
      const rows = Array.from(tree.querySelectorAll('.if-location-option')).filter(x => x.getClientRects().length);
      const index = rows.indexOf(el);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); rows[Math.max(0, Math.min(rows.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus(); }
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); rows[e.key === 'Home' ? 0 : rows.length - 1]?.focus(); }
    });
    return el;
  }
  function render() {
    const doc = getDoc(), list = available(), ids = new Set(list.map(n => n.id));
    const q = search.value.toLocaleLowerCase('ru').trim();
    recentList.replaceChildren(); tree.replaceChildren();
    if (q) {
      const words = q.split(/\s+/);
      const matches = list.filter(n => { const address = M.address(doc, n).toLocaleLowerCase('ru'); return words.every(w => address.includes(w)); });
      tree.append(...matches.map(n => option(n, 0, true)));
      if (!matches.length) tree.append(h('p.if-location-empty', 'Такого места нет. Попробуйте другое название.'));
      return;
    }
    const recentIds = stored(RECENT_KEY, []);
    const recent = (Array.isArray(recentIds) ? recentIds : []).map(id => list.find(n => n.id === id)).filter(Boolean);
    if (recent.length) {
      recentList.append(h('p.if-location-label', 'Недавние места'), ...recent.map(n => button(M.address(doc, n), () => choose(n), 'if-recent-place')));
    }
    const byParent = new Map();
    for (const n of list) { const p = ids.has(n.parentId) ? n.parentId : null; if (!byParent.has(p)) byParent.set(p, []); byParent.get(p).push(n); }
    // Match the user's saved order within each storage unit, then sort equal positions by name.
    for (const children of byParent.values()) children.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'ru'));
    function branch(parentId, level, host) {
      for (const n of byParent.get(parentId) || []) {
        const children = byParent.get(n.id) || [], expanded = !collapsed.has(n.id);
        const item = option(n, level);
        const row = h('div.if-location-row');
        if (children.length) {
          item.setAttribute('aria-expanded', String(expanded));
          const toggle = button(expanded ? '⌄' : '›', () => { if (expanded) collapsed.add(n.id); else collapsed.delete(n.id); render(); Array.from(tree.querySelectorAll('[data-place-id]')).find(x => x.dataset.placeId === n.id)?.focus(); }, 'if-tree-toggle');
          toggle.setAttribute('aria-label', `${expanded ? 'Свернуть' : 'Развернуть'} ${n.name}`);
          row.append(toggle);
          item.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); if (e.key === 'ArrowLeft') collapsed.add(n.id); else collapsed.delete(n.id); render(); Array.from(tree.querySelectorAll('[data-place-id]')).find(x => x.dataset.placeId === n.id)?.focus(); }
          });
        } else row.append(h('span.if-tree-spacer'));
        item.dataset.placeId = n.id; row.style.setProperty('--depth', String(level)); row.append(item); host.append(row);
        if (children.length && expanded) branch(n.id, level + 1, host);
      }
    }
    branch(null, 0, tree);
    if (!list.length) tree.append(h('p.if-location-empty', 'Нет доступных мест хранения.'));
  }
  search.addEventListener('input', render);
  search.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); tree.querySelector('.if-location-option')?.focus(); } });
  details.addEventListener('toggle', () => { if (details.open && !disabled) { render(); search.focus(); } });
  details.addEventListener('keydown', e => { if (e.key === 'Escape' && details.open) { e.preventDefault(); e.stopPropagation(); details.open = false; summary.focus(); } });
  summary.addEventListener('click', e => { if (disabled) e.preventDefault(); });
  Object.defineProperties(root, {
    value: { get: () => current, set: next => { current = next || ''; selectedCaption(); } },
    disabled: { get: () => disabled, set: next => { disabled = Boolean(next); root.classList.toggle('disabled', disabled); summary.setAttribute('aria-disabled', String(disabled)); summary.tabIndex = disabled ? -1 : 0; search.disabled = disabled; if (disabled) details.open = false; } },
  });
  root.refresh = () => { selectedCaption(); if (details.open) render(); };
  root.focus = () => { if (!disabled) summary.focus(); };
  root.checkValidity = () => !required || available().some(n => n.id === current);
  selectedCaption();
  return root;
}

/** Self-contained add/edit dialog; no app state is mutated before an explicit save. */
export function openItemForm({ getDoc, existing = null, defaults = {}, currentPlaceId = null, lastCategory = '', change, onSaved, onClose }) {
  const doc = getDoc();
  const family=(existing?.kind||defaults.kind||'item')==='item'?'item':'storage';
  const base = structuredClone(existing || { kind: 'item', name: '', parentId: currentPlaceId || doc.nodes.find(n => n.kind === 'room')?.id || '', categoryId: family==='item'?lastCategory || '':defaults.kind==='furniture'?'furniture':'', condition: 'Хорошее', fields: {}, acquisition: 'existing', ...defaults });
  const draftKey = DRAFT_PREFIX + (existing?.id || 'new:'+family);
  const legacy=stored(DRAFT_PREFIX+'new');
  const prior = stored(draftKey) || (!existing&&legacy&&((legacy.state?.kind||'item')==='item'?'item':'storage')===family?legacy:null);
  const savedDraft = prior?.version === 1 && prior.state && typeof prior.state.name === 'string' ? prior.state : null;
  let starting = { ...base, ...savedDraft, fields: { ...(base.fields || {}), ...(savedDraft?.fields || {}) } };
  let allFields = { ...(starting.fields || {}) }, photoValue = starting.photo || null, photoLoading = false, saving = false, closed = false;
  const title = family==='item'?(existing?'Редактировать вещь':'Добавить вещь'):(existing?'Редактировать место хранения':'Добавить место хранения');
  const dialog = h('dialog.iv-dialog.if-dialog', { 'aria-label': title });
  const heading = h('h2', title);
  const closeButton = button('Закрыть', () => requestClose());
  const form = h('form.if-form', { noValidate: true });
  const scroll = h('div.if-form-scroll');
  const error = h('p.iv-form-error.if-form-error', { role: 'alert', 'aria-live': 'assertive', tabindex: -1 });
  const draftNote = h('p.if-draft-note', { role: 'status' });
  const restoreNote = h('div.if-draft-restore', { hidden: !savedDraft }, h('span', 'Восстановлен несохранённый черновик.'), button('Начать заново', () => {
    if (!confirm('Удалить этот черновик и вернуться к сохранённым данным?')) return;
    resetToBase();
  }));
  const closePrompt = h('div.if-close-prompt', { hidden: true, role: 'alert' });
  const continueButton = button('Продолжить редактировать', () => { closePrompt.hidden = true; name.focus(); });
  closePrompt.append(h('p', 'Изменения ещё не сохранены в каталоге. Можно продолжить или оставить черновик на потом.'),
    h('div.if-inline-actions', continueButton, button('Закрыть с черновиком', () => { if (persistDraft()) finishClose(); }), button('Удалить черновик и закрыть', () => { removeDraft(); finishClose(); }, 'danger')));
  const name = input(starting.name, { required: true, maxlength: 200, placeholder: family==='item'?'Например, футболка Nike':'Например, полка для одежды', 'aria-label': 'Название' });
  const kind = select(Object.entries(M.KINDS).filter(([key]) => family==='item'?key==='item':!['room','item'].includes(key)), starting.kind || 'item', { 'aria-label': 'Тип объекта' });
  kind.disabled = Boolean(existing?.furnitureId || existing && M.descendants(doc, existing.id).length);
  const location = createLocationPicker({ getDoc, value: starting.parentId, movingId: existing?.id, required: true, label: 'Место хранения' });
  const categoryOptions = [['', 'Без категории'], ...doc.categories.slice().sort((a, b) => M.categoryName(doc, a.id).localeCompare(M.categoryName(doc, b.id), 'ru')).map(c => [c.id, M.categoryName(doc, c.id)])];
  const category = select(categoryOptions, starting.categoryId, { 'aria-label': 'Категория' });
  const rarity = select([['','Автоматически'],...RARITIES.map(r=>[r.id,r.name])],starting.rarity||'',{'aria-label':'Редкость'});
  const rarityHelp=h('p.if-rarity-help'),rarityPreview=h('div.if-rarity-preview',{'aria-live':'polite'}),rarityField=field('Редкость',rarity,'if-rarity-field');
  rarityField.append(rarityPreview,rarityHelp);
  function refreshRarity() {
    captureAttributes();
    const candidate={...starting,name:name.value,kind:kind.value,categoryId:category.value,fields:allFields,rarity:rarity.value||null};
    rarityPreview.replaceChildren(...[rarityBadge(getDoc(),candidate)].filter(Boolean));
    rarityHelp.textContent='Автоматически — по словам в названии предмета. Ручной выбор имеет приоритет.';
    const effective=itemRarity(getDoc(),candidate);
    if(effective)rarityField.dataset.rarity=effective.id;else delete rarityField.dataset.rarity;
  }
  const collections = collectionPicker(doc,starting.collectionIds||[]);
  const acquisition = select([['existing', 'Уже было дома'], ['purchase', 'Новая покупка']], starting.acquisition || 'existing', { 'aria-label': 'Как вещь появилась дома' });
  const purchased = input(starting.purchasedAt, { type: 'date', 'aria-label': 'Дата покупки' });
  const purchasedField = field('Дата покупки', purchased);
  const acquisitionGrid = h('div.iv-form-grid.if-acquisition-grid', field('Как вещь появилась дома', acquisition));
  const purchase = input(starting.purchaseCents == null ? '' : (starting.purchaseCents / 100).toFixed(2), { inputmode: 'decimal', placeholder: 'Не указана', 'aria-label': 'Цена покупки, ₽' });
  const current = input(starting.currentCents == null ? '' : (starting.currentCents / 100).toFixed(2), { inputmode: 'decimal', placeholder: 'Не указана', 'aria-label': 'Текущая оценка, ₽' });
  const purchaseField = field('Цена покупки, ₽', purchase), currentField = field('Текущая оценка, ₽', current);
  const wear = input(starting.wear, { type: 'number', min: 0, max: 100, 'aria-label': 'Износ, %' });
  const wearMode=select([['standard','Стандартно: от добавления, 36 месяцев'],['automatic','Своя дата покупки и срок'],['manual','Вручную']],resolvedWearMode(starting),{'aria-label':'Режим износа'});
  const usefulLife=input(starting.usefulLifeMonths??'',{type:'number',min:1,max:1200,step:1,'aria-label':'Срок полезного использования, месяцев'});
  const wearPreview=h('p.iv-muted');
  function refreshWear(){wear.disabled=wearMode.value!=='manual';usefulLife.disabled=wearMode.value!=='automatic';const value=itemWear({...starting,createdAt:starting.createdAt||new Date().toISOString(),wearMode:wearMode.value,wear:wear.value===''?null:Number(wear.value),purchasedAt:purchased.value,usefulLifeMonths:Number(usefulLife.value)});wearPreview.textContent=value==null?'Укажите дату покупки и срок службы.':'Износ: '+value+'%'+(wearMode.value==='standard'?' · от даты добавления за 36 месяцев':'');}
  for(const control of [wearMode,usefulLife,purchased,wear])control.addEventListener('input',refreshWear);
  refreshWear();
  const fill = input(starting.fill, { type: 'number', min: 0, max: 100, 'aria-label': 'Заполненность места, %' });
  const condition = select(M.CONDITIONS.map(v => [v, v]), starting.condition || 'Хорошее', { 'aria-label': 'Состояние' });
  const expiry = input(starting.expiry, { type: 'date', 'aria-label': 'Срок годности' });
  const warranty = input(starting.warranty, { type: 'date', 'aria-label': 'Гарантия до' });
  const quantity = input(starting.quantity || 1, { type: 'number', min: 0.001, step: 'any', 'aria-label': 'Количество' });
  const unit = select(['шт.', 'кг', 'г', 'л', 'мл', 'уп.'].map(v => [v, v]), starting.unit || 'шт.', { 'aria-label': 'Единица количества' });
  const notes = h('textarea', { rows: 3, maxlength: 10000, 'aria-label': 'Заметки', placeholder: 'Что стоит помнить об этой вещи' }); notes.value = starting.notes || '';
  const attrs = h('div.iv-form-grid.if-attributes');
  const secondaryAttrs=h('div.iv-form-grid.if-attributes');
  const primaryGrid=h('div.iv-form-grid.if-primary-fields');
  const storageBasics=h('div.iv-form-grid.if-storage-basics');
  let attrInputs = {};
  const extraGrid = h('div.iv-form-grid.if-extra-fields');
  const extra = h('details.if-extra', h('summary', 'Дополнительно: стоимость, даты и заметки'), extraGrid, secondaryAttrs, field('Заметки', notes));
  const photo = h('div.if-photo');
  const photoFile = input('', { type: 'file', accept: 'image/png,image/jpeg,image/webp', 'aria-label': 'Фотография вещи (необязательно)', class: 'if-photo-file' });
  const photoPreview = h('div.if-photo-preview');
  const photoLabel = h('label.iv-btn.if-photo-select', { for: photoFile.id = `if-photo-${M.id()}` }, 'Добавить фото');
  const removePhoto = button('Убрать', () => { photoValue = null; renderPhoto(); track(); });
  function renderPhoto() {
    photoPreview.replaceChildren(photoValue ? h('img', { src: photoValue, alt: 'Фотография вещи' }) : icon('camera', 26));
    photoLabel.textContent = photoValue ? 'Заменить фото' : 'Добавить фото'; removePhoto.hidden = !photoValue;
  }
  photo.append(photoPreview, h('div.if-photo-actions', h('small', 'Фото · необязательно'), photoLabel, removePhoto), photoFile);
  async function loadPhoto(file) {
    if (!file) return;
    error.textContent = ''; photoLoading = true; setSavingState();
    let bitmap;
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw Error('Выберите фотографию в формате JPG, PNG или WebP.');
      if (file.size > 20 * 1024 * 1024) throw Error('Фотография должна быть меньше 20 МБ.');
      if (typeof createImageBitmap === 'function') bitmap = await createImageBitmap(file);
      else bitmap = await new Promise((resolve, reject) => { const img = new Image(), url = URL.createObjectURL(file); img.onload = () => { URL.revokeObjectURL(url); resolve(img); }; img.onerror = () => { URL.revokeObjectURL(url); reject(Error('Не удалось прочитать фотографию.')); }; img.src = url; });
      const canvas = document.createElement('canvas'), ratio = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const ctx = canvas.getContext('2d'); if (!ctx) throw Error('Не удалось обработать фотографию.');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      if (closed) return;
      photoValue = canvas.toDataURL('image/jpeg', 0.82); renderPhoto(); track();
    } catch (err) { error.textContent = err.message; }
    finally { bitmap?.close?.(); photoLoading = false; photoFile.value = ''; setSavingState(); }
  }
  photoFile.addEventListener('change', () => loadPhoto(photoFile.files[0]));
  photo.addEventListener('dragover', e => e.preventDefault());
  photo.addEventListener('drop', e => { e.preventDefault(); loadPhoto(e.dataTransfer.files[0]); });
  renderPhoto();
  const submit = h('button.iv-btn.primary', { type: 'submit' }, existing ? 'Сохранить' : 'Создать');
  const more = h('button.iv-btn', { type: 'submit', 'data-more': '1' }, 'Создать ещё');
  const footer = h('div.if-form-footer', h('div.if-form-save-state', draftNote), h('div.if-inline-actions', button('Отмена', () => requestClose()), existing ? null : more, submit));
  const categoryField=field('Категория',category),kindField=field('Тип места',kind),fillField=field('Заполненность, %',fill);
  const basic = h('div.if-form-basic', family==='storage'?h('p.if-storage-hint','Полка, ящик, коробка или мебель, внутри которых хранятся вещи'):null,
    h('div.if-name-photo',field('Название *',name),photo),storageBasics,
    h('div.iv-field',h('span',family==='item'?'Место хранения *':'Где находится *'),location),primaryGrid,attrs,collections);
  scroll.append(restoreNote,basic,extra,error);
  form.append(closePrompt, scroll, footer);
  dialog.append(h('div.iv-dialog-title', heading, closeButton), form);

  function categoryKind() { return M.categoryKind(getDoc(), category.value); }
  function captureAttributes() { for (const [key, el] of Object.entries(attrInputs)) allFields[key] = el.value; }
  function renderFields() {
    captureAttributes(); attrInputs = {};
    const categoryType = categoryKind(), structural = ['shelf', 'drawer'].includes(kind.value), isStorage = family==='storage';
    const batch = CONSUMABLES.has(categoryType) && kind.value === 'item';
    const equipment=EQUIPMENT_FIELDS[starting.modelType]||{};
    const baseKeys = structural && !category.value ? [] : M.CATEGORY_FIELDS[categoryType] || (kind.value === 'furniture' && !category.value ? M.CATEGORY_FIELDS.furniture : M.CATEGORY_FIELDS.default);
    const keys=[...new Set([...baseKeys,...Object.keys(equipment),...Object.keys(allFields)])];
    const priority=PRIMARY_FIELDS[categoryType]||keys,main=[],secondary=[];
    for(const key of keys.filter(key=>key!=='Цвет').concat(keys.includes('Цвет')?['Цвет']:[])){
      const el=key==='Цвет'?colorPicker(allFields[key]||''):input(allFields[key]||'',{'aria-label':key});attrInputs[key]=el;
      if(equipment[key]){const listId='spec-'+key.replace(/[^a-zа-я0-9]/gi,'')+'-'+dialog.id;el.setAttribute('list',listId);el.placeholder='Выберите или введите своё';main.push(h('datalist',{id:listId},equipment[key].map(value=>h('option',{value}))));}
      (priority.includes(key)||equipment[key]?main:secondary).push(field(key,el,key==='Цвет'?'if-color-field':''));
    }
    attrs.replaceChildren(...main);secondaryAttrs.replaceChildren(...secondary);
    purchaseField.querySelector('label').textContent = batch ? 'Цена покупки партии, ₽' : 'Цена покупки, ₽';
    currentField.querySelector('label').textContent = batch ? 'Текущая оценка партии, ₽' : 'Текущая оценка, ₽';
    const primary=[], extras=[purchaseField,currentField];
    if(isStorage){storageBasics.replaceChildren(kindField,fillField);extras.push(categoryField,field('Состояние',condition));}
    else{storageBasics.replaceChildren(categoryField,field('Состояние',condition));}
    if(hasRarity({...starting,kind:kind.value}))storageBasics.append(rarityField);
    if(batch||Number(starting.quantity)>1)primary.push(field('Количество',quantity),field('Единица',unit));
    if(EXPIRING.has(categoryType)||starting.expiry)primary.push(field('Срок годности',expiry));
    if(['electronics','furniture','tools','sport'].includes(categoryType)||starting.warranty)primary.push(field('Гарантия до',warranty));
    // Category attributes are immediately available; occasional accounting fields stay folded.
    if(!structural)extras.push(field('Режим износа',wearMode),field('Ручной износ, %',wear),field('Срок полезного использования, месяцев',usefulLife),wearPreview);
    if(isStorage){extras.push(field('Как появилось дома',acquisition));}
    else extras.push(field('Как вещь появилась дома',acquisition));
    if(acquisition.value==='purchase'){
      purchased.required=true;purchasedField.querySelector('label').textContent='Дата покупки *';primary.push(purchasedField);
      extra.open=true;
    }else{purchased.required=false;purchasedField.querySelector('label').textContent='Дата покупки (если известна)';extras.push(purchasedField);}
    primaryGrid.replaceChildren(...primary);extraGrid.replaceChildren(...extras);
    heading.textContent=family==='item'?title:kind.value==='furniture'?(existing?'Редактировать мебель или технику':'Добавить мебель или технику'):title;
    dialog.setAttribute('aria-label',heading.textContent);
    submit.textContent=existing?'Сохранить':family==='item'?'Создать вещь':'Создать место';
    refreshRarity();
  }
  renderFields();
  function state() {
    captureAttributes();
    return { name: name.value, kind: kind.value, parentId: location.value, categoryId: category.value, rarity:rarity.value||null, collectionIds:collections.value, acquisition: acquisition.value,
      fields: { ...allFields }, photo: photoValue, purchaseText: purchase.value, currentText: current.value,
      wearMode:wearMode.value,usefulLifeMonths:usefulLife.value,wear: wear.value, fill: fill.value, condition: condition.value, purchasedAt: purchased.value, expiry: expiry.value, warranty: warranty.value, quantity: quantity.value, unit: unit.value, notes: notes.value };
  }
  // Drafts keep raw money input so even incomplete typing such as "120," survives a restart.
  if (savedDraft) { if (savedDraft.purchaseText != null) purchase.value = savedDraft.purchaseText; if (savedDraft.currentText != null) current.value = savedDraft.currentText; }
  let cleanState = JSON.stringify(state()), restoredDirty = Boolean(savedDraft);
  let dirty = restoredDirty;
  function resetToBase() {
    if (saving || photoLoading) return;
    starting = structuredClone(base); allFields = { ...(base.fields || {}) }; attrInputs = {}; photoValue = base.photo || null;
    collections.value=base.collectionIds||[];
    name.value = base.name || ''; kind.value = base.kind || 'item'; location.value = base.parentId || ''; category.value = base.categoryId || '';
    rarity.value=base.rarity||'';
    acquisition.value = base.acquisition || 'existing'; purchased.value = base.purchasedAt || ''; condition.value = base.condition || 'Хорошее';
    purchase.value = base.purchaseCents == null ? '' : (base.purchaseCents / 100).toFixed(2); current.value = base.currentCents == null ? '' : (base.currentCents / 100).toFixed(2);
    wearMode.value=resolvedWearMode(base);usefulLife.value=base.usefulLifeMonths??'';
    wear.value = base.wear ?? ''; fill.value = base.fill ?? ''; expiry.value = base.expiry || ''; warranty.value = base.warranty || '';
    quantity.value = base.quantity || 1; unit.value = base.unit || 'шт.'; notes.value = base.notes || '';
    refreshWear();renderFields(); renderPhoto(); restoreNote.hidden = true; closePrompt.hidden = true; error.textContent = ''; draftNote.textContent = '';
    restoredDirty = false; dirty = false; cleanState = JSON.stringify(state()); removeDraft(); name.focus();
  }
  function removeDraft() { try { localStorage.removeItem(draftKey); if(legacy===prior)localStorage.removeItem(DRAFT_PREFIX+'new'); } catch { /* nothing to discard */ } }
  function persistDraft() {
    try { localStorage.setItem(draftKey, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), state: state() })); draftNote.textContent = 'Черновик сохранён'; draftNote.classList.remove('error'); return true; }
    catch { draftNote.textContent = 'Черновик не удалось сохранить. Не закрывайте форму до сохранения вещи.'; draftNote.classList.add('error'); return false; }
  }
  function track() {
    if (closed || saving) return;
    dirty = restoredDirty || JSON.stringify(state()) !== cleanState;
    if (dirty) persistDraft(); else { removeDraft(); draftNote.textContent = ''; }
  }
  function setSavingState() { if (!submit) return; submit.disabled = saving || photoLoading; more.disabled = saving || photoLoading; closeButton.disabled = saving; submit.textContent = photoLoading ? 'Обработка фото…' : saving ? 'Сохранение…' : existing ? 'Сохранить' : family==='item'?'Создать вещь':'Создать место'; }
  function finishClose() { if (closed) return; closed = true; dialog.close(); dialog.remove(); onClose?.(); }
  function requestClose() {
    if (saving) return;
    if (photoLoading) { error.textContent = 'Подождите, фотография ещё обрабатывается.'; return; }
    track();
    if (!dirty) { finishClose(); return; }
    closePrompt.hidden = false; continueButton.focus();
  }
  form.addEventListener('input', () => {refreshRarity();track();});
  form.addEventListener('change', () => {refreshRarity();track();});
  category.addEventListener('change', () => { renderFields(); track(); });
  kind.addEventListener('change', () => { renderFields(); track(); });
  acquisition.addEventListener('change', () => { renderFields(); track(); });
  dialog.addEventListener('cancel', e => { e.preventDefault(); requestClose(); });
  dialog.addEventListener('click', e => { if (e.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) requestClose(); });
  dialog.addEventListener('close', () => { if (!closed) { if (dirty) persistDraft(); closed = true; dialog.remove(); onClose?.(); } });
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (saving || photoLoading) return;
    error.textContent = '';
    try {
      if (!name.value.trim()) { name.focus(); throw Error('Введите название вещи.'); }
      if (!location.checkValidity()) { location.focus(); throw Error('Выберите место хранения.'); }
      if (acquisition.value === 'purchase' && !purchased.value) { purchased.focus(); throw Error('Для новой покупки укажите дату покупки.'); }
      if (!form.reportValidity()) return;
      captureAttributes();
      const props = { name: name.value.trim(), kind: kind.value, parentId: location.value, categoryId: category.value, rarity:hasRarity({...starting,kind:kind.value})?rarity.value||null:null, collectionIds:collections.value, acquisition: acquisition.value,
        fields: Object.fromEntries(Object.entries(allFields).map(([key, value]) => [key, String(value).trim()]).filter(([, value]) => value)), photo: photoValue,
        purchaseCents: M.parseMoney(purchase.value), currentCents: M.parseMoney(current.value), wearMode:wearMode.value,usefulLifeMonths:usefulLife.value===''?null:Number(usefulLife.value), wear: wear.value === '' ? null : Number(wear.value), fill: fill.value === '' ? null : Number(fill.value),
        condition: condition.value, purchasedAt: purchased.value, expiry: expiry.value, warranty: warranty.value, quantity: Number(quantity.value), unit: unit.value, notes: notes.value.trim() };
      let nodeId = existing?.id;
      saving = true; setSavingState();
      await change(d => { if (existing) M.updateNode(d, existing.id, props); else nodeId = M.newNode(d, props).id; });
      rememberPlace(props.parentId); removeDraft(); dirty = false;
      const result = { categoryId: props.categoryId, parentId: props.parentId, kind: props.kind, again: Boolean(e.submitter?.dataset.more), nodeId };
      finishClose(); onSaved?.(result);
    } catch (err) { error.textContent = err.message || 'Не удалось сохранить вещь. Проверьте поля и повторите.'; error.scrollIntoView({ block: 'nearest' }); }
    finally { saving = false; setSavingState(); }
  });
  dialog.requestClose = requestClose;
  document.body.append(dialog); dialog.showModal(); name.focus();
  return dialog;
}
