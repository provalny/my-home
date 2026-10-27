import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as I from '../inventory/model.js';
import * as A from './model.js';
import { createActionHistory } from '../inventory/action-history.js';
import { vehicleModelType } from './vehicle-model.js';
import * as T from '../travel/model.js';
import {vehicleStatusCards} from './status-data.js';

test('V1 task estimates and system survive backup and undo without becoming actual expenses',()=>{
 const {d,c}=fixture(),before=structuredClone(d),history=createActionHistory(),total=A.metrics(c).total;
 const id=A.saveTask(c,{name:'Масло',system:'Двигатель',estimatedCents:450099,dueOdometer:12000});
 history.record(before,{label:'Планирование ТО',section:'automobile'},d);
 assert.equal(A.metrics(c).total,total);const copy=JSON.parse(JSON.stringify(d));I.validate(copy);
 assert.equal(A.car(copy,c.id).maintenance.find(t=>t.id===id).estimatedCents,450099);
 for(const patch of [{estimatedCents:-1},{estimatedCents:1.5},{system:'Несуществующий узел'}])assert.throws(()=>A.saveTask(c,{name:'Ошибка',dueDate:'2026-12-01',...patch}));
 history.applyTo(d);history.complete(false);assert.equal(A.car(d,c.id).maintenance.length,0);history.applyTo(d,true);history.complete(true);assert.equal(A.car(d,c.id).maintenance[0].system,'Двигатель');
});
test('V1 refuel price rounds only the unit price and normalizes previously used fuel spelling',()=>{
 assert.equal(A.refuelPrice(300000,40),7500);assert.equal(A.refuelPrice(359912,49.97),Math.round(359912/49.97));
 for(const args of [[null,20],[100,0],[100,NaN],[-1,4],[1.5,20]])assert.throws(()=>A.refuelPrice(...args));
 assert.equal(A.fuelType('АИ-95'),'АИ95');assert.equal(A.fuelType('аи 95+'),'АИ95+');assert.equal(A.fuelType('ДТ'),'ДТ');assert.equal(A.fuelType('Газ'),'');
});

test('vehicle plaques use recorded readings, the requested default 90%, and no invented tire percentage',()=>{
 const {d,c}=fixture();let cards=vehicleStatusCards(c);
 assert.equal(cards.find(x=>x.id==='condition').percent,90);assert.equal(cards.find(x=>x.id==='tires').percent,null);assert.equal(cards.find(x=>x.id==='tires').value,'Не указано');
 const before=structuredClone(d),history=createActionHistory();A.updateCar(d,c.id,{conditionPercent:86,tireConditionPercent:72});
 history.record(before,{label:'Состояние',section:'automobile'},d);
 cards=vehicleStatusCards(c);assert.equal(cards.find(x=>x.id==='condition').percent,86);assert.equal(cards.find(x=>x.id==='tires').percent,72);
 I.validate(JSON.parse(JSON.stringify(d)));history.applyTo(d);history.complete(false);assert.equal(A.car(d,c.id).conditionPercent,undefined);
 history.applyTo(d,true);history.complete(true);assert.equal(A.car(d,c.id).tireConditionPercent,72);
 for(const value of [-1,101,NaN,Infinity,'90'])assert.throws(()=>A.updateCar(d,c.id,{conditionPercent:value}),/процент/);
 A.updateCar(d,c.id,{tireConditionPercent:null});assert.equal(vehicleStatusCards(A.car(d,c.id)).find(x=>x.id==='tires').percent,null);
});
const seed=()=>I.demo(JSON.parse(readFileSync(new URL('../../public/plans/home.json',import.meta.url),'utf8')));
const fixture=()=>{const d=seed(),id=A.addCar(d,{name:'Проверка',initialOdometer:10000,initialDate:'2026-01-01'});return {d,c:A.car(d,id)};};
const trunk=(d,c)=>A.compartments(d,c).find(n=>n.carCompartment==='trunk');
const home=d=>d.nodes.find(n=>n.kind==='room'&&!n.virtual);
const record=(d,c,p)=>A.saveRecord(d,c,{date:'2026-02-01',name:'Запись',...p});

test('multiple cars preserve house geometry, identities, manual fill and old backup format',()=>{const d=seed(),before=structuredClone(d.plan),fill=I.apartmentFill(d);assert.equal(d.automobiles,undefined);I.validate(d);const one=A.addCar(d,{name:'Первая'}),two=A.addCar(d,{name:'Вторая'});assert.equal(A.cars(d).length,2);assert.equal(A.car(d,one).records.length,0);assert.equal(A.car(d,two).records.length,0);assert.deepEqual(d.plan,before);assert.deepEqual(I.apartmentFill(d),fill);const c=A.car(d,one),z=trunk(d,c);A.updateCompartment(d,c,z.id,{name:'Мой багажник',fill:63.5});A.addCompartment(d,c,{name:'Подполье'});assert.equal(z.fill,63.5);A.updateCar(d,one,{name:'Переименованная'});const copy=JSON.parse(JSON.stringify(d));I.migrate(copy);I.validate(copy);assert.equal(I.address(copy,I.getNode(copy,z.id)),'Переименованная → Мой багажник');assert.equal(A.compartments(copy,A.car(copy,one)).length,3);});
test('box transfers preserve identity, contents, counts and searchable car addresses',()=>{const {d,c}=fixture(),box=I.newNode(d,{kind:'box',name:'Набор инструментов',parentId:home(d).id}),item=I.newNode(d,{kind:'item',name:'Головка 13',parentId:box.id,purchaseCents:10000}),before=I.totals(d);A.moveMany(d,[box.id,item.id],trunk(d,c).id);assert.equal(item.parentId,box.id);assert.equal(A.carForNode(d,item).id,c.id);assert.deepEqual(I.totals(d),before);assert.ok(I.search(d,'Проверка Головка').some(n=>n.id===item.id));assert.throws(()=>I.move(d,trunk(d,c).id,home(d).id),/отсек/);I.validate(d);});
test('refuels store precise money, receipts and full-tank flag without estimating consumption',()=>{const {d,c}=fixture();record(d,c,{type:'refuel',odometer:10500,litres:42.5,amountCents:319175,priceCents:7510,categoryId:'fuel',fullTank:true,attachments:[]});let m=A.metrics(c,'2026-02');assert.equal(m.total,319175);assert.equal(m.litres,42.5);assert.equal(m.consumption,null);record(d,c,{type:'fuel',consumption:7.8});m=A.metrics(c,'2026-02');assert.equal(m.consumption,7.8);assert.equal(m.distance,500);assert.equal(m.costPerKm,638);I.validate(d);});
test('mileage chronology rejects backwards readings and bad trips, allows historical and same-day readings',()=>{const {d,c}=fixture();record(d,c,{type:'odometer',odometer:11000});assert.throws(()=>record(d,c,{type:'odometer',date:'2026-03-01',odometer:9000}),/Одометр/);record(d,c,{type:'odometer',date:'2025-12-01',odometer:9000});record(d,c,{type:'odometer',odometer:10900});assert.throws(()=>record(d,c,{type:'trip',startOdometer:11000,odometer:11000}),/больше/);I.validate(d);});
test('linked purchases edit one expense and keep one inventory item, deletion preserves item',()=>{const {d,c}=fixture();const id=A.saveRecord(d,c,{type:'expense',date:'2026-02-01',name:'Компрессор',amountCents:123456,categoryId:'parts'},{purchase:{name:'Компрессор',parentId:trunk(d,c).id}}),r=c.records.find(r=>r.id===id);assert.equal(A.metrics(c).total,123456);assert.equal(d.nodes.filter(n=>n.id===r.nodeId).length,1);A.saveRecord(d,c,{...r,amountCents:223456,date:'2026-02-02'});assert.equal(A.metrics(c).total,223456);assert.equal(I.getNode(d,r.nodeId).purchaseCents,223456);assert.equal(d.events.filter(e=>e.nodeId===r.nodeId&&e.type==='purchase').length,1);A.deleteRecord(d,c,id);assert.ok(I.getNode(d,r.nodeId));I.validate(d);});
test('TO uses earliest date or mileage, consumes partial/full stock and repeats from actual completion',()=>{const {d,c}=fixture(),oil=I.newNode(d,{name:'Масло',parentId:home(d).id,quantity:5,unit:'л'}),filter=I.newNode(d,{name:'Фильтр',parentId:home(d).id});const taskId=A.saveTask(c,{name:'Заменить масло',dueDate:'2026-03-01',dueOdometer:12000,intervalKm:10000,intervalMonths:12});assert.equal(A.taskState(c,c.maintenance[0],'2026-03-02').status,'overdue');const id=A.completeTask(d,c,taskId,{date:'2026-02-01',odometer:11000,amountCents:120000,consumptions:[{nodeId:oil.id,quantity:4},{nodeId:filter.id,quantity:1}]});assert.equal(oil.quantity,1);assert.ok(filter.archived);assert.equal(c.maintenance[0].dueDate,'2027-02-01');assert.equal(c.maintenance[0].dueOdometer,21000);assert.equal(A.metrics(c).total,120000);I.validate(d);A.deleteRecord(d,c,id);assert.equal(oil.quantity,5);assert.equal(filter.archived,null);assert.equal(c.maintenance[0].dueOdometer,12000);assert.equal(A.metrics(c).total,0);I.validate(d);});
test('TO requires odometer when repeating by km and handles month-end leap years',()=>{const {d,c}=fixture(),id=A.saveTask(c,{name:'ТО',dueDate:'2026-02-01',intervalKm:1000});assert.throws(()=>A.completeTask(d,c,id,{date:'2026-02-01',odometer:null,amountCents:0}),/одометр/);assert.equal(A.shiftMonth('2024-01-31',1),'2024-02-29');assert.equal(A.shiftMonth('2026-01-31',1),'2026-02-28');});
test('tire mileage follows installation sessions and only one set is mounted',()=>{const {d,c}=fixture(),one=A.saveTires(c,{name:'Лето',season:'summer',baseKm:500}),two=A.saveTires(c,{name:'Зима',season:'winter',baseKm:0});A.changeTires(c,one,{date:'2026-02-01',odometer:11000,installed:true});assert.throws(()=>A.changeTires(c,two,{date:'2026-03-01',odometer:12000,installed:true}),/Сначала снимите/);record(d,c,{type:'odometer',date:'2026-03-01',odometer:12000});assert.equal(A.tireMileage(c,c.tires[0]),1500);A.changeTires(c,one,{date:'2026-04-01',odometer:13000,installed:false});A.changeTires(c,two,{date:'2026-04-01',odometer:13000,installed:true});assert.equal(A.tireMileage(c,c.tires[0]),2500);I.validate(d);});
test('trip kits move complete boxes and return original addresses without duplicate moves',()=>{const {d,c}=fixture(),origin=home(d),box=I.newNode(d,{kind:'box',name:'Походный ящик',parentId:origin.id}),thing=I.newNode(d,{name:'Фонарик',parentId:box.id});assert.throws(()=>A.saveKit(d,c,{name:'Повтор',nodeIds:[box.id,thing.id]}));const id=A.saveKit(d,c,{name:'Кемпинг',nodeIds:[box.id]});A.packKit(d,c,id);assert.equal(A.carForNode(d,thing).id,c.id);A.packKit(d,c,id);assert.equal(c.kits[0].entries[0].originId,origin.id);A.packKit(d,c,id,{returning:true});assert.equal(box.parentId,origin.id);assert.equal(thing.parentId,box.id);assert.equal(c.kits[0].entries[0].packed,false);I.validate(d);});
test('common undo restores linked expenses and moves together across JSON backups',()=>{const {d,c}=fixture(),history=createActionHistory(),before=structuredClone(d);record(d,c,{type:'expense',categoryId:'parts',amountCents:1000});history.record(before,{label:'Расход',section:'automobile'},d);history.applyTo(d);history.complete(false);assert.equal(A.car(d,c.id).records.length,0);history.applyTo(d,true);history.complete(true);assert.equal(A.car(d,c.id).records.length,1);I.validate(JSON.parse(JSON.stringify(d)));});
test('invalid imported cars, forged roots, attachments, non-finite values and costs are rejected',()=>{for(const mutate of [(d,c)=>{c.records.push({id:'x',type:'refuel',date:'2026-02-01',litres:-1,amountCents:1,categoryId:'fuel',fullTank:true});},(d,c)=>{c.records.push({id:'x',type:'expense',date:'2026-02-01',amountCents:1.5,categoryId:'parts'});},(d,c)=>{c.records.push({id:'x',type:'fuel',date:'2026-02-30',consumption:7});},(d,c)=>{c.records.push({id:'x',type:'odometer',date:'2026-02-01',odometer:Infinity});},(d,c)=>{c.records.push({id:'x',type:'expense',date:'2026-02-01',amountCents:1,categoryId:'parts',attachments:[{id:'z',name:'Чек',mime:'text/html',data:'data:text/html;base64,AA=='}]});},(d,c)=>{I.getNode(d,c.rootId).automobileId='forged';}]){const {d,c}=fixture();mutate(d,c);assert.throws(()=>I.validate(d));}});

test('clearing a house drawing preserves every car, its possessions, stock and ledger',()=>{const {d,c}=fixture(),item=I.newNode(d,{name:'Аптечка машины',parentId:trunk(d,c).id});record(d,c,{type:'expense',amountCents:10000,categoryId:'parts'});const before=structuredClone(d.automobiles);I.clearApartment(d);assert.deepEqual(d.automobiles,before);assert.equal(A.carForNode(d,item).id,c.id);I.validate(d);});
test('initial odometer can be corrected, and changed TO dates cannot desynchronise repeats',()=>{const {d,c}=fixture();A.updateCar(d,c.id,{initialDate:'2026-01-01',initialOdometer:9000});assert.equal(A.odometer(c),9000);const task=A.saveTask(c,{name:'Масло',dueDate:'2026-02-01',intervalMonths:12}),id=A.completeTask(d,c,task,{date:'2026-02-01',odometer:10000,amountCents:0}),r=c.records.find(r=>r.id===id);assert.throws(()=>A.saveRecord(d,c,{...r,date:'2026-02-02'}),/отмену/);A.saveRecord(d,c,{...r,note:'Уточнение',amountCents:100});assert.equal(c.maintenance[0].dueDate,'2027-02-01');I.validate(d);});
test('same-day repeated service can be reversed in actual completion order',()=>{const {d,c}=fixture(),task=A.saveTask(c,{name:'Проверка',dueDate:'2026-02-01',intervalKm:1000});const one=A.completeTask(d,c,task,{date:'2026-02-01',odometer:11000,amountCents:100}),two=A.completeTask(d,c,task,{date:'2026-02-01',odometer:12000,amountCents:100});assert.throws(()=>A.deleteRecord(d,c,one),/более позднее/);A.deleteRecord(d,c,two);A.deleteRecord(d,c,one);assert.equal(c.maintenance[0].dueDate,'2026-02-01');I.validate(d);});
test('an unfuelled month never reuses a previous-month manual consumption reading',()=>{const {d,c}=fixture();record(d,c,{type:'fuel',consumption:8});record(d,c,{type:'refuel',date:'2026-03-01',odometer:11000,litres:30,amountCents:200000,priceCents:null,categoryId:'fuel',fullTank:true});assert.equal(A.metrics(c,'2026-03').consumption,null);assert.equal(A.metrics(c).consumption,8);assert.equal(A.metrics(c,'2026-03').distance,1000);I.validate(d);});
test('starting a personal home keeps the existing cars, car possessions and operating ledger',()=>{const {d,c}=fixture(),thing=I.newNode(d,{name:'Насос машины',parentId:trunk(d,c).id});record(d,c,{type:'expense',amountCents:50000,categoryId:'parts'});const next=I.createHome(d,{mode:'empty'});assert.deepEqual(next.automobiles,d.automobiles);assert.equal(A.carForNode(next,thing.id).id,c.id);assert.ok(I.getNode(next,thing.id));assert.equal(A.metrics(A.car(next,c.id)).total,50000);I.validate(next);});

test('an explicit car model survives renaming and updates existing trip and loadout previews',()=>{
 const {d,c}=fixture(),thing=I.newNode(d,{name:'Фонарь',parentId:trunk(d,c).id}),nodes=structuredClone(d.nodes);
 record(d,c,{type:'expense',amountCents:12345,categoryId:'parts'});const ledger=structuredClone(c.records);
 const tripId=T.saveTrip(d,{name:'За город'});T.saveBag(d,tripId,{kind:'car',nodeId:c.rootId});T.saveLoadout(d,tripId,'Выезд');
 A.updateCar(d,c.id,{modelType:'vestaSwCross2019'});
 assert.equal(vehicleModelType(c),'vestaSwCross2019');assert.deepEqual(d.nodes,nodes);assert.deepEqual(c.records,ledger);assert.equal(thing.parentId,trunk(d,c).id);
 for(const group of [...d.travel.trips,...d.travel.loadouts])assert.equal(group.bags[0].modelType,'vestaSwCross2019');
 A.updateCar(d,c.id,{modelType:'trailSuv',name:'Моя Vesta'});assert.equal(vehicleModelType(c),'trailSuv');
 const copy=JSON.parse(JSON.stringify(d));I.migrate(copy);I.validate(copy);assert.equal(vehicleModelType(A.car(copy,c.id)),'trailSuv');
 assert.equal(vehicleModelType({name:'Lada Vesta SW Cross'}),'vestaSwCross2019');
});

test('invalid car model changes are rejected before mutating the car or creating storage',()=>{
 const {d,c}=fixture(),before=structuredClone(d);
 assert.throws(()=>A.updateCar(d,c.id,{modelType:'missing-model'}),/3D-модель/);assert.deepEqual(d,before);
 assert.throws(()=>A.addCar(d,{name:'Проверка',modelType:'missing-model'}),/3D-модель/);assert.deepEqual(d,before);
});

test('car removal preserves active and archived possessions, nesting, other cars and trip checklists',()=>{
 const {d,c}=fixture(),other=A.car(d,A.addCar(d,{name:'Другая машина'})),box=I.newNode(d,{kind:'box',name:'Ящик',parentId:trunk(d,c).id}),item=I.newNode(d,{name:'Фонарь',parentId:box.id,purchaseCents:50000});
 const archived=I.newNode(d,{name:'Старый насос',parentId:trunk(d,c).id});I.archive(d,archived.id,{reason:'Продано',date:'2026-02-01'});
 const custom=A.addCompartment(d,c,{name:'Подполье'}),loose=I.newNode(d,{name:'Трос',parentId:custom});
 const trashed=I.newNode(d,{name:'Из корзины',parentId:custom});const entry=I.remove(d,trashed.id);
 record(d,c,{type:'expense',amountCents:10000,categoryId:'parts'});
 const tripId=T.saveTrip(d,{name:'На природу'}),bagId=T.saveBag(d,tripId,{kind:'car',nodeId:c.rootId,items:[item.id]}),tripBefore=structuredClone(T.getTrip(d,tripId));
 const before=structuredClone(d),history=createActionHistory(),plan=structuredClone(d.plan),otherBefore=structuredClone(other),zones=A.compartments(d,c).map(n=>n.id);
 A.deleteCar(d,c.id);assert.equal(A.car(d,c.id),undefined);assert.equal(I.getNode(d,c.rootId),undefined);assert.ok(zones.every(id=>!I.getNode(d,id)));
 assert.equal(box.parentId,I.UNPLACED_ID);assert.equal(item.parentId,box.id);assert.equal(loose.parentId,I.UNPLACED_ID);assert.equal(archived.parentId,I.UNPLACED_ID);assert.ok(archived.archived);
 assert.equal(entry.nodes[0].parentId,I.UNPLACED_ID);assert.deepEqual(d.plan,plan);assert.deepEqual(A.car(d,other.id),otherBefore);
 assert.deepEqual(T.getTrip(d,tripId),tripBefore);assert.equal(T.storageExists(d,T.getTrip(d,tripId).bags.find(b=>b.id===bagId)),false);
 I.validate(JSON.parse(JSON.stringify(d)));
 history.record(before,{label:'Удаление автомобиля',section:'automobile'},d);history.applyTo(d);history.complete(false);assert.deepEqual(d,before);I.validate(d);
 history.applyTo(d,true);history.complete(true);assert.equal(A.car(d,c.id),undefined);assert.equal(I.getNode(d,item.id).parentId,box.id);I.validate(d);
});

test('deleting the last empty car leaves a valid garage that accepts a new vehicle',()=>{
 const {d,c}=fixture();A.deleteCar(d,c.id);assert.equal(A.cars(d).length,0);I.validate(d);
 const next=A.addCar(d,{name:'Новая',modelType:'vestaSwCross2019'});assert.equal(vehicleModelType(A.car(d,next)),'vestaSwCross2019');I.validate(d);
});
test('car weather uses a chosen city, inherits the home city, and can be explicitly disabled',()=>{
 const {d,c}=fixture(),homeCity={name:'Дом',latitude:55,longitude:37},carCity={name:'Гараж',latitude:-34,longitude:18};
 d.settings.weatherLocations={[I.PRIMARY_SPACE_ID]:homeCity};assert.deepEqual(A.weatherCity(d,c),homeCity);
 A.updateCar(d,c.id,{weatherCity:carCity});assert.deepEqual(A.weatherCity(d,c),carCity);I.validate(JSON.parse(JSON.stringify(d)));
 A.updateCar(d,c.id,{weatherCity:null});assert.equal(A.weatherCity(d,c),null);
 const before=structuredClone(d);assert.throws(()=>A.updateCar(d,c.id,{weatherCity:{name:'Ошибка',latitude:99,longitude:37}}),/город/);assert.deepEqual(d,before);
});
