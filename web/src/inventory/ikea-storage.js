// Metres. Product sources and the distinction between reference and user dimensions:
// docs/ikea-dimensions.ru.md. Never snap a user's room or furniture to these sizes.
export const IKEA_STORAGE = {
  woodShelfLow:{series:'По мотивам IVAR',size:[.89,1.2,.30],grid:[1,3],kind:'shelf'},
  kallaxShelf:{series:'KALLAX',size:[1.47,1.465,.39],grid:[4,4],kind:'compartment'},
  ivarRack:{series:'IVAR',size:[.89,1.79,.30],grid:[1,4],kind:'shelf'},
  kitchen:{series:'METOD / UTRUSTA',size:[3,2.28,.6],columns:.6,rows:3},
  wardrobe:{series:'PAX / KOMPLEMENT',size:[1,2.01,.58],columns:1,rows:5},
  slidingWardrobe:{series:'PAX / KOMPLEMENT',size:[2,2.36,.58],columns:1,rows:5},
  bookshelf:{series:'BILLY',size:[.8,2.02,.28],columns:.8,rows:6},
  metalRack:{series:'OMAR',size:[.92,1.81,.36],columns:.92,rows:5},
  sideboard:{series:'BESTÅ',size:[1.2,.64,.4],columns:.6,rows:2},
  wallUnit:{series:'BESTÅ',size:[2.4,1.92,.4],columns:.6,rows:6},
  wallShelf:{series:'IVAR',size:[.83,.36,.3],columns:.83,rows:1},
  dresser:{series:'BESTÅ',size:[1.2,.64,.4],columns:.6,rows:3,kind:'drawer'},
  nightstand:{series:'BESTÅ',size:[.6,.64,.4],columns:.6,rows:2,kind:'drawer'},
  shoeCabinet:{series:'BESTÅ',size:[.6,1.28,.4],columns:.6,rows:4},
  hallUnit:{series:'PAX',size:[1,2.01,.58],columns:1,rows:5},
  vanity:{series:'METOD',size:[.8,.88,.6],columns:.8,rows:2},
  island:{series:'METOD',size:[1.8,.92,.6],columns:.6,rows:3},
};
export const isKitchenType=type=>['kitchen','kitchenBase','hoodCabinet'].includes(type);
export const SECTION_KINDS=[['shelf','Полка'],['drawer','Ящик'],['compartment','Отсек'],['box','Контейнер']];
export const KITCHEN_MODULE_TYPES={
  cabinet:{name:'Шкаф',short:'Шкаф',tiers:['base','upper'],storage:true,glyph:'folder',shelves:3},
  hoodCabinet:{name:'Шкаф со встроенной вытяжкой',short:'Шкаф с выт.',tiers:['upper'],storage:true,glyph:'fan',shelves:2},
  hood:{name:'Вытяжка',short:'Выт.',tiers:['upper'],storage:false,glyph:'fan'},
  stove:{name:'Плита с духовкой',short:'Плита',tiers:['base'],storage:false,glyph:'stove'},
  washingMachine:{name:'Стиральная машина',short:'Стир.',tiers:['base'],storage:false,glyph:'washer'},
  dishwasher:{name:'Посудомоечная машина',short:'Посуд.',tiers:['base'],storage:false,glyph:'dishes'},
  dryer:{name:'Сушильная машина',short:'Сушка',tiers:['base'],storage:false,glyph:'dry'},
  dishDrainer:{name:'Шкаф с сушилкой для посуды',short:'Посуда',tiers:['upper'],storage:true,glyph:'dishes',shelves:2},
};
export const kitchenTypeOptions=tier=>Object.entries(KITCHEN_MODULE_TYPES).filter(([,v])=>v.tiers.includes(tier)).map(([id,v])=>[id,v.name]);
export const kitchenModuleName=(key,type='cabinet')=>(type==='cabinet'?(key.startsWith('base:')?'Нижний шкаф':'Верхний шкаф'):KITCHEN_MODULE_TYPES[type].name)+' '+(Number(key.split(':')[1])+1);
export function validateKitchenTypes(shape){if(shape.moduleTypes==null)return;if(typeof shape.moduleTypes!=='object'||Array.isArray(shape.moduleTypes)||Object.keys(shape.moduleTypes).length>150)throw Error('Некорректные типы кухонных модулей');for(const [key,type]of Object.entries(shape.moduleTypes))if(!/^(base|upper):\d{1,2}$/.test(key)||!KITCHEN_MODULE_TYPES[type]?.tiers?.includes(key.split(':')[0]))throw Error('Тип техники не подходит для этого ряда кухни');}
export const sectionName=(kind,index)=>(SECTION_KINDS.find(([id])=>id===kind)?.[1]||'Секция')+' '+index;
export const isBasicSection=n=>['shelf','drawer','compartment'].includes(n?.kind);
export const isSection=n=>isBasicSection(n)||n?.autoSection===true;
export function furnitureReference(shape){return IKEA_STORAGE[shape?.type]||{series:'METOD',size:[.6,.8,.6],columns:.6,rows:3};}
export function automaticGrid(shape,count){const p=furnitureReference(shape),width=shape.width||p.size[0],columns=p.grid?.[0]||Math.min(6,Math.max(1,Math.floor((width+.001)/p.columns)));return {columns:Math.min(columns,Math.max(1,count)),rows:Math.ceil(count/columns)};}
export function defaultSectionCount(shape){const p=IKEA_STORAGE[shape.type];if(!p)return 0;if(p.grid)return p.grid[0]*p.grid[1];const cols=Math.max(1,Math.floor(((shape.width||p.size[0])+.001)/p.columns)),rows=Math.max(1,Math.round((shape.height||p.size[1])/p.size[1]*p.rows));return Math.min(48,cols*rows);}
export function kitchenModules(shape={}) {
  const upperOnly=shape.type==='hoodCabinet',baseOnly=shape.type==='kitchenBase'||shape.upper===false;
  const width=Number.isFinite(shape.width)&&shape.width>0?Math.min(15,shape.width):upperOnly?.6:3;
  const cm=Math.floor(width*100+.001),dp=Array(cm+1).fill(null);dp[0]=[];
  for(let i=1;i<=cm;i++)for(const size of [60,80,40,30,20])if(i>=size&&dp[i-size]){const next=[...dp[i-size],size],score=a=>a.reduce((n,w)=>n+(w===60?0:1),0)+a.length*.01;if(!dp[i]||score(next)<score(dp[i]))dp[i]=next;}
  let used=cm;while(used>0&&!dp[used])used--;
  const widths=dp[used]||[],filler=width-used/100,modules=[];
  const nominalHeight=upperOnly?.8:shape.type==='kitchenBase'?1.16:2.28,nominalDepth=upperOnly?.37:.6;
  const scaleY=(shape.height||nominalHeight)/nominalHeight,scaleZ=(shape.depth||nominalDepth)/nominalDepth;
  for(const tier of upperOnly?['upper']:baseOnly?['base']:['base','upper']){let x=-width/2+filler;for(let i=0;i<widths.length;i++){const w=widths[i]/100,key=tier+':'+i,type=KITCHEN_MODULE_TYPES[shape.moduleTypes?.[key]]?.tiers?.includes(tier)?shape.moduleTypes[key]:upperOnly?'hoodCabinet':'cabinet';modules.push({key,type,tier,index:i,width:w,height:.8*scaleY,depth:(tier==='base'?.6:.37)*scaleZ,x:x+w/2,y:(upperOnly?0:tier==='base'?.08:1.48)*scaleY,z:upperOnly||tier==='base'?0:-.115*scaleZ,shelves:KITCHEN_MODULE_TYPES[type].shelves||0});x+=w;}}
  return {width,height:(upperOnly?.8:shape.type==='kitchenBase'?1.16:baseOnly?.92:2.28)*scaleY,depth:nominalDepth*scaleZ,scaleY,scaleZ,filler,modules,upperOnly};
}
