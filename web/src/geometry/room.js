// Contour coordinates are relative to the room rectangle, so moving/resizing is stable.
export const RECT_CONTOUR = [[0,0],[1,0],[1,1],[0,1]];
export function roomPoints(room) {
  const [x,z,w,d]=room.rect || [room.x,room.z,room.w,room.d];
  return (room.contour || RECT_CONTOUR).map(([u,v])=>[x+u*w,z+v*d]);
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const on=(a,b,p)=>Math.abs(cross(a,b,p))<1e-8&&p[0]>=Math.min(a[0],b[0])-1e-8&&p[0]<=Math.max(a[0],b[0])+1e-8&&p[1]>=Math.min(a[1],b[1])-1e-8&&p[1]<=Math.max(a[1],b[1])+1e-8;
export function contourArea(points) {return points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2;}
export function validateContour(points) {
  if(!Array.isArray(points)||points.length<3||points.length>64||points.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||v<0||v>1)))throw Error('Контур: нужно от 3 до 64 углов в пределах комнаты.');
  if(Math.abs(contourArea(points))<1e-6)throw Error('Контур комнаты должен иметь площадь.');
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    if(Math.hypot(b[0]-a[0],b[1]-a[1])<1e-6)throw Error('Соседние углы не должны совпадать.');
    const prev=points[(i+points.length-1)%points.length];
    if(Math.abs(cross(prev,a,b))<1e-8&&(prev[0]-a[0])*(b[0]-a[0])+(prev[1]-a[1])*(b[1]-a[1])>0)throw Error('Стены не должны накладываться друг на друга.');
    for(let j=i+1;j<points.length;j++){
      if(j===i+1||i===0&&j===points.length-1)continue;
      const c=points[j],d=points[(j+1)%points.length];
      if(on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b)||cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)throw Error('Стены контура не должны пересекаться.');
    }
  }
  return points;
}
export function roomContains(room,point) {
  if(!Array.isArray(point))return false;
  const ps=roomPoints(room);let inside=false;
  for(let i=0,j=ps.length-1;i<ps.length;j=i++){
    const a=ps[j],b=ps[i];if(on(a,b,point))return true;
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export function roomInteriorPoint(room) {
  const ps=roomPoints(room),center=ps.reduce((s,p)=>[s[0]+p[0]/ps.length,s[1]+p[1]/ps.length],[0,0]);
  if(roomContains(room,center))return center;
  const [x,z,w,d]=room.rect||[room.x,room.z,room.w,room.d];
  for(let i=1;i<40;i++)for(let j=1;j<40;j++){const p=[x+w*i/40,z+d*j/40];if(roomContains(room,p))return p;}
  return ps[0];
}
