import {extraDimensions} from './furniture-info.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const precise=n=>Math.round(n*1e6)/1e6;
export function updateWallAttachments(items,rooms,{movingId=null}={}){
 for(const item of items){
  if(item.type!=='neonPorsche')continue;
  if(item.wallSnap===false){delete item.wallAttachment;continue;}
  const [width,,depth]=extraDimensions(item),gap=depth/2+.015;
  const candidates=[];
  for(const room of rooms){
   const [x,z,w,d]=room.rect;
   for(const [wall,length,distance]of [['north',w,Math.abs(item.pos[1]-z)],['south',w,Math.abs(item.pos[1]-z-d)],['west',d,Math.abs(item.pos[0]-x)],['east',d,Math.abs(item.pos[0]-x-w)]]){
    if(width>length)continue;
    const horizontal=wall==='north'||wall==='south',offset=clamp((horizontal?item.pos[0]-x:item.pos[1]-z),width/2,length-width/2);
    const outside=horizontal?Math.max(x-item.pos[0],0,item.pos[0]-x-w):Math.max(z-item.pos[1],0,item.pos[1]-z-d);
    candidates.push({room,wall,offset,distance:Math.hypot(distance,outside)});
   }
  }
  const old=item.wallAttachment;
  let chosen=old&&item.id!==movingId?candidates.find(c=>c.room.id===old.roomId&&c.wall===old.wall):null;
  if(chosen&&Number.isFinite(old.offset)){const length=['north','south'].includes(chosen.wall)?chosen.room.rect[2]:chosen.room.rect[3];chosen.offset=clamp(old.offset,width/2,length-width/2);}
  else chosen=candidates.sort((a,b)=>a.distance-b.distance)[0];
  if(!chosen){delete item.wallAttachment;continue;}
  const {room,wall,offset}=chosen,[x,z,w,d]=room.rect;
  item.pos=wall==='north'?[x+offset,z+gap]:wall==='south'?[x+offset,z+d-gap]:wall==='west'?[x+gap,z+offset]:[x+w-gap,z+offset];
  item.pos=item.pos.map(precise);item.rot={north:0,south:180,west:90,east:-90}[wall];item.y??=1.35;
  item.wallAttachment={roomId:room.id,wall,offset};
 }
}
