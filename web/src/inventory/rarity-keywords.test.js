import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { titleRarity } from './rarity-keywords.js';
import { defaultRarity, itemRarity } from './rarity.js';

test('all 176 approved blue and purple entries match the user-reviewed proposal',()=>{
  const proposal=readFileSync(new URL('../../../docs/rarity-keywords-proposal.ru.md',import.meta.url),'utf8');
  let checked=0;
  for(const line of proposal.split('\n')) {
    const cells=line.split('|').map(s=>s.trim());
    if(cells.length!==5||!cells[2]||cells[1]==='Направление'||cells[1].startsWith('-'))continue;
    for(const [column,expected]of [[2,'rare'],[3,'epic']])for(const name of cells[column].split(', ')) {
      assert.equal(titleRarity(name),expected,name);checked++;
    }
  }
  assert.equal(checked,176);
  assert.equal(titleRarity('Nord'),'epic');
  assert.equal(titleRarity('MIDI-клавиатура'),'rare');
  assert.equal(titleRarity('Электрогитара'),'rare');
  assert.equal(titleRarity('MacBook'),'epic');
  assert.equal(titleRarity('3D-принтер Samsung'),'epic');
  assert.equal(titleRarity('VR-шлем Samsung'),'epic');
  assert.equal(titleRarity('Механическая клавиатура Apple'),'epic');
});

test('green base objects, inflections and phrases remain independent of category',()=>{
  const doc={categories:[{id:'books',kind:'books'},{id:'hobby',kind:'hobby'}]};
  for(const name of ['Книга','Блокноты','Ежедневник','Термосы','Рюкзак','Чехлы','Настольные лампы','Сковороды','Кастрюли','Полотенца','Пледы','Набор отверток','Коврик для йоги']) {
    for(const categoryId of ['books','hobby','missing',null])assert.equal(defaultRarity(doc,{name,categoryId}),'uncommon',name);
  }
  for(const name of ['Сломанная Leica M11','Потёртая Leica M11'])assert.equal(titleRarity(name),'legendary');
  for(const name of ['Pro','Ultra Premium','лимитированный','коллекционный','профессиональный','молоко','бытовая химия','лекарство','обычная вещь',''])assert.equal(titleRarity(name),null,name);
});

test('legendary brands, exact models and compound book rule are recognized',()=>{
  for(const name of ['Leica M11','MOZA R9','Hasselblad X2D','Phase One IQ4','ARRI ALEXA','STAX SR-X9000','Focal Utopia','Sennheiser HE 1','Часы Rolex','Часы Patek Philippe','Часы Audemars Piguet','Рояль Steinway','Первое издание с автографом','Первого издания с автографом']) {
    assert.equal(titleRarity(name),'legendary',name);
  }
  for(const model of ['LCD-4','lcd-5','LCD 4','LCD5','LCD‑5','ＬＣＤ－４']) {
    assert.equal(titleRarity(`Audeze ${model}`),'legendary',model);
    assert.equal(titleRarity(`${model} от Audeze`),'legendary',model);
  }
  for(const model of ['Maxwell','MM-100','LCD-2','LCD-X','LCD-4z','LCD-50','LCD-5s','XLCD-5'])assert.equal(titleRarity(`Audeze ${model}`),'epic',model);
  assert.equal(titleRarity('LCD-5'),null);
  assert.equal(titleRarity('Первое издание'),'epic');
  assert.equal(titleRarity('Книга с автографом'),'epic');
  assert.equal(titleRarity('Книга коллекционная'),'uncommon');
});

test('specific model and phrase take priority over the general brand or object name',()=>{
  for(const [name,expected]of [['Лампа Philips','rare'],['Лампа Philips Hue','epic'],['Ноутбук ASUS ROG','epic'],['Samsung Galaxy Z Fold','epic'],['LEGO','rare'],['LEGO Technic','epic'],['Карбоновый велосипед','epic'],['Книга с автографом','epic'],['Кокпит с трипл-скрином MOZA','legendary'],['Руль Thrustmaster MOZA','legendary']])assert.equal(titleRarity(name),expected,name);
});

test('accessories do not inherit the intended device brand or model, with or without for',()=>{
  for(const [name,expected]of [
    ['Чехол для Leica M11','uncommon'],['Чехол Leica M11','uncommon'],['Кожаный чехол MOZA','uncommon'],
    ['Чехлы для Audeze LCD-5','uncommon'],['Рюкзак Nikon','uncommon'],['Фоторюкзак для Canon','rare'],
    ['Рюкзак Osprey','rare'],['Фотосумка Samsonite','rare'],
    ['Кабель для Audeze LCD-5',null],['Амбушюры Sennheiser HE1',null],['Ремешок для часов Rolex',null],
    ['Адаптер Apple',null],['Зарядное устройство для DJI',null],['Чехол для книги с автографом','uncommon'],
    ['Наушники Audeze с кабелем','epic'],['Камера Leica с чехлом','legendary'],
    ['Микрофон Shure с чехлом','epic'],['Штатив для Canon','rare'],['Штатив Canon','rare'],
    ['Case for Leica M11',null],['Leica camera with case','legendary'],
  ])assert.equal(titleRarity(name),expected,name);
});

test('word boundaries, Unicode, punctuation, explicit aliases and accents are normalized safely',()=>{
  for(const [name,expected]of [['Ｓｏｎｙ','epic'],['ＭＯＺＡ','legendary'],['(Canon), EOS','epic'],['Наушники Аудезе LCD‑5','legendary'],['Лампа Филипс Хью','epic'],['Arc’teryx','epic'],['Arcteryx','epic'],['WUSTHOF','epic'],['TP‑LINK','rare'],['3д-принтер','epic'],['Лейка садовая',null]])assert.equal(titleRarity(name),expected,name);
  for(const name of ['MOZART','MOZA123','LeicaTest','Audezex','Appleton','DJImini','Canonization','Sonya','MyLEGO','STAX SR-X90000'])assert.equal(titleRarity(name),null,name);
  assert.equal(titleRarity('Sennheiser HE10'),'epic');
  assert.equal(titleRarity('Audeze LCD-5s'),'epic');
});

test('same cached title responds correctly to manual, model and category changes',()=>{
  const doc={categories:[]},n={kind:'item',name:'Книга'};
  assert.equal(itemRarity(doc,n).id,'uncommon');
  assert.equal(itemRarity(doc,{...n,rarity:'poor'}).id,'poor');
  assert.equal(itemRarity(doc,{...n,rarity:'legendary'}).id,'legendary');
  assert.equal(itemRarity(doc,{...n,modelType:'macBook'}).id,'epic');
  for(let i=0;i<4100;i++)assert.equal(titleRarity('Обычная вещь '+i),null);
  assert.equal(itemRarity(doc,n).id,'uncommon');
});
