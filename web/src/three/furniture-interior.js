import * as THREE from 'three';
import { box, at } from './kit.js';
import { buildFurniture } from './furniture.js';
import { IKEA_SHELF_BUILDERS, shelfFrame, shelfOpening } from './ikea-shelves.js';

// Start with the exact furniture from the plan. Only its solid cabinet face is
// articulated; legs, mirrors, trim, appliances and all original materials remain.
export function buildFurnitureInterior(shape,zones) {
  const root=buildFurniture([{...shape,pos:[0,0],rot:0,y:0}]);
  root.updateMatrixWorld(true);
  if(IKEA_SHELF_BUILDERS[shape.type]){
    const hits=[],labels=[],contentSlots=[],{w,h,d}=shelfFrame(shape);
    for(const zone of zones){
      const slot=shelfOpening(shape,zone.rect),tint=new THREE.MeshBasicMaterial({color:'#8ec5ff',transparent:true,opacity:.015,depthWrite:false});
      const hit=at(box(Math.max(.002,slot.width),Math.max(.002,slot.height),.004,tint,{r:0}),slot.centerX,slot.baseY,slot.frontZ);
      hit.userData={kind:'section',id:zone.nodeId};root.add(hit);hits.push(hit);
      const anchor=new THREE.Object3D();anchor.position.set(slot.centerX,slot.baseY+slot.height/2,slot.frontZ+.04);root.add(anchor);
      labels.push({nodeId:zone.nodeId,name:zone.name,kind:zone.kind,anchor,width:slot.width,height:slot.height});contentSlots.push({zone,...slot,parent:root});
    }
    root.position.set(shape.pos[0],shape.y||0,shape.pos[1]);root.rotation.y=THREE.MathUtils.degToRad(shape.rot||0);
    return {root,hits,labels,contentSlots,dimensions:[w,h,d],animate(){},highlight(id){hits.forEach(hit=>{hit.material.opacity=hit.userData.id===id?.18:.015;});}};
  }
  if(['pcCase','macBook','simCockpit','simCockpitTriple','printer3dEnclosed','printer3dOpen','officeChair','gamingDesktop','monitorStand','desktopMonitor','smallDesk','neonPorsche','ikeaFloorLamp','whiteSpeaker'].includes(shape.type)){
    const hits=[],labels=[];let lid=null;
    root.traverse(mesh=>{if(mesh.userData.storageLid)lid=mesh;});
    const start=lid?.position.y;
    if(['simCockpit','simCockpitTriple'].includes(shape.type))for(const zone of zones){
      const marker=box(.34,.16,.012,new THREE.MeshBasicMaterial({color:'#8ec5ff',transparent:true,opacity:.015,depthWrite:false}));
      marker.position.set(0,.09,-.22);marker.userData={kind:'section',id:zone.nodeId};root.add(marker);hits.push(marker);
      const anchor=new THREE.Object3D();anchor.position.set(0,.23,-.22);root.add(anchor);labels.push({nodeId:zone.nodeId,name:zone.name,kind:zone.kind,anchor,width:.34,height:.16});
    }
    const dimensions=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).toArray();
    root.position.set(shape.pos[0],shape.y||0,shape.pos[1]);root.rotation.y=THREE.MathUtils.degToRad(shape.rot||0);
    return {root,hits,labels,dimensions,animate(progress){if(lid)lid.position.y=start+THREE.MathUtils.smoothstep(progress,0,1)*.18;},highlight(id){hits.forEach(hit=>{hit.material.opacity=hit.userData.id===id?.18:.015;});}};
  }
  const originals=[];
  root.traverse(mesh=>{if(mesh.isMesh&&!mesh.isInstancedMesh){const bounds=new THREE.Box3().setFromObject(mesh),size=bounds.getSize(new THREE.Vector3());originals.push({mesh,bounds,size});}});
  const bodies=originals.filter(({size})=>size.x>.25&&size.y>.3&&size.z>.2);
  // For composite furniture, open its actual tall cabinet, retaining the rest.
  bodies.sort((a,b)=>b.size.y-a.size.y||b.size.x*b.size.z-a.size.x*a.size.z);
  const body=bodies[0],bounds=body?.bounds.clone()||new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const [w,h,d]=[size.x,size.y,size.z],t=Math.min(.025,w*.035,h*.035,d*.08);
  const material=body?.mesh.material||originals.find(o=>o.size.x>w*.5)?.mesh.material;
  const structure=new THREE.Group();root.add(structure);
  const hits=[],labels=[],motions=[],hiddenWhenOpen=[],contentSlots=[];
  const panel=(pw,ph,pd,x,y,z,parent=structure,m=material)=>{const mesh=at(box(Math.max(.002,pw),Math.max(.002,ph),Math.max(.002,pd),m,{r:.004}),x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  let bottom=bounds.min.y+t,top=bounds.max.y-t;
  if(shape.type==='stove'){bottom=bounds.min.y+h*.18;top=bounds.min.y+h*.77;}
  const innerW=w-2*t,innerH=top-bottom,left=bounds.min.x+t,front=bounds.max.z;
  if(body){
    hiddenWhenOpen.push(body.mesh);
    panel(w,h,t,center.x,bounds.min.y,bounds.min.z+t/2);
    panel(t,h,d,bounds.min.x+t/2,bounds.min.y,center.z);panel(t,h,d,bounds.max.x-t/2,bounds.min.y,center.z);
    panel(w,t,d,center.x,bounds.min.y,center.z);panel(w,t,d,center.x,bounds.max.y-t,center.z);
    if(shape.type==='stove'){panel(w,bottom-bounds.min.y,t,center.x,bounds.min.y,front-t/2);panel(w,bounds.max.y-top,t,center.x,top,front-t/2);}
  }else{
    // Open shelves keep their posts/back/feet. Reflow only the inner boards.
    for(const o of originals)if(o.size.x>w*.5&&o.size.y<.06&&o.size.z>d*.5&&o.bounds.min.y>bottom&&o.bounds.max.y<top)hiddenWhenOpen.push(o.mesh);
  }
  if(['bookshelf','bookcaseTall','bookcaseMedium'].includes(shape.type)&&zones.some(zone=>Number.isFinite(zone.fill))){
    for(const o of originals)if(o.size.x<w*.25&&o.size.y<h*.35&&o.size.z>t*1.5&&o.size.z<d*.85)hiddenWhenOpen.push(o.mesh);
  }
  const drawerFronts=['dresser','nightstand','shoeCabinet'].includes(shape.type);
  const faces=[];
  if(body){
    if(drawerFronts){for(const zone of zones)faces.push({rect:zone.rect,drawer:true,nodeId:zone.nodeId});}
    else if(shape.type==='fridge'){
      const split=.35;faces.push({rect:[0,0,1,split]},{rect:[0,split,1,1-split]});
    }else{
      const count=shape.type==='slidingWardrobe'?3:shape.type==='sideboard'?4:shape.type==='wardrobe'?Math.max(2,Math.round(w/.55)):w>.85?2:1;
      for(let i=0;i<count;i++)faces.push({rect:[i/count,0,1/count,1],side:i<count/2?-1:1,sliding:shape.type==='slidingWardrobe'});
    }
  }
  const faceForPoint=(x,y)=>faces.find(f=>{const [fx,fy,fw,fh]=f.rect;return x>=fx-.001&&x<=fx+fw+.001&&y>=fy-.001&&y<=fy+fh+.001;});
  for(const face of faces){
    const [x,y,rw,rh]=face.rect,fw=rw*w,fh=rh*(top-bottom),cx=bounds.min.x+(x+rw/2)*w,base=top-(y+rh)*(top-bottom);
    const pivot=new THREE.Group();structure.add(pivot);
    if(face.drawer){pivot.position.set(cx,base,0);panel(fw-.003,fh-.003,t,0,0,front-t/2,pivot);panel(fw-2*t,t,d*.85,0,0,center.z,pivot);for(const side of [-1,1])panel(t,Math.min(fh*.6,.2),d*.85,side*(fw/2-t),0,center.z,pivot);}
    else if(shape.type==='stove'){pivot.position.set(cx,base,front);panel(fw-.003,fh-.003,t,0,0,-t/2,pivot);}
    else{pivot.position.set(face.side===1?cx+fw/2:cx-fw/2,base,front);panel(fw-.003,fh-.003,t,cx-pivot.position.x,0,-t/2,pivot);}
    face.pivot=pivot;face.start=pivot.position.clone();motions.push(face);
  }
  // Attach the real facade pieces (including mirrored sliding doors and handles)
  // to the corresponding moving part, without recolouring or replacing them.
  for(const o of originals){if(o===body||o.size.z>d*.28||o.bounds.max.z<front-.035||o.bounds.min.z>front+.12)continue;
    if(o.size.x>w*.9&&o.size.y<.05)continue; // fixed rails and horizontal trim
    const c=o.bounds.getCenter(new THREE.Vector3());if(c.x<bounds.min.x||c.x>bounds.max.x||c.y<bottom||c.y>top)continue;
    const face=faceForPoint((c.x-bounds.min.x)/w,(top-c.y)/(top-bottom));if(!face)continue;
    root.updateMatrixWorld(true);face.pivot.attach(o.mesh);
  }
  const edges=new Set();
  for(const z of zones){const [x,y,rw,rh]=z.rect,zw=rw*innerW,zh=rh*innerH,cx=left+(x+rw/2)*innerW,base=top-(y+rh)*innerH,cy=base+zh/2;
    for(const [axis,start,length]of [['x',x,rh],['y',y+rh,rw]]){const key=[axis,start,axis==='x'?y:x,length].join(':');if(edges.has(key))continue;edges.add(key);
      if(axis==='x'&&start>0)panel(t,zh,d-t,left+x*innerW,base,center.z);
      if(axis==='y'&&start<.999)panel(zw,t,d-t,cx,base,center.z);
    }
    const tint=new THREE.MeshBasicMaterial({color:'#8ec5ff',transparent:true,opacity:.015,depthWrite:false,side:THREE.DoubleSide});
    const hit=panel(zw-t,zh-t,.008,cx,base,front+.015,root,tint);hit.userData={kind:'section',id:z.nodeId};hits.push(hit);
    const anchor=new THREE.Object3D();anchor.position.set(cx,cy,front+.04);root.add(anchor);labels.push({nodeId:z.nodeId,name:z.name,kind:z.kind,anchor,width:zw,height:zh});
    let contentParent=faces.find(face=>face.drawer&&face.nodeId===z.nodeId)?.pivot||structure;
    if(z.kind==='drawer'&&!drawerFronts){const tray=new THREE.Group();structure.add(tray);tray.position.set(cx,base,0);panel(zw-t,t,d*.8,0,0,center.z,tray);panel(zw-t,zh*.3,t,0,0,front-t,tray);motions.push({pivot:tray,start:tray.position.clone(),drawer:true});contentParent=tray;}
    contentSlots.push({zone:z,width:zw-2*t,height:zh-2*t,depth:d-3*t,centerX:cx,baseY:base+t,frontZ:front-t,parent:contentParent});
  }
  const originalMeshes=new Set(originals.map(o=>o.mesh)),generated=[];structure.traverse(o=>{if(o.isMesh&&!originalMeshes.has(o))generated.push(o);});
  function animate(progress){const p=THREE.MathUtils.smoothstep(progress,0,1);for(const mesh of generated)mesh.visible=p>0;for(const mesh of hiddenWhenOpen)mesh.visible=p===0;
    for(const face of motions){face.pivot.position.copy(face.start);face.pivot.rotation.set(0,0,0);if(face.drawer)face.pivot.position.z+=p*d*.3;else if(face.sliding)face.pivot.position.x+=(face.side===1?-1:1)*w*.3*p;else if(shape.type==='stove')face.pivot.rotation.x=Math.PI*.45*p;else face.pivot.rotation.y=(face.side===1?1:-1)*Math.PI*.61*p;}
  }
  const highlight=id=>hits.forEach(hit=>{hit.material.opacity=hit.userData.id===id?.18:.015;});
  root.position.set(shape.pos[0],shape.y||0,shape.pos[1]);root.rotation.y=THREE.MathUtils.degToRad(shape.rot||0);animate(0);
  return {root,hits,labels,contentSlots,dimensions:[w,h,d],animate,highlight};
}
