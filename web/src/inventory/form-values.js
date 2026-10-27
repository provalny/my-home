import {manualValue} from '../item-master/manual-model.js';

// An untouched form must preserve aliases, previous estimates and imported values.
export function measurementChanges(starting,fields,grams,liters){
 grams=String(grams).trim();liters=String(liters).trim();
 for(const [label,value]of [['Вес',grams],['Объём',liters]]){
  const n=Number(value.replace(',','.'));
  if(value!==''&&(!/^\d+(?:[.,]\d+)?$/.test(value)||!Number.isFinite(n)||n>1e9||(label==='Объём'?n<=0:n<0)))throw Error(label==='Объём'?'Объём: укажите положительное число без единиц измерения':'Вес: укажите неотрицательное число без единиц измерения');
 }
 const weightChanged=grams!==manualValue(starting,'weightGrams'),volumeChanged=liters!==manualValue(starting,'transportLiters'),next={...fields};
 if(weightChanged){delete next['Вес, г'];delete next['Вес, кг'];if(grams)next['Вес, г']=grams.replace(',','.');}
 if(volumeChanged){delete next['Объём, л'];delete next['Транспортный объём, л'];if(liters)next['Транспортный объём, л']=liters.replace(',','.');}
 return {fields:next,weightChanged,volumeChanged};
}
