import * as I from '../inventory/model.js';
import * as T from './model.js';
import {addCar,cars} from '../automobile/model.js';
export function seedTravelDemo(d){
 if(T.trips(d).length)return;const carId=addCar(d,{name:'Демо · Внедорожник',color:'#536d67'}),c=cars(d).find(c=>c.id===carId),trunk=d.nodes.find(n=>n.parentId===c.rootId&&n.carCompartment==='trunk');
 const parent=d.nodes.find(n=>n.kind==='room'&&!n.virtual)?.id||null;
 const item=(name,grams,modelType,parentId=parent)=>I.newNode(d,{name,parentId,kind:'item',travelEligible:true,fields:grams==null?{}:{'Вес, г':String(grams)},...(modelType?{modelType}: {})});
 const backpack=item('Походный рюкзак',850,'backpack20'),bag=item('Дорожная сумка',700,'travelBag30');
 const gear=[item('Дождевик',220),item('Термос',480),item('Фонарик',130),item('Тёплая куртка',620),item('Аптечка',340,null,trunk.id),item('Зарядный кабель',65),item('Пауэрбанк',null),item('Кроссовки',760)];
 const id=T.saveTrip(d,{name:'Санкт-Петербург → Кириши',startDate:'2026-11-07',endDate:'2026-11-08',participants:2,carId,notes:'Демонстрационная поездка. Даты, вещи и события — пример.'});
 T.saveStop(d,id,{name:'Санкт-Петербург',lat:59.9386,lon:30.3141});T.saveStop(d,id,{name:'Кириши',lat:59.4497,lon:32.0087});
 const b=T.saveBag(d,id,{nodeId:backpack.id,modelType:'backpack20',capacityLiters:20,usedLiters:8,maxWeightKg:10,color:'#657652'});T.saveBag(d,id,{nodeId:bag.id,modelType:'travelBag30',capacityLiters:30,usedLiters:5,maxWeightKg:12,color:'#bf8553'});T.transferItems(d,id,b,gear.slice(0,3).map(n=>n.id));
 T.saveEvent(d,id,{date:'2026-11-07',time:'09:00',name:'Выезд из Санкт-Петербурга',notes:'Проверить вещи и зарядить телефон.'});T.saveEvent(d,id,{date:'2026-11-07',time:'15:00',type:'stay',name:'Заселение',notes:'Добавьте адрес и подтверждение бронирования.'});T.saveEvent(d,id,{date:'2026-11-08',time:'12:00',name:'Прогулка у Волхова',notes:'Демонстрационный пункт плана.'});T.migrateTravel(d);d.demoProfile={type:'travel',version:1};d.settings.categorySetup={version:1,status:'completed',packIds:[],excludedCategories:[],excludedCollections:[]};
}
