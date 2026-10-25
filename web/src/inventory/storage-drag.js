// Pointer dragging keeps the same behaviour in the browser and the Mac web view.
// Touch users can scroll the cards and use selection + the Move button.
export function bindStorageDrag(card, {root, getSelection, destinationAllowed, move, itemSelector='.iv-storage-row[data-node-id]', scrollSelector='.iv-tree,.iv-storage-scroll'}) {
  card.draggable=false;
  let suppressClick=false;
  card.addEventListener('click',event=>{
    if(!suppressClick)return;
    event.preventDefault();event.stopImmediatePropagation();suppressClick=false;
  },true);
  card.addEventListener('dragstart',event=>event.preventDefault());
  card.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.pointerType==='touch'||event.target.closest('input,select,textarea,.iv-wear'))return;
    const pointerId=event.pointerId,startX=event.clientX,startY=event.clientY;
    let x=startX,y=startY,dragging=false,ids=[],ghost=null,target=null,frame=0,lastFrame=0;
    const clearTarget=()=>{target?.classList.remove('iv-drop');target=null;};
    const updateTarget=()=>{
      clearTarget();
      const hit=document.elementFromPoint(x,y)?.closest('[data-storage-destination]');
      if(hit&&root.contains(hit)&&destinationAllowed(ids,hit.dataset.storageDestination)){
        target=hit;target.classList.add('iv-drop');
      }
      ghost.classList.toggle('is-valid',Boolean(target));
      ghost.style.left=Math.min(x+14,window.innerWidth-ghost.offsetWidth-8)+'px';
      ghost.style.top=Math.max(8,Math.min(y+14,window.innerHeight-ghost.offsetHeight-8))+'px';
    };
    const tick=time=>{
      if(!card.isConnected){clear();return;}
      const elapsed=lastFrame?Math.min(32,time-lastFrame):16;lastFrame=time;
      const scroller=document.elementFromPoint(x,y)?.closest(scrollSelector);
      if(scroller&&root.contains(scroller)){
        const rect=scroller.getBoundingClientRect(),edge=Math.min(40,rect.height/4);
        const speed=y<rect.top+edge?-Math.min(1,(rect.top+edge-y)/edge):y>rect.bottom-edge?Math.min(1,(y-rect.bottom+edge)/edge):0;
        if(speed){scroller.scrollTop+=speed*elapsed*.65;updateTarget();}
      }
      frame=requestAnimationFrame(tick);
    };
    const clear=()=>{
      window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',finish);
      window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',onKey);window.removeEventListener('blur',cancel);
      if(card.hasPointerCapture(pointerId))card.releasePointerCapture(pointerId);
      cancelAnimationFrame(frame);clearTarget();ghost?.remove();
      root.querySelectorAll('.iv-storage-dragging').forEach(el=>el.classList.remove('iv-storage-dragging'));
      root.classList.remove('iv-storage-drag-active');
      if(dragging){suppressClick=true;setTimeout(()=>{suppressClick=false;},0);}
    };
    const onMove=e=>{
      if(e.pointerId!==pointerId)return;
      x=e.clientX;y=e.clientY;
      if(!dragging){
        if(Math.hypot(x-startX,y-startY)<6)return;
        ids=getSelection();if(!ids.length){clear();return;}
        dragging=true;suppressClick=true;card.setPointerCapture(pointerId);
        root.classList.add('iv-storage-drag-active');
        const selected=new Set(ids);
        root.querySelectorAll(itemSelector).forEach(el=>el.classList.toggle('iv-storage-dragging',selected.has(el.dataset.nodeId)));
        ghost=document.createElement('div');ghost.className='iv-storage-drag-preview';
        ghost.textContent=`Переместить: ${ids.length}`;ghost.setAttribute('aria-hidden','true');document.body.append(ghost);
        frame=requestAnimationFrame(tick);
      }
      e.preventDefault();updateTarget();
    };
    const finish=e=>{
      if(e.pointerId!==pointerId)return;
      if(dragging){x=e.clientX;y=e.clientY;updateTarget();}
      const destination=target?.dataset.storageDestination;
      clear();if(dragging&&destination)move(ids,destination);
    };
    const cancel=()=>clear();
    const onKey=e=>{if(e.key==='Escape'){e.preventDefault();clear();}};
    window.addEventListener('pointermove',onMove,{passive:false});window.addEventListener('pointerup',finish);
    window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',onKey);window.addEventListener('blur',cancel);
  });
  return card;
}
