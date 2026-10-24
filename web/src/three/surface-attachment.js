import * as THREE from 'three';
import { buildFurniture, footprint } from './furniture.js';

export const SURFACE_ITEMS=new Set(['macBook','pcCase','printer3dEnclosed','printer3dOpen','gamingDesktop','desktopMonitor','whiteSpeaker']);
const SUPPORT_TYPES=new Set(['desk','coffeeTable','diningSet','island','sideboard','dresser','nightstand','printerCabinet','wallShelf','smallDesk']);
const cache=new Map();
const radians=degrees=>(degrees||0)*Math.PI/180;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const precise=n=>Math.round(n*1e6)/1e6;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
// Measure the broadest real top, excluding monitors, chairs, books and handles.
// Local measurements also include the existing model's dimension scaling.
export function furnitureSurface(item){
  if(!SUPPORT_TYPES.has(item.type))return null;
  const key=JSON.stringify([item.type,item.width,item.height,item.depth]);
  if(cache.has(key))return cache.get(key);
  const root=buildFurniture([{...item,pos:[0,0],y:0,rot:0}]);root.updateMatrixWorld(true);
  let best=null;
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const bounds=new THREE.Box3().setFromObject(mesh),size=bounds.getSize(new THREE.Vector3()),area=size.x*size.z;
    if(size.x<.3||size.z<.25)return;
    if(!best||area>best.area+.0001||Math.abs(area-best.area)<.0001&&bounds.max.y>best.y)best={area,y:bounds.max.y,x:(bounds.min.x+bounds.max.x)/2,z:(bounds.min.z+bounds.max.z)/2,w:size.x,d:size.z};
  });
  root.traverse(mesh=>mesh.geometry?.dispose());
  if(cache.size>100)cache.clear();cache.set(key,best);return best;
}
function toLocal(item,support){
  const a=radians(support.rot),dx=item.pos[0]-support.pos[0],dz=item.pos[1]-support.pos[1];
  return [Math.cos(a)*dx-Math.sin(a)*dz,Math.sin(a)*dx+Math.cos(a)*dz];
}
function place(item,support,surface,x,z,rotation){
  const a=radians(support.rot),angle=radians(rotation),[w,d]=footprint(item);
  const hw=(Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*d)/2,hd=(Math.abs(Math.sin(angle))*w+Math.abs(Math.cos(angle))*d)/2;
  if(hw>surface.w/2+1e-6||hd>surface.d/2+1e-6)return false;
  x=clamp(x,surface.x-surface.w/2+hw,surface.x+surface.w/2-hw);
  z=clamp(z,surface.z-surface.d/2+hd,surface.z+surface.d/2-hd);
  item.pos=[precise(support.pos[0]+Math.cos(a)*x+Math.sin(a)*z),precise(support.pos[1]-Math.sin(a)*x+Math.cos(a)*z)];
  item.y=precise((support.y||0)+surface.y);item.rot=(support.rot||0)+rotation;
  item.surfaceAttachment={supportId:support.id,x,z,rotation};return true;
}
// movingId distinguishes moving equipment from moving its supporting furniture.
export function updateSurfaceAttachments(items,{movingId=null}={}){
  for(const item of items){
    if(!SURFACE_ITEMS.has(item.type))continue;
    if(item.surfaceSnap===false){delete item.surfaceAttachment;continue;}
    const attachment=item.surfaceAttachment;
    if(attachment&&item.id!==movingId){
      const support=items.find(s=>s.id===attachment.supportId),surface=support&&furnitureSurface(support);
      if(surface&&[attachment.x,attachment.z,attachment.rotation].every(finite)&&place(item,support,surface,attachment.x,attachment.z,attachment.rotation))continue;
    }
    const candidates=[];
    for(const support of items){
      if(!support.id||support===item||!Array.isArray(support.pos))continue;
      const surface=furnitureSurface(support);if(!surface)continue;
      const [x,z]=toLocal(item,support);
      if(Math.abs(x-surface.x)<=surface.w/2&&Math.abs(z-surface.z)<=surface.d/2)candidates.push({support,surface,x,z});
    }
    candidates.sort((a,b)=>(b.support.y||0)+b.surface.y-((a.support.y||0)+a.surface.y));
    const found=candidates.some(({support,surface,x,z})=>place(item,support,surface,x,z,(item.rot||0)-(support.rot||0)));
    if(!found){delete item.surfaceAttachment;item.y=0;}
  }
}
