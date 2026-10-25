import * as I from '../inventory/model.js';
import * as A from './model.js';

// Explicit browser demo only. Never migrate or infer a personal document as demo.
export function seedAutomobileDemo(d,{referenceDate=I.today()}={}) {
  if(A.cars(d).length)return false;
  if(!A.dateOK(referenceDate))throw Error('Некорректная дата демонстрации');
  const existingNodes=new Set(d.nodes.map(n=>n.id)),existingEvents=new Set(d.events.map(e=>e.id));
  const month=referenceDate.slice(0,7),first=A.shiftMonth(month+'-01',-5),todayDay=Number(referenceDate.slice(8));
  const on=(period,day)=>{const limit=period===month?todayDay:28;return period+'-'+String(Math.min(day,limit)).padStart(2,'0');};
  const days=(date,amount)=>{const v=new Date(date+'T12:00:00Z');v.setUTCDate(v.getUTCDate()+amount);return v.toISOString().slice(0,10);};
  const hall=d.nodes.find(n=>n.kind==='room'&&!n.virtual&&/прихожая|коридор/i.test(n.name))||d.nodes.find(n=>n.kind==='room'&&!n.virtual)||I.getNode(d,I.UNPLACED_ID);
  const category=id=>d.categories.some(c=>c.id===id)?id:'';
  const add=(parentId,name,categoryId='tools',extra={})=>I.newNode(d,{parentId,name,categoryId:category(categoryId),demo:true,...extra});
  const homeBox=add(hall.id,'Автомобиль · сезонное хранение','other',{kind:'box',fill:60,notes:'Демонстрационные вещи для поездок и сезонной смены.'});
  const oil=add(homeBox.id,'Моторное масло 5W-30','tools',{quantity:5,unit:'л',purchaseCents:350000});
  const oilFilter=add(homeBox.id,'Масляный фильтр','tools',{purchaseCents:65000});
  const primaryId=A.addCar(d,{name:'Lada Vesta SW Cross',brand:'Lada',model:'Vesta SW Cross',year:2019,engine:'1.8 · демопример',transmission:'Механическая',fuel:'АИ-95',plate:'ДЕМО',vin:'',color:'#278cb7',initialOdometer:84200,initialDate:first,notes:'Вымышленная карточка для демонстрации. Общая 3D-модель показывает места хранения, а не точную геометрию марки.'});
  const secondaryId=A.addCar(d,{name:'Семейный кроссовер',brand:'Демо',model:'Кроссовер',year:2021,engine:'2.0 · демопример',transmission:'Автоматическая',fuel:'АИ-95',plate:'ДЕМО-2',vin:'',color:'#536c56',initialOdometer:37900,initialDate:first,notes:'Вторая демонстрационная машина с независимой историей и вещами.'});
  const primary=A.car(d,primaryId),secondary=A.car(d,secondaryId);
  const histories=new Map();
  for(const [index,c] of [primary,secondary].entries()){
    c.demo=true;
    const monthlyKm=index?[720,840,960,780,910,850]:[890,1050,1380,1160,1240,1240];
    let start=c.baseline.odometer;const history=[];
    for(let i=0;i<6;i++){
      const period=A.shiftMonth(first,i).slice(0,7),distance=monthlyKm[i];
      const reading=f=>start+Math.round(distance*f);
      const save=(type,day,props)=>A.saveRecord(d,c,{type,date:on(period,day),attachments:[],demo:true,...props});
      const refuels=index?[[8,.3,39.4],[21,.82,42.6]]:[[5,.25,35.2],[12,.52,32.6],[22,.82,30.4]];
      for(const [j,[day,fraction,litres]] of refuels.entries()){
        const priceCents=(index?7250:6990)+i*37+j*14;
        save('refuel',day,{name:'Заправка '+(j+1),odometer:reading(fraction),station:['Лукойл · демо','Газпромнефть · демо','Роснефть · демо'][j],fuel:'АИ-95',litres,priceCents,amountCents:Math.round(priceCents*litres),categoryId:'fuel',fullTank:j!==1,note:'Вымышленная запись. Показатель расхода внесён отдельно по борткомпьютеру.'});
      }
      const tripStart=index?.3:.52;
      save('trip',15,{name:i===5?'Поездка на дачу':'Выезд за город',startOdometer:reading(tripStart),odometer:reading(.7),note:'Демонстрационная поездка с показаниями одометра.'});
      save('trip',23,{name:'Городские поездки',startOdometer:reading(.82),odometer:reading(.95),note:'Несколько поездок за день.'});
      save('odometer',25,{name:'Показания одометра',odometer:reading(1)});
      save('fuel',24,{name:'Расход по борткомпьютеру',consumption:(index?[9.1,9.3,9,8.8,8.6,8.9]:[8.2,8,7.6,7.9,7.5,7.8])[i],note:'Показатель введён вручную, не рассчитан по заправкам.'});
      save('expense',9,{name:'Комплексная мойка',amountCents:(index?850:620)*100,categoryId:'wash',note:'Демонстрационный расход.'});
      save('expense',18,{name:'Парковка за месяц',amountCents:(index?960:840)*100,categoryId:'parking'});
      if(i%2===0)save('expense',23,{name:'Платная дорога',amountCents:(540+i*70)*100,categoryId:'tolls'});
      if(i===1)save('expense',19,{name:'Полис ОСАГО · демо',amountCents:(index?12500:8900)*100,categoryId:'insurance'});
      if(i===2)save('expense',17,{name:'Замена ламп и диагностика',amountCents:(index?4200:2400)*100,categoryId:'repair'});
      if(i===4)save('expense',16,{name:'Салонный фильтр и дворники',amountCents:(index?3600:1850)*100,categoryId:'parts'});
      if(i===5&&index)save('expense',18,{name:'Транспортный налог · демо',amountCents:280000,categoryId:'tax'});
      history.push({period,start,distance});
      start+=distance;
    }
    histories.set(c.id,history);
    const cabin=A.compartments(d,c).find(n=>n.carCompartment==='cabin'),trunk=A.compartments(d,c).find(n=>n.carCompartment==='trunk');
    A.updateCompartment(d,c,cabin.id,{name:'Салон',fill:index?35:60});
    A.updateCompartment(d,c,trunk.id,{name:'Багажник',fill:index?48:78});
    for(const [name,cat,price,extra] of [
      ['Зарядное устройство USB-C','electronics',149000,{}],['Кабели USB-C','electronics',79000,{quantity:2}],['Влажные салфетки','cleaning',19000,{}],['Компактный фонарь','tools',85000,{}],['Зонт','accessories',120000,{}],['Органайзер салона','other',99000,{}],
    ])add(cabin.id,name,cat,{purchaseCents:price,...extra});
    const emergency=add(trunk.id,'Аварийный комплект','tools',{kind:'box',fill:85});
    for(const [name,cat,price,extra] of [
      ['Автомобильная аптечка','medicine',140000,{expiry:days(referenceDate,210)}],['Огнетушитель','tools',180000,{}],['Знак аварийной остановки','tools',65000,{}],['Светоотражающий жилет','clothes',49000,{quantity:2}],['Буксировочный трос','tools',170000,{}],['Рабочие перчатки','clothes',35000,{quantity:2,unit:'пары'}],
    ])add(emergency.id,name,cat,{purchaseCents:price,...extra});
    const tools=add(trunk.id,'Коробка с инструментами','tools',{kind:'box',fill:65});
    for(const [name,price]of [['Домкрат',320000],['Баллонный ключ',95000],['Манометр',69000],['Набор головок',210000]])add(tools.id,name,'tools',{purchaseCents:price});
    if(!index){const underfloor=A.addCompartment(d,c,{name:'Под полом багажника',fill:45});add(underfloor,'Щётка и скребок','tools',{purchaseCents:75000});add(underfloor,'Складная лопата','tools',{purchaseCents:160000});add(underfloor,'Запасные предохранители','tools',{purchaseCents:45000});}
    const summer=A.saveTires(c,{name:'Летний комплект',season:'summer',size:'205/55 R16',baseKm:index?10500:14200,storageId:homeBox.id,condition:'Хорошее',note:'Демонстрационный комплект.'});
    const winter=A.saveTires(c,{name:'Зимний комплект',season:'winter',size:'205/55 R16',baseKm:index?6200:8400,storageId:homeBox.id,condition:'Отличное',note:'Установлен на автомобиль в текущем месяце.'});
    A.changeTires(c,summer,{date:first,odometer:c.baseline.odometer,installed:true});
    const last=history[5],changeKm=last.start+Math.round(last.distance*.78);
    A.changeTires(c,summer,{date:on(month,20),odometer:changeKm,installed:false});
    A.changeTires(c,winter,{date:on(month,20),odometer:changeKm,installed:true});
    A.saveTask(c,{name:'Проверить аптечку и огнетушитель',dueDate:days(referenceDate,-2),dueOdometer:null,intervalMonths:6,leadDays:14,leadKm:500,note:'Пример просроченного напоминания.'});
    A.saveTask(c,{name:'Проверить давление в шинах',dueDate:days(referenceDate,4),dueOdometer:A.odometer(c)+250,intervalMonths:1,leadDays:7,leadKm:500,note:'Срок наступит по дате или пробегу — что раньше.'});
    A.saveTask(c,{name:'Продлить ОСАГО',dueDate:days(referenceDate,32),dueOdometer:null,intervalMonths:12,leadDays:14,note:'Пример напоминания, без хранения документов.'});
  }
  const serviceMonth=histories.get(primaryId)[3],serviceOdo=serviceMonth.start+Math.round(serviceMonth.distance*.74),serviceDate=on(serviceMonth.period,18);
  const oilTask=A.saveTask(primary,{name:'Замена масла и масляного фильтра',dueDate:serviceDate,dueOdometer:serviceOdo,intervalKm:10000,intervalMonths:12,leadDays:14,leadKm:700,note:'Повторное ТО после выполненной замены.'});
  A.completeTask(d,primary,oilTask,{date:serviceDate,odometer:serviceOdo,amountCents:260000,service:'Демо-сервис',note:'Стоимость работ. Масло и фильтр взяты из домашнего запаса.',consumptions:[{nodeId:oil.id,quantity:4},{nodeId:oilFilter.id,quantity:1}]});
  A.saveTask(secondary,{name:'Плановое ТО',dueDate:days(referenceDate,12),dueOdometer:A.odometer(secondary)+450,intervalKm:15000,intervalMonths:12,leadDays:14,leadKm:500,note:'Ближайшее обслуживание второй машины.'});
  const last=histories.get(primaryId)[5],trunk=A.compartments(d,primary).find(n=>n.carCompartment==='trunk');
  A.saveRecord(d,primary,{type:'expense',name:'Покупка автомобильного компрессора',date:on(month,18),odometer:last.start+Math.round(last.distance*.74),amountCents:320000,categoryId:'parts',attachments:[],note:'Один расход и связанная вещь в багажнике.'},{purchase:{name:'Автомобильный компрессор',parentId:trunk.id}});
  const camping=add(homeBox.id,'Ящик для выезда на природу','outdoor',{kind:'box',fill:72});
  for(const [name,cat]of [['Газовая горелка','outdoor'],['Походная посуда','dishes'],['Кемпинговый фонарь','outdoor'],['Термос','dishes']])add(camping.id,name,cat);
  const water=add(homeBox.id,'Канистра питьевой воды','outdoor',{quantity:10,unit:'л'});
  const packed=A.saveKit(d,primary,{name:'Выезд на природу',nodeIds:[camping.id,water.id]});A.packKit(d,primary,packed);
  const winterBag=add(homeBox.id,'Сумка для зимней поездки','outdoor',{kind:'box',fill:50});
  for(const [name,cat]of [['Тёплый плед','linen'],['Запасные варежки','clothes'],['Термогрелки','outdoor']])add(winterBag.id,name,cat);
  const shovel=add(homeBox.id,'Походная лопата','tools');
  A.saveKit(d,primary,{name:'Зимняя поездка',nodeIds:[winterBag.id,shovel.id]});
  for(const n of d.nodes)if(!existingNodes.has(n.id))n.demo=true;
  for(const e of d.events)if(!existingEvents.has(e.id))e.demo=true;
  for(const c of A.cars(d))for(const r of c.records)r.demo=true;
  d.demoProfile={type:'automobile',version:1,referenceDate};
  d.settings.categorySetup??={version:1,status:'completed',packIds:[],excludedCategories:[],excludedCollections:[]};
  I.validate(d);
  return true;
}
