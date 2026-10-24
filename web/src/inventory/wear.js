const calendarDate=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?date:null;
};
export const resolvedWearMode=node=>node.wearMode||(node.wear!=null?'manual':'standard');
export function wearSchedule(node){
 const mode=resolvedWearMode(node);
 if(mode!=='standard')return {mode,start:node.purchasedAt||'',months:node.usefulLifeMonths};
 const date=new Date(node.createdAt||'');
 const start=Number.isFinite(date.getTime())?`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`:'';
 return {mode,start,months:36};
}
export function itemWear(node,now=new Date()){
 if(resolvedWearMode(node)==='manual')return typeof node.wear==='number'&&Number.isFinite(node.wear)?Math.max(0,Math.min(100,Math.round(node.wear))):null;
 const schedule=wearSchedule(node),start=calendarDate(schedule.start),months=schedule.months;
 if(!start||!Number.isInteger(months)||months<1||months>1200)return null;
 const end=new Date(start);const day=end.getUTCDate();end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+months);const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();end.setUTCDate(Math.min(day,last));
 const today=typeof now==='string'?calendarDate(now):new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()));
 if(!today||!Number.isFinite(today.getTime()))return null;
 return Math.round(Math.max(0,Math.min(1,(today-start)/(end-start)))*100);
}
export function validateWear(node){
 if(node.wearMode!=null&&!['manual','automatic','standard'].includes(node.wearMode))throw Error('Некорректный режим износа');
 if(node.usefulLifeMonths!=null&&(!Number.isInteger(node.usefulLifeMonths)||node.usefulLifeMonths<1||node.usefulLifeMonths>1200))throw Error('Срок полезного использования: от 1 до 1200 месяцев');
 if(node.wearMode==='automatic'&&(!calendarDate(node.purchasedAt)||!node.usefulLifeMonths))throw Error('Для расчёта износа укажите дату покупки и срок полезного использования');
}
