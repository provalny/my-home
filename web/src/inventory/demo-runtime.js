// A showcase (including its embedded editor) never gets persistent device storage,
// a native bridge or a LAN client. Destroying the frame discards the whole session.
function inShowcase(){
  if(typeof window==='undefined')return false;
  if(new URLSearchParams(window.location.search).get('demo')==='showcase')return true;
  try{return Boolean(window.parent!==window&&window.parent.__LIFE_ASSISTANT_SHOWCASE__);}catch{return false;}
}
export const isShowcase=inShowcase();

export function memoryStorage(initial={}){
  const values=new Map(Object.entries(initial).map(([key,value])=>[key,String(value)]));
  return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,
    getItem:key=>values.get(String(key))??null,setItem:(key,value)=>values.set(String(key),String(value)),
    removeItem:key=>values.delete(String(key)),clear:()=>values.clear()};
}

if(isShowcase){
  window.__LIFE_ASSISTANT_SHOWCASE__=true;
  const params=new URLSearchParams(location.search);
  const initial={'iv:interface':JSON.stringify({theme:params.get('theme')==='light'?'light':'dark',collapsed:true}),
    'iv:space-mode':'3d'};
  Object.defineProperty(window,'localStorage',{value:memoryStorage(initial)});
  Object.defineProperty(window,'sessionStorage',{value:memoryStorage()});
}
