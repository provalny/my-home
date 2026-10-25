import * as THREE from 'three';
import { buildTrailSuv } from './trail-suv.js';
import { extraDimensions } from './furniture-info.js';
import { buildStorageClutter } from './storage-clutter.js';

export function buildTrailStorage(shape,zones) {
  const root=buildTrailSuv({...shape,vehicleOpen:{}}),vehicle=root.userData.vehicle,hits=[],labels=[],clutter=[];
  for(const zone of zones){
    const trunk=zone.carCompartment==='trunk',z=trunk?-1.55:.44,width=trunk?1.10:.53,depth=trunk?.76:.32,y=trunk?.755:.72;
    const contents=buildStorageClutter(zone,width,.35,depth);contents.position.set(trunk?0:.38,y,z);vehicle.inner.add(contents);clutter.push(contents);
    const hit=new THREE.Mesh(new THREE.BoxGeometry(width,.40,depth),new THREE.MeshBasicMaterial({color:'#8ec5ff',transparent:true,opacity:.015,depthWrite:false}));
    hit.position.set(trunk?0:.38,y+.20,z);hit.userData={kind:'section',id:zone.nodeId};vehicle.inner.add(hit);hits.push(hit);
    const anchor=new THREE.Object3D();anchor.position.copy(hit.position);vehicle.inner.add(anchor);labels.push({nodeId:zone.nodeId,name:zone.name,kind:zone.kind,anchor,width,height:.40});
  }
  root.position.set(shape.pos?.[0]||0,shape.y||0,shape.pos?.[1]||0);root.rotation.y=THREE.MathUtils.degToRad(shape.rot||0);
  return {root,hits,labels,clutter,dimensions:extraDimensions(shape),animate(progress){for(const part of vehicle.openings)vehicle.setOpen(part.key,part.key==='hood'?0:THREE.MathUtils.smootherstep(progress,0,1));},highlight(id){for(const hit of hits)hit.material.opacity=hit.userData.id===id?.16:.015;}};
}
