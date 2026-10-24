import {extraDimensions} from './furniture-info.js';
import {roomPoints,contourArea} from '../geometry/room.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const precise=n=>Math.round(n*1e6)/1e6||0;
export function updateWallAttachments(items,rooms,{movingId=null}={}){
 for(const item of items){
  if(item.type!=='neonPorsche')continue;
  if(item.wallSnap===false){delete item.wallAttachment;continue;}
  const [width,,depth]=extraDimensions(item),gap=depth/2+.015,candidates=[];
  for(const room of rooms){
   const ps=roomPoints(room),sign=Math.sign(contourArea(ps));
   for(let i=0;i<ps.length;i++){
    const a=ps[i],b=ps[(i+1)%ps.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(width>length)continue;
    const ux=dx/length,uz=dz/length,nx=-uz*sign,nz=ux*sign;
    const wall=room.contour?'edge:'+i:['north','east','south','west'][i];
    const reverse=!room.contour&&(i===2||i===3);
    const projection=(item.pos[0]-a[0])*ux+(item.pos[1]-a[1])*uz;
    let offset=clamp(projection,width/2,length-width/2);
    const old=item.wallAttachment;
    if(old?.roomId===room.id&&old.wall===wall&&item.id!==movingId&&Number.isFinite(old.offset))offset=clamp(reverse?length-old.offset:old.offset,width/2,length-width/2);
    const pos=[a[0]+ux*offset+nx*gap,a[1]+uz*offset+nz*gap];
    candidates.push({room,wall,offset:reverse?length-offset:offset,pos,rot:Math.atan2(nx,nz)*180/Math.PI,distance:Math.hypot(item.pos[0]-pos[0],item.pos[1]-pos[1])});
   }
  }
  const old=item.wallAttachment;
  const chosen=(old&&item.id!==movingId?candidates.find(c=>c.room.id===old.roomId&&c.wall===old.wall):null)||candidates.sort((a,b)=>a.distance-b.distance)[0];
  if(!chosen){delete item.wallAttachment;continue;}
  item.pos=chosen.pos.map(precise);item.rot=precise(chosen.rot)===-180?180:precise(chosen.rot);item.y??=1.35;
  item.wallAttachment={roomId:chosen.room.id,wall:chosen.wall,offset:chosen.offset};
 }
}
