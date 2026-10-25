// Editable planning estimates, not manufacturer specifications. Existing weights win.
export const FURNITURE_WEIGHT_ESTIMATES_KG={sofa:65,armchair:25,coffeeTable:15,tv:10,sideboard:35,diningSet:40,island:90,kitchen:180,fridge:65,bed:55,nightstand:12,dresser:40,plant:5,vanity:45,bathtub:40,toilet:30,desk:25,wardrobe:90,bookshelf:30,rug:8,trailSuv:2200,crossover:1600,duffel60:1.2,backpack20:.85,travelBag30:.7,woodShelfLow:12,parrotCage:10,kallaxShelf:60,ivarRack:20,kitchenBase:110,hoodCabinet:25,officeChair:15,gamingDesktop:1.5,monitorStand:12,desktopMonitor:6,smallDesk:10,neonPorsche:3,ikeaFloorLamp:5,whiteSpeaker:2,bookcaseTall:35,bookcaseMedium:22,pcCase:12,macBook:1.6,simCockpit:45,simCockpitTriple:65,printer3dEnclosed:15,printer3dOpen:8,printerCabinet:18,metalRack:18,tireStack:40,washingMachine:65,dishwasher:45,stove:40,microwave:12,shoeCabinet:20,hallUnit:65,cornerSofa:100,slidingWardrobe:130,wallUnit:100,wallShelf:8,laundryBasket:2,showerCabin:70};
export function weightKg(n){for(const [key,factor]of [['Вес, г',.001],['Вес, кг',1]]){const v=n?.fields?.[key];if(v!=null&&String(v).trim()!==''){const parsed=Number(String(v).replace(/\s/g,'').replace(',','.'));return Number.isFinite(parsed)&&parsed>=0?parsed*factor:null;}}return typeof n?.weightKg==='number'&&Number.isFinite(n.weightKg)&&n.weightKg>=0?n.weightKg:null;}
export function estimatedWeight(n){return !!n?.weightEstimate&&weightKg(n)!=null&&Math.abs(weightKg(n)*1000-n.weightEstimate.grams)<.001;}
export function ensureFurnitureWeight(n){
 if(n.kind!=='furniture'||n.autoSection)return;
 const known=weightKg(n),estimate=estimatedWeight(n);
 if(known!=null&&!estimate)return;
 // Never replace an explicit but malformed entry with a seemingly reliable number.
 if(known==null&&['Вес, г','Вес, кг'].some(k=>String(n.fields?.[k]??'').trim()))return;
 const type=n.modelType||'generic',kg=FURNITURE_WEIGHT_ESTIMATES_KG[type]??25;
 n.fields??={};n.fields['Вес, г']=String(kg*1000);
 n.weightEstimate={grams:kg*1000,modelType:type,basis:type==='generic'||!Object.hasOwn(FURNITURE_WEIGHT_ESTIMATES_KG,type)?'Приблизительный вес: тип мебели не определён':'Приблизительный вес по типу модели; уточните по паспорту или взвешиванию'};
}
