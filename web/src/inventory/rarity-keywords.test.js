import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { titleRarity } from './rarity-keywords.js';
import { defaultRarity, itemRarity } from './rarity.js';
import { EXTRA_MODEL_INFO } from '../three/furniture-info.js';
import { FURNITURE_NAMES } from './model.js';

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
  for(const name of ['MOZART','MOZA123','LeicaTest','Audezex','Appleton','DJImini','Canonization','Sonya','MyLEGO'])assert.equal(titleRarity(name),null,name);
  assert.equal(titleRarity('STAX SR-X90000'),'epic'); // Brand approved; exact legendary model does not match.
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

test('all ordinary furniture editor models are audited, including the printer cabinet',()=>{
  let checked=0;
  for(const [type,info]of Object.entries(EXTRA_MODEL_INFO))if(info.category==='furniture') {
    const expected=['kallaxShelf','ivarRack'].includes(type)?'rare':'common';
    assert.equal(defaultRarity({}, {kind:'furniture',name:info.name,modelType:type}),expected,type);checked++;
  }
  assert.ok(checked>=15);
  for(const type of ['sofa','armchair','coffeeTable','sideboard','diningSet','island','kitchen','bed','nightstand','dresser','vanity','desk','wardrobe','bookshelf'])assert.equal(defaultRarity({}, {kind:'furniture',name:FURNITURE_NAMES[type],modelType:type}),'common',type);
  for(const name of ['Тумба','Прикроватная тумба','Комод','Шкаф','Диван','Кровать','Обеденный стол'])assert.equal(titleRarity(name),null,name);
});

test('furniture does not inherit equipment words, even without a preposition',()=>{
  for(const name of ['Тумбочка под 3D-принтер','Тумба для DJI','Тумба 3D-принтер','Тумбочка Bambu Lab','Стол Apple','Полка для Leica','Шкаф с телевизором Sony','Стеллаж для наушников Audeze LCD-5','Стенка для Sony','Подставка для MOZA','Cabinet for DJI','Стол для Herman Miller'])assert.equal(titleRarity(name),null,name);
  for(const [name,expected]of [['Тумба IKEA под 3D-принтер','rare'],['Кресло Herman Miller Aeron','epic'],['Стол Steelcase','epic'],['Кресло Secretlab','epic'],['Стол с электроподъёмом','rare'],['Камера DJI на столе','epic'],['3D-принтер на тумбе','epic'],['Наушники Audeze LCD-5 на стойке','legendary']])assert.equal(titleRarity(name),expected,name);
  assert.equal(itemRarity({}, {kind:'furniture',name:'Тумба',rarity:'epic'}).id,'epic');
});

test('DJI equipment is purple in Latin and explicitly supported Russian spellings',()=>{
  for(const name of ['DJI','dji Mini 4 Pro','DJI Osmo Pocket 3','DJI Mic Mini','DJI Ronin','Дрон DJI','ДиДжиАй Mini','Ди Джи Ай Osmo','Ди-Джи-Ай Ronin','Диджай Mini'])assert.equal(titleRarity(name),'epic',name);
  assert.equal(titleRarity('Чехол для ДиДжиАй Mini'),'uncommon');
  assert.equal(titleRarity('DJImini'),null);
  assert.equal(titleRarity('Гарнитура Audeze Maxwell'),'epic');
});

test('all 121 epic and 37 legendary entries match the separately approved expansion',()=>{
  const proposal=readFileSync(new URL('../../../docs/rarity-expansion-approval-2026-10-25.ru.md',import.meta.url),'utf8');
  const sections=proposal.split('## Новые легендарные кандидаты'),counts=[];
  for(const [i,section]of sections.entries()) {
    let count=0;
    for(const line of section.split('\n')) {
      const cells=line.split('|').map(s=>s.trim());
      if(cells.length!==4||cells[1]==='Направление'||cells[1].startsWith('-'))continue;
      for(const name of cells[2].split('; ')) {
        const expected=i?'legendary':'epic';
        assert.equal(titleRarity(name),expected,name);
        for(const categoryId of ['books','furniture','missing'])assert.equal(defaultRarity({}, {name,categoryId,fields:{Бренд:'не участвует'}}),expected,name);
        count++;
      }
    }
    counts.push(count);
  }
  assert.deepEqual(counts,[121,37]);
});

test('new exact models override general brands without upgrading unrelated product lines',()=>{
  for(const [name,expected]of [
    ['Sony A7 IV','epic'],['Sony Alpha 1 II','legendary'],['Sony Alpha 1 III','epic'],
    ['Canon EOS R6','epic'],['Canon EOS R1','legendary'],['Canon EOS R10','epic'],
    ['Nikon Z9','legendary'],['Nikon Z90','epic'],['Fujifilm GFX100 II','legendary'],['Fujifilm GFX100 I','epic'],
    ['Audeze Maxwell','epic'],['Audeze CRBN2','legendary'],['Audeze CRBN20','epic'],
    ['Focal Clear','epic'],['Focal Utopia','legendary'],['Meze Audio','epic'],['Meze Elite','legendary'],
    ['STAX SR-X9000','legendary'],['STAX SR-X90000','epic'],['Simucube 2 Pro','epic'],['Simucube 2 Ultimate','legendary'],
    ['Lenovo ThinkPad','rare'],['Lenovo Legion','epic'],['Casio','rare'],['Casio MR-G','epic'],
  ])assert.equal(titleRarity(name),expected,name);
  assert.equal(titleRarity('Heusinkveld Ultimate'),null);
  assert.equal(titleRarity('Heusinkveld Ultimate+'),'legendary');
  assert.equal(titleRarity('Simucube 2 UltimateXS'),null);
});

test('new furniture and tripod models apply to the actual item, not its cover or intended equipment',()=>{
  for(const name of ['Тумбочка под 3D-принтер','Тумба для Anycubic','Стол для Neumann','Стол для Vitra Eames Lounge Chair','Кресло Vitra','Cassina','Кресло Haworth','Дизайнерская тумба Premium'])assert.equal(titleRarity(name),null,name);
  for(const [name,expected]of [
    ['Кресло Haworth Fern','epic'],['HÅG Capisco','epic'],['Стол USM Haller','epic'],['Диван BoConcept','epic'],
    ['Vitra Eames Lounge Chair','legendary'],['Кресло Fritz Hansen Egg','legendary'],['Шезлонг Cassina LC4','legendary'],
    ['Тумба IKEA для STAX','rare'],['Чехол для Cassina LC4','uncommon'],['Кабель Audeze CRBN2',null],
    ['Штатив Gitzo','epic'],['Штатив Manfrotto','epic'],['Штатив для Sony','rare'],['Чехол штатив Gitzo','uncommon'],
    ['Чехол для штатива Manfrotto','uncommon'],['Рюкзак Tumi','epic'],['Чехол для рюкзака Tumi','uncommon'],
  ])assert.equal(titleRarity(name),expected,name);
});

test('new aliases, diacritics, plus signs and numeric series work without partial-word matches',()=>{
  for(const [name,expected]of [
    ['Audeze CRBN²','legendary'],['Sony α1 II','legendary'],['Sony A1 II','legendary'],['Fujifilm GFX100II','legendary'],
    ['Casio MRG-B5000','epic'],['BenQ SW271C','epic'],['BenQ SW272U','epic'],['Heusinkveld Ultimate Plus','legendary'],
    ["De’Longhi",'epic'],['Cervelo','epic'],['Norrona','epic'],['A. Lange & Sohne','legendary'],['Warhammer 40K','epic'],
  ])assert.equal(titleRarity(name),expected,name);
  for(const name of ['BenQ SWARM','McIntoshTest','Razer123','Simucube 2 UltimateXS'])assert.equal(titleRarity(name),null,name);
});
