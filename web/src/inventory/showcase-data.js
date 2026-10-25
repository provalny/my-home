import * as I from './model.js';
import {seedAutomobileDemo} from '../automobile/demo.js';
import {seedTravelDemo} from '../travel/demo.js';
import {addMonitoringDemo} from '../monitoring/demo.js';
import * as P from '../metrics/model.js';
import {saveResult,fingerprint} from '../item-master/model.js';

// Always build from the bundled plan, never from the user's apartment or backup.
export function createShowcaseDocument(plan,{referenceDate=I.today()}={}){
  const d=I.demo(plan);
  d.plan.name='Демо-квартира';
  seedAutomobileDemo(d,{referenceDate});
  seedTravelDemo(d);
  addMonitoringDemo(d,{asOf:referenceDate});
  d.personalMetrics={version:1,entries:[],health:[],settings:{dailyPrompt:false,skippedOn:null}};
  for(let i=0;i<21;i++){
    const date=new Date(referenceDate+'T12:00:00');date.setDate(date.getDate()-i);const day=P.today(date);
    P.putEntry(d,{date:day,mood:[4,3,5,4][i%4],energy:[4,3,4,5][i%4],tension:[2,3,1,2][i%4],productivity:[4,3,5][i%3],busyMinutes:240+i%5*35,note:i%3?'Вымышленная ежедневная отметка.':'Демо: прогулка и спокойный вечер.'});
    P.putHealth(d,{date:day,sleepMinutes:420+i%5*18,steps:6200+i%7*850,activityMinutes:35+i%4*12,source:'manual'});
  }
  I.newNode(d,{name:'Наушники Sony WH-1000XM5 · демо',parentId:I.UNPLACED_ID,categoryId:'electronics',fields:{'Бренд':'Sony','Модель':'WH-1000XM5'}});
  const room=d.nodes.find(n=>n.kind==='room'&&!n.virtual);
  const old=I.newNode(d,{name:'Старая куртка · демо',parentId:room.id,categoryId:'clothes',purchaseCents:450000});
  I.archive(d,old.id,{reason:'Больше не используется · пример',date:referenceDate});
  const discarded=I.newNode(d,{name:'Сломанный фонарик · демо',parentId:room.id,categoryId:'tools'});
  I.remove(d,discarded.id);
  const laptop=d.nodes.find(n=>n.name==='MacBook');
  if(laptop){
    const url='https://example.com/demo-product';
    saveResult(d,laptop.id,{candidates:[{id:'showcase-laptop',title:'MacBook · учебный результат',url,sourceKind:'other',fields:{weightGrams:{value:1400,source:url,basis:'Вымышленные данные для демонстрации сравнения. Не характеристика реальной модели.'}}}]},fingerprint(laptop));
  }
  d.demoProfile={type:'showcase',version:1,referenceDate};
  d.settings.categorySetup={version:1,status:'completed',packIds:[]};d.settings.notifications=false;
  d.awards={version:2,activity:[],earned:{'first-item':{earnedAt:new Date().toISOString()},'first-room':{earnedAt:new Date().toISOString()}}};
  for(const n of d.nodes)n.demo=true;
  for(const e of d.events)e.demo=true;
  I.migrate(d);I.validate(d);return d;
}
