import {createHome,newNode,UNPLACED_ID} from '../inventory/model.js';
export function itemMasterDemo(source) {
  const d=createHome(source,{mode:'empty'});d.demoProfile='item-master';d.plan.name='Мастер предметов · Демо';d.settings.categorySetup={version:1,status:'skipped',packIds:[]};
  newNode(d,{name:'Наушники Sony WH-1000XM5',parentId:UNPLACED_ID,fields:{'Бренд':'Sony','Модель':'WH-1000XM5'}});
  newNode(d,{name:'IKEA KALLAX 182 × 182 см',kind:'furniture',modelType:'bookshelf',parentId:UNPLACED_ID,fields:{'Бренд':'IKEA','Модель':'KALLAX'}});
  newNode(d,{name:'Мой походный рюкзак',kind:'box',parentId:UNPLACED_ID,fields:{'Вес, г':'850'}});
  return d;
}
