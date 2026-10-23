// Metres. Product sources and the distinction between reference and user dimensions:
// docs/ikea-dimensions.ru.md. Never snap a user's room or furniture to these sizes.
export const IKEA_STORAGE = {
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
export const SECTION_KINDS=[['shelf','Полка'],['drawer','Ящик'],['compartment','Отсек'],['box','Контейнер']];
export const sectionName=(kind,index)=>(SECTION_KINDS.find(([id])=>id===kind)?.[1]||'Секция')+' '+index;
export const isBasicSection=n=>['shelf','drawer','compartment'].includes(n?.kind);
export const isSection=n=>isBasicSection(n)||n?.autoSection===true;
export function furnitureReference(shape){return IKEA_STORAGE[shape?.type]||{series:'METOD',size:[.6,.8,.6],columns:.6,rows:3};}
export function automaticGrid(shape,count){const p=furnitureReference(shape),width=shape.width||p.size[0],columns=Math.min(6,Math.max(1,Math.floor((width+.001)/p.columns)));return {columns:Math.min(columns,Math.max(1,count)),rows:Math.ceil(count/columns)};}
export function defaultSectionCount(shape){const p=IKEA_STORAGE[shape.type];if(!p)return 0;const cols=Math.max(1,Math.floor(((shape.width||p.size[0])+.001)/p.columns)),rows=Math.max(1,Math.round((shape.height||p.size[1])/p.size[1]*p.rows));return Math.min(48,cols*rows);}
export function kitchenModules(shape={}) {
  const width=Number.isFinite(shape.width)&&shape.width>0?Math.min(15,shape.width):3;
  const cm=Math.floor(width*100+.001),dp=Array(cm+1).fill(null);dp[0]=[];
  for(let i=1;i<=cm;i++)for(const size of [60,80,40,30,20])if(i>=size&&dp[i-size]){const next=[...dp[i-size],size],score=a=>a.reduce((n,w)=>n+(w===60?0:1),0)+a.length*.01;if(!dp[i]||score(next)<score(dp[i]))dp[i]=next;}
  let used=cm;while(used>0&&!dp[used])used--;
  const widths=dp[used]||[],filler=width-used/100,modules=[];
  const scaleY=(shape.height||2.28)/2.28,scaleZ=(shape.depth||.6)/.6;
  for(const tier of shape.upper===false?['base']:['base','upper']){let x=-width/2+filler;for(let i=0;i<widths.length;i++){const w=widths[i]/100;modules.push({key:tier+':'+i,tier,index:i,width:w,height:.8*scaleY,depth:(tier==='base'?.6:.37)*scaleZ,x:x+w/2,y:(tier==='base'?.08:1.48)*scaleY,z:tier==='base'?0:-.115*scaleZ,shelves:3});x+=w;}}
  return {width,height:(shape.upper===false?.92:2.28)*scaleY,depth:.6*scaleZ,scaleY,scaleZ,filler,modules};
}
