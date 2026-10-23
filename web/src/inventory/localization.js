const NAMES={
  Ceiling:'Потолочный светильник','Floor lamp':'Торшер','TV backlight':'Подсветка телевизора',Pendant:'Подвесной светильник',Spots:'Споты','Counter light':'Подсветка столешницы','Bedside left':'Прикроватная лампа слева','Bedside right':'Прикроватная лампа справа','Mirror light':'Подсветка зеркала',
  'Living AC':'Кондиционер в гостиной','Bedroom AC':'Кондиционер в спальне',
  Living:'Гостиная',Dining:'Столовая',Kitchen:'Кухня',Bedroom:'Спальня',Bathroom:'Ванная',
  Bright:'Яркий свет',Cozy:'Уют',Movie:'Кино',Night:'Ночь',Away:'Никого нет',Morning:'Утро',Home:'Моя квартира',
};
export function translationCandidates(plan){const found=[];if(NAMES[plan.name])found.push({key:'plan',from:plan.name,to:NAMES[plan.name],label:'Название квартиры'});
  for(const group of ['rooms','lights','acs','scenes','furniture'])for(const item of plan[group]||[]){if(item.id&&NAMES[item.name])found.push({key:group+':'+item.id,group,id:item.id,from:item.name,to:NAMES[item.name],label:({rooms:'Комната',lights:'Светильник',acs:'Кондиционер',scenes:'Сцена',furniture:'Мебель'})[group]});}return found;}
export function translatePlan(plan,keys){const candidates=translationCandidates(plan),wanted=new Set(keys);for(const c of candidates){if(!wanted.has(c.key))continue;if(c.key==='plan')plan.name=c.to;else plan[c.group].find(n=>n.id===c.id).name=c.to;}return candidates.filter(c=>wanted.has(c.key)).length;}
