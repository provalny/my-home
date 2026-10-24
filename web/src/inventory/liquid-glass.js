// One delegated, frame-limited highlight for the inventory, including its dialogs.
const installations=new WeakMap();
export function installLiquidGlass(root,{reducedMotion=()=>false}={}) {
  installations.get(root)?.();
  const doc=root.ownerDocument,controller=new AbortController();
  let active=null,pending=null,frame=0;
  function clear(){
    if(frame)cancelAnimationFrame(frame);
    frame=0;pending=null;
    if(active){active.removeAttribute('data-liquid-hover');active.style.removeProperty('--liquid-x');active.style.removeProperty('--liquid-y');active=null;}
  }
  function move(e){
    if(e.pointerType==='touch'||doc.documentElement.dataset.inventoryMaterial!=='glass'||reducedMotion()){clear();return;}
    const target=e.target instanceof Element?e.target.closest('.iv-btn,.iv-storage-row,.iv-appearance-choice'):null;
    if(!root.isConnected||!target||target.matches(':disabled')){clear();return;}
    if(active!==target){clear();active=target;active.setAttribute('data-liquid-hover','');}
    pending={x:e.clientX,y:e.clientY};
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;
      if(!active?.isConnected||!pending){clear();return;}
      const rect=active.getBoundingClientRect();
      active.style.setProperty('--liquid-x',Math.round(pending.x-rect.left)+'px');
      active.style.setProperty('--liquid-y',Math.round(pending.y-rect.top)+'px');
    });
  }
  const options={passive:true,signal:controller.signal};
  doc.addEventListener('pointermove',move,options);
  doc.addEventListener('pointerout',e=>{if(!e.relatedTarget)clear();},options);
  doc.addEventListener('scroll',clear,{...options,capture:true});
  doc.defaultView.addEventListener('blur',clear,options);
  const dispose=()=>{clear();controller.abort();installations.delete(root);};
  installations.set(root,dispose);return dispose;
}
