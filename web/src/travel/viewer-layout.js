import * as THREE from 'three';
import {placeOnGround} from '../three/meadow-stage.js';

export function arrangeStorageModels(entries){
 let cursor=0;const parts=[];
 for(const entry of entries){
  const rotation=entry.kind==='car'?.12:-.1,bounds=placeOnGround(entry.model,{x:0,z:0,rotation}),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  placeOnGround(entry.model,{x:cursor+size.x/2-center.x,z:-bounds.max.z,rotation});
  parts.push(entry);cursor+=size.x+(entry.kind==='car'?.38:.20);
 }
 const width=cursor-(entries.at(-1)?.kind==='car'?.38:.20),bounds=new THREE.Box3();
 for(const entry of parts){entry.model.position.x-=Math.max(0,width)/2;entry.model.updateMatrixWorld(true);entry.bounds=new THREE.Box3().setFromObject(entry.model);bounds.union(entry.bounds);}
 if(bounds.isEmpty())bounds.set(new THREE.Vector3(-.5,0,-.5),new THREE.Vector3(.5,.6,.5));
 return {bounds,parts,footprints:parts.map(p=>{const size=p.bounds.getSize(new THREE.Vector3()),center=p.bounds.getCenter(new THREE.Vector3());return {x:center.x,z:center.z,width:size.x,depth:size.z};})};
}

export function storageCameraPose(bounds,aspect,time,{selected=null,overview=false}={}){
 const size=bounds.getSize(new THREE.Vector3()),allCenter=bounds.getCenter(new THREE.Vector3()),tan=Math.tan(THREE.MathUtils.degToRad(35/2));
 const fullDistance=Math.max(1.4,(Math.max(size.y*1.25,size.x/Math.max(.35,aspect))/(2*tan)+size.z*.45)*1.25);
 const targetBounds=!overview&&selected?selected:bounds,extent=targetBounds.getSize(new THREE.Vector3()),center=targetBounds.getCenter(new THREE.Vector3());
 const focusing=!overview&&selected;
 const distance=focusing?Math.max(1.15,(Math.max(extent.y*1.3,extent.x/Math.max(.35,aspect))/(2*tan)+extent.z*.4)*1.45):fullDistance;
 // Approach from the front, away from neighbours, so a large car cannot hide a small bag.
 const side=focusing&&center.x<allCenter.x?-.32:.48,angle=side+Math.sin(time*.075)*(focusing?.10:.20);
 const position=center.clone().add(new THREE.Vector3(Math.sin(angle)*distance,Math.max(extent.y*.60,distance*.27),Math.cos(angle)*distance));
 const target=center.clone();target.y=Math.max(.15,center.y*.85);target.x+=Math.sin(time*.045)*Math.min(.2,extent.x*.04);
 return {position,target,distance,fullDistance,allCenter};
}
