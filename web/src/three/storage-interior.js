import { isKitchenType } from '../inventory/ikea-storage.js';
import * as THREE from 'three';
import { box, at, isSharedMaterial } from './kit.js';
import { buildFurniture } from './furniture.js';
import { buildKitchen } from './kitchen.js';
import { buildFurnitureInterior } from './furniture-interior.js';
import { decorateStorageInterior } from './storage-clutter.js';
import { buildFridge } from './fridge.js';
import { buildTrailStorage } from './trail-suv-storage.js';

export function disposeObject(root){if(!root)return;const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(m&&!isSharedMaterial(m)){materials.add(m);if(m.map)textures.add(m.map);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
export function storageDimensions(shape,container=false){if(container)return [.72,.62,.52];const sample=buildFurniture([{...shape,pos:[0,0],y:0,rot:0}]);const size=new THREE.Box3().setFromObject(sample).getSize(new THREE.Vector3());disposeObject(sample);return [Math.max(.2,size.x),Math.max(.2,size.y),Math.max(.15,size.z)];}

export function buildStorageInterior(shape,zones,{container=false,dimensions=null,moduleKey=null,chamberKey=null}={}){
  if(shape.type==='trailSuv'&&!container){const model=buildTrailStorage(shape,zones);return {...model,dispose(){disposeObject(model.root);}};}
  if(shape.type==='fridge'&&!container){const model=buildFridge(shape,{zones,chamberKey});model.root.position.set(shape.pos[0],shape.y||0,shape.pos[1]);model.root.rotation.y=THREE.MathUtils.degToRad(shape.rot||0);return {...model,dispose(){disposeObject(model.root);}};}
  if(isKitchenType(shape.type)&&!container){const kitchen=decorateStorageInterior(buildKitchen(shape,{zones,moduleKey}));kitchen.root.position.set(shape.pos[0],shape.y||0,shape.pos[1]);kitchen.root.rotation.y=THREE.MathUtils.degToRad(shape.rot||0);kitchen.animate(0);return {...kitchen,dispose(){disposeObject(kitchen.root);}};}
  if(!container){const model=decorateStorageInterior(buildFurnitureInterior(shape,zones));return {...model,dispose(){disposeObject(model.root);}};}
  const [w,h,d]=dimensions||storageDimensions(shape,container),root=new THREE.Group(),hits=[],labels=[],doors=[],drawers=[],contentSlots=[];
  const lightBody=['fridge','stove','kitchen','vanity'].includes(shape.type),openShelf=['metalRack','bookshelf','wallShelf'].includes(shape.type);
  const wood=new THREE.MeshStandardMaterial({color:container?'#ad977a':shape.color||(lightBody?'#e3e4de':'#ba9570'),roughness:.7,metalness:shape.type==='metalRack'?.65:.05});
  const backMat=new THREE.MeshStandardMaterial({color:lightBody?'#b9bcb9':'#63503f',roughness:.9});
  const handleMat=new THREE.MeshStandardMaterial({color:'#b9c3c8',metalness:.7,roughness:.35});
  const t=Math.min(.035,w*.035,h*.035,d*.08),left=-w/2+t,bottom=t*1.8,insideW=w-2*t,insideH=h-3*t;
  const panel=(pw,ph,pd,x,y,z,m=wood,parent=root)=>{const mesh=at(box(Math.max(.005,pw),Math.max(.005,ph),Math.max(.005,pd),m,{r:.004}),x,y,z);parent.add(mesh);return mesh;};
  panel(w,h,t,0,0,-d/2,backMat);panel(t,h,d,-w/2+t/2,0,0);panel(t,h,d,w/2-t/2,0,0);panel(w,t,d,0,0,0);panel(w,t,d,0,h-t,0);
  const edges=new Set();
  function division(x,y,width,height,vertical){const key=[x,y,width,height].map(n=>n.toFixed(4)).join(':');if(edges.has(key))return;edges.add(key);if(vertical)panel(t,height,d-t,x,y,-t/2);else panel(width,t,d-t,x,y,-t/2);}
  for(const zone of zones){const [x,y,rw,rh]=zone.rect,zw=rw*insideW,zh=rh*insideH,cx=left+(x+rw/2)*insideW,cy=bottom+(1-y-rh/2)*insideH;
    if(x>0)division(left+x*insideW,bottom+(1-y-rh)*insideH,t,zh,true);
    if(y+rh<.999)division(cx,bottom+(1-y-rh)*insideH,zw,t,false);
    const tint=new THREE.MeshBasicMaterial({color:'#8ec5ff',transparent:true,opacity:.015,depthWrite:false,side:THREE.DoubleSide});
    const hit=at(box(Math.max(.02,zw-t),Math.max(.02,zh-t),.012,tint,{r:0}),cx,cy-zh/2,d/2-.02);hit.userData={kind:'section',id:zone.nodeId};root.add(hit);hits.push(hit);
    const label=new THREE.Object3D();label.position.set(cx,cy,d/2+.015);root.add(label);labels.push({nodeId:zone.nodeId,name:zone.name,kind:zone.kind,anchor:label,width:zw,height:zh});
    let contentParent=root;
    if(zone.kind==='drawer'||['dresser','nightstand'].includes(shape.type)&&zone.kind==='space'){
      const tray=new THREE.Group();root.add(tray);tray.position.set(cx,bottom+(1-y-rh)*insideH,0);
      panel(zw-t,t,d*.85,0,0,0,wood,tray);panel(t,zh*.35,d*.85,-zw/2+t,0,0,wood,tray);panel(t,zh*.35,d*.85,zw/2-t,0,0,wood,tray);panel(zw-t,Math.min(zh*.35,.16),t,0,0,d*.45,wood,tray);panel(Math.min(.18,zw*.3),.015,.025,0,.05,d*.47,handleMat,tray);drawers.push(tray);contentParent=tray;
    }
    contentSlots.push({zone,width:zw-2*t,height:zh-2*t,depth:d-4*t,centerX:cx,baseY:cy-zh/2+t,frontZ:d/2-2*t,parent:contentParent});
  }
  if(!openShelf){
    if(shape.type==='stove'){
      const pivot=new THREE.Group();pivot.position.set(0,h*.06,d/2+t);root.add(pivot);
      panel(w-2*t,h*.85,t,0,0,0,wood,pivot);panel(w*.7,h*.55,.008,0,h*.14,t,new THREE.MeshStandardMaterial({color:'#263641',roughness:.25}),pivot);panel(w*.6,.025,.04,0,h*.73,t*2,handleMat,pivot);doors.push({pivot,axis:'x',angle:Math.PI*.45});
    }else{
      const count=shape.type==='fridge'||container?1:2;
      for(let i=0;i<count;i++){const side=i===0?-1:1,pivot=new THREE.Group();pivot.position.set(side*w/2,0,d/2+t);root.add(pivot);const doorW=w/count-t;
        panel(doorW,h-2*t,t,-side*doorW/2,t,0,wood,pivot);panel(.015,Math.min(.28,h*.3),.035,-side*(doorW-.06),h*.46,t,handleMat,pivot);
        doors.push({pivot,axis:'y',angle:side*Math.PI*.61,sliding:shape.type==='slidingWardrobe',side});
      }
    }
  }
  root.position.set(shape.pos[0],shape.y||0,shape.pos[1]);root.rotation.y=THREE.MathUtils.degToRad(shape.rot||0);
  function animate(progress){const p=THREE.MathUtils.smoothstep(progress,0,1);for(const door of doors){if(door.sliding)door.pivot.position.x=door.side*(w/2+p*w*.42);else door.pivot.rotation[door.axis]=door.angle*p;}for(const drawer of drawers)drawer.position.z=p*d*.32;}
  // Keep selected zone tint independent from the saved model/materials.
  const highlight=id=>hits.forEach(hit=>{hit.material.opacity=hit.userData.id===id ? .18 : .015;});
  animate(0);
  return decorateStorageInterior({root,hits,labels,contentSlots,dimensions:[w,h,d],animate,highlight,dispose(){disposeObject(root);}});
}
