import * as A from './model.js';

export function vehicleStatusCards(c){
 const consumption=A.metrics(c).consumption,condition=c.conditionPercent??90,mounted=c.tires.find(t=>t.sessions.some(s=>s.endOdometer==null));
 const tires=c.tireConditionPercent??null;
 return [
  {id:'odometer',label:'Пробег',value:A.number(A.odometer(c)),unit:'км',glyph:'car'},
  {id:'consumption',label:'Расход',value:A.number(consumption),unit:'л / 100 км',glyph:'dry'},
  {id:'condition',label:'Состояние',value:A.number(condition)+'%',unit:'ручная оценка',percent:condition,glyph:'tools'},
  {id:'tires',label:'Шины · комплект',value:tires==null?mounted?.condition||'Не указано':A.number(tires)+'%',unit:tires==null?'состояние комплекта':'ручная оценка',percent:tires,glyph:'tire'},
 ];
}
