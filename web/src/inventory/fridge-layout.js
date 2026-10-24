export const FRIDGE_INSTALLATIONS=[['freestanding','Обычный'],['builtIn','Встроенный']];
export const FREEZER_POSITIONS=[['bottom','Снизу'],['top','Сверху']];
export function fridgeConfig(shape={}){return {installation:shape.fridge?.installation??'freestanding',chambers:shape.fridge?.chambers??2,freezerPosition:shape.fridge?.freezerPosition??'bottom'};}
export function validateFridgeConfig(shape){
  if(shape.fridge==null)return;
  const c=fridgeConfig(shape);
  if(typeof shape.fridge!=='object'||Array.isArray(shape.fridge)||!FRIDGE_INSTALLATIONS.some(([id])=>id===c.installation)||![1,2,3].includes(c.chambers)||!FREEZER_POSITIONS.some(([id])=>id===c.freezerPosition))throw Error('Холодильник: выберите тип, 1–3 отделения и положение морозилки');
}
export function fridgeChambers(shape={}){
  const c=fridgeConfig(shape),names={cooling:'Холодильное отделение',fresh:'Зона свежести',freezer:'Морозильное отделение'};
  const specs=c.chambers===1?[['cooling',1]]:c.chambers===2?[['cooling',.68],['freezer',.32]]:[['cooling',.58],['fresh',.16],['freezer',.26]];
  if(c.chambers>1&&c.freezerPosition==='top')specs.reverse();
  let y=0;return specs.map(([key,height])=>{const chamber={key,name:names[key],rect:[0,y,1,height]};y+=height;return chamber;});
}
