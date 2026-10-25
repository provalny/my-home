import { randomID } from '../uuid.js';
import { createApartment, apartments, put, monthShift, monthDay, monthOf, today } from './model.js';

const DEMO_KIND='monitoring-example';
export const findMonitoringDemo=doc=>apartments(doc).find(a=>a.demo?.kind===DEMO_KIND);
const shiftedDate=(date,days)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const round=n=>Math.round(n*1000)/1000;

// A small, real PDF with selectable text. No personal or payment details.
function receipt(period,amountCents){
  const lines=['DEMONSTRATION RECEIPT','NOT A REAL BILL - DO NOT PAY','',`Period: ${period}`,'Service: Electricity','Provider: Demo Energy','Account: DEMO-001',`Amount: ${(amountCents/100).toFixed(2)} RUB`,'','Fictional data for previewing the apartment monitor.'];
  const stream='BT /F1 15 Tf 48 780 Td 24 TL '+lines.map((s,i)=>(i?'T* ':'')+'('+s.replace(/[\\()]/g,'\\$&')+') Tj').join('\n')+' ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((obj,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});const start=pdf.length;
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return {id:randomID(),name:`Демо-квитанция — электричество ${period}.pdf`,data:'data:application/pdf;base64,'+btoa(pdf)};
}

export function createMonitoringDemo({asOf=today(),planSpaceId='home'}={}){
  const period=monthOf(asOf),first=monthShift(period,-23),a=createApartment({name:'Демо-квартира · Пример',planSpaceId,address:'Демонстрационная квартира. Все суммы, показания и реквизиты вымышлены.'});
  a.demo={kind:DEMO_KIND,version:1,asOf};a.settings.remindersEnabled=false;
  const provider=['Демоэнергосбыт','Демоводоканал','Демотеплосеть','Демоводоканал','Демотеплосеть','Демо-сервис дома','Демо-фонд ремонта','Демоэкология','Демо-интернет','Демогаз','Демо-мобайл','Демо-ТВ','Демо-охрана','Демо-паркинг'];
  a.services.forEach((s,i)=>Object.assign(s,{provider:provider[i],account:'ДЕМО-'+String(i+1).padStart(3,'0'),note:'Вымышленная услуга для знакомства с мониторингом.'}));
  const [electric,cold,hot,drain,heat,,,,internet,gas]=a.services;
  const works={id:randomID(),name:'Обслуживание и ремонт',glyph:'tools',color:'#85baa0',unit:'работа',mode:'fixed',provider:'Демо-мастер',account:'ДЕМО-015',note:'Разовые работы и ремонты в примере.',openingCents:0,archived:false};a.services.push(works);
  const replaceMonth=monthShift(period,-5),replacement=monthDay(replaceMonth,15);
  const addMeter=(service,name,serial,scheme='single',installedAt=first+'-01',retiredAt=null,verificationDate=null)=>{
    const id=put(a,'meters',{serviceId:service.id,name,serial,scheme,installedAt,retiredAt,verificationDate});return a.meters.find(m=>m.id===id);
  };
  const old=addMeter(electric,'Электросчётчик · заменён','ДЕМО-Э-001','dual',first+'-01',replacement);
  const current=addMeter(electric,'Электросчётчик · основной','ДЕМО-Э-002','dual',shiftedDate(replacement,1),null,shiftedDate(asOf,45));
  const kitchen=addMeter(cold,'Холодная вода · кухня','ДЕМО-Х-101','single',first+'-01',null,shiftedDate(asOf,10));
  const bathroom=addMeter(cold,'Холодная вода · ванная','ДЕМО-Х-102','single',first+'-01',null,shiftedDate(asOf,140));
  const hotMeter=addMeter(hot,'Горячая вода','ДЕМО-Г-201','single',first+'-01',null,shiftedDate(asOf,25));
  const gasMeter=addMeter(gas,'Газовый счётчик','ДЕМО-ГАЗ-01','single',first+'-01',null,shiftedDate(asOf,300));
  const season=[435,392,354,302,267,238,221,232,274,318,376,420];
  const electricityCharges=[294500,268000,244000,211000,189000,171000,160000,168000,196500,226000,259000,287000];
  let oldDay=9180,oldNight=3250,newDay=0,newNight=0,coldKitchen=146,coldBath=327,hotTotal=208,gasTotal=540;
  for(let i=0;i<24;i++){
    const month=monthShift(first,i),monthNumber=Number(month.slice(5))-1,isCurrent=month===period,readDay=isCurrent?Math.min(Number(asOf.slice(8)),22):22,date=monthDay(month,readDay),billDate=monthDay(month,isCurrent?Math.min(Number(asOf.slice(8)),12):12);
    const factor=i<12?.94:1,usage=round(season[monthNumber]*factor+(i%3-1)*4),coldUsage=round(10.2+(i%5)*.6),hotUsage=round(5.1+(i%4)*.35),heating=[1.83,1.7,1.38,.82,.23,0,0,0,.12,.72,1.24,1.64][monthNumber],gasUsage=round(18.4+(i%6)*1.3);
    for(const [s,amount] of [[electric,usage],[cold,coldUsage],[hot,hotUsage],[drain,round(coldUsage+hotUsage)],[heat,heating],[gas,gasUsage]])put(a,'consumption',{serviceId:s.id,date,period:month,amount,note:'Демонстрационная запись. Расход внесён отдельно от показаний.'});
    const oldPeriod=month<replaceMonth,day=round(usage*.72),night=round(usage-day);
    let activeMeter=old;
    if(oldPeriod){oldDay=round(oldDay+day);oldNight=round(oldNight+night);}
    else{activeMeter=current;newDay=round(newDay+day);newNight=round(newNight+night);}
    if(month===replaceMonth){put(a,'readings',{meterId:old.id,serviceId:electric.id,date:replacement,values:{day:oldDay,night:oldNight},note:'Финальные показания перед заменой. Демо.'});}
    put(a,'readings',{meterId:activeMeter.id,serviceId:electric.id,date,values:oldPeriod?{day:oldDay,night:oldNight}:{day:newDay,night:newNight},note:'Показания день/ночь · демонстрационный пример'});
    coldKitchen=round(coldKitchen+coldUsage*.4);coldBath=round(coldBath+coldUsage*.6);hotTotal=round(hotTotal+hotUsage);gasTotal=round(gasTotal+gasUsage);
    for(const [m,value] of [[kitchen,coldKitchen],[bathroom,coldBath],[hotMeter,hotTotal],[gasMeter,gasTotal]])put(a,'readings',{meterId:m.id,serviceId:m.serviceId,date,values:{total:value},note:'Демонстрационные накопительные показания'});
    const charges=[Math.round(electricityCharges[monthNumber]*factor),Math.round((472+(i%5)*28)*100),Math.round((1070+(i%4)*64)*100),Math.round((615+(i%4)*34)*100),Math.round(heating*289000),289000,94000,21800,i<14?65000:75000,Math.round((158+(i%6)*14)*100),128000,39000,45000,180000];
    for(let j=0;j<14;j++){
      const s=a.services[j],adjustmentCents=isCurrent&&j===0?-7500:isCurrent&&j===8?-10000:0,amountCents=charges[j];
      const dueDate=isCurrent?shiftedDate(asOf,j===9?-3:j===1?2:j===8?1:5):monthDay(month,28);
      const billId=put(a,'bills',{serviceId:s.id,date:billDate,period:month,amountCents,adjustmentCents,dueDate,note:isCurrent&&adjustmentCents?'Демонстрационный перерасчёт в пользу жильца.':'Демонстрационный счёт, оплачивать не нужно.',attachments:j===0&&i>=21?[receipt(month,amountCents+adjustmentCents)]:[]});
      const charged=amountCents+adjustmentCents;
      if(charged<=0)continue;
      if(!isCurrent||[2,3,5,6,7,10,11,12,13].includes(j)){
        const paid=charged+(isCurrent&&j===10?20000:0);
        if(i%6===2&&j===0){const part=Math.floor(paid*.6);put(a,'payments',{billId,date:monthDay(month,18),amountCents:part,note:'Демо: первая часть оплаты'});put(a,'payments',{billId,date:monthDay(month,24),amountCents:paid-part,note:'Демо: остаток оплаты'});}
        else put(a,'payments',{billId,date:isCurrent?asOf:monthDay(month,24),amountCents:paid,note:isCurrent&&j===10?'Демо: оплата с переплатой 200 ₽':'Демонстрационная оплата'});
      }else if(j===0||j===1)put(a,'payments',{billId,date:asOf,amountCents:Math.floor(charged*(j===0?.6:.5)),note:'Демонстрационная частичная оплата'});
    }
    for(const dayOfMonth of [4,14,24]){
      const climateDate=monthDay(month,dayOfMonth);if(climateDate>asOf)continue;
      put(a,'climate',{date:climateDate,temperature:round(22.1+(monthNumber>=5&&monthNumber<=7?2.6:.5)+(dayOfMonth%3)*.35),humidity:Math.round(38+(monthNumber>=4&&monthNumber<=8?12:4)+(i+dayOfMonth)%9),note:'Демонстрационный замер общих показателей квартиры'});
    }
  }
  for(const [s,zone,rates] of [[electric,'day',[625,680,725]],[electric,'night',[271,298,325]],[cold,'total',[4580,4810,5150]],[hot,'total',[19100,19800,21100]],[gas,'total',[790,845,880]],[internet,'fixed',[65000,65000,75000]]]){
    for(const [i,date] of [first+'-01',monthShift(period,-12)+'-01',monthShift(period,-3)+'-01'].entries())put(a,'tariffs',{serviceId:s.id,name:zone==='day'?'Тариф Т1 · день':zone==='night'?'Тариф Т2 · ночь':zone==='fixed'?'Абонентская плата':'Основной тариф',date,zone,rateCents:rates[i],note:'Демонстрационный справочный тариф. Счета по нему не рассчитываются.'});
  }
  const task=(name,kind,serviceId,dueDate,completedAt=null,costCents=null,note='Демонстрационная запись журнала обслуживания')=>put(a,'tasks',{name,kind,serviceId,dueDate,completedAt,costCents,note});
  task('Заменить фильтры питьевой воды','maintenance',cold.id,shiftedDate(asOf,3),null,240000);
  task('Проверить уплотнитель окна','repair',works.id,shiftedDate(asOf,-2),null,180000);
  task('Плановая чистка вентиляции','maintenance',works.id,shiftedDate(asOf,12),null,350000);
  task('Заменить гибкую подводку на кухне','repair',works.id,shiftedDate(asOf,20),null,290000);
  task('Проверить газовое оборудование','maintenance',gas.id,shiftedDate(asOf,28));
  task('Внести показания за текущий месяц','reading',electric.id,asOf);
  task('Передать показания поставщикам','submission',null,shiftedDate(asOf,1));
  task('Замена электросчётчика','maintenance',electric.id,replacement,replacement,420000,'Демо: старый счётчик снят, история показаний сохранена.');
  const repaired=monthDay(monthShift(period,-2),17);
  task('Ремонт смесителя в ванной','repair',works.id,repaired,repaired,260000);
  task('Обслуживание кондиционера','maintenance',works.id,monthDay(monthShift(period,-4),12),monthDay(monthShift(period,-4),12),380000);
  for(const [name,date,cost] of [['Замена электросчётчика',replacement,420000],['Ремонт смесителя',repaired,260000]]){const billId=put(a,'bills',{serviceId:works.id,date,period:monthOf(date),amountCents:cost,adjustmentCents:0,dueDate:date,note:'Демо: '+name,attachments:[]});put(a,'payments',{billId,date,amountCents:cost,note:'Демонстрационная оплата работы'});}
  for(const [name,kind,day,serviceId] of [['Внести показания счётчиков','reading',23,null],['Передать показания воды','submission',25,cold.id],['Передать показания электричества','submission',26,electric.id],['Проверить оплату услуг','payment',28,null]])put(a,'rules',{name,kind,day,serviceId,enabled:true});
  const previous=monthShift(period,-1);for(const r of a.rules)put(a,'completions',{ruleId:r.id,date:monthDay(previous,r.day)});
  return a;
}

// Append only; repeat clicks select the same demo instead of duplicating history.
export function addMonitoringDemo(doc,options={}){
  const existing=findMonitoringDemo(doc);if(existing)return existing.id;
  const a=createMonitoringDemo(options);doc.monitoring??={version:1,apartments:[]};doc.monitoring.apartments.push(a);return a.id;
}
