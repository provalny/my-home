import * as THREE from 'three';
import {box,at,mat,rng} from './kit.js';
const palette=['#8298ae','#c29d7d','#889b89','#b19ba9','#c5b99d','#586d80'];
const seedFor=text=>[...String(text)].reduce((hash,c)=>(Math.imul(hash,31)+c.charCodeAt(0))>>>0,7);
// Decorative objects illustrate the user's estimate; they are never inventory items.
export function buildStorageClutter({nodeId,fill},width,height,depth){
 const group=new THREE.Group();group.userData.storageClutter=true;
 if(!Number.isFinite(fill)||fill<=0||width<.06||height<.04||depth<.07)return group;
 const fraction=Math.min(100,fill)/100,columns=Math.min(4,Math.max(1,Math.floor(width/.18))),rows=depth>.32?2:1,capacity=columns*rows,count=Math.ceil(fraction*capacity);
 const random=rng(seedFor(nodeId)),cw=width/columns,cd=depth/rows;
 for(let i=0;i<count;i++){
  const object=new THREE.Group(),color=palette[Math.floor(random()*palette.length)],type=Math.floor(random()*4),w=cw*(.72+random()*.16),d=cd*(.67+random()*.18),h=Math.min(height*.82,Math.max(.025,height*(.25+fraction*.48)));
  const x=-width/2+cw*(i%columns+.5),z=depth/2-cd*(Math.floor(i/columns)+.5);
  const part=(pw,ph,pd,m,px=0,py=0,pz=0)=>object.add(at(box(pw,ph,pd,m,{r:.008}),px,py,pz));
  if(type===0){part(w,h,d,mat(color));part(w*.55,Math.min(.012,h*.12),d*.99,mat('#d5c7ac'),0,h*.72);}
  else if(type===1){for(let layer=0;layer<3;layer++)part(w,h/3*.92,d,mat(palette[(palette.indexOf(color)+layer)%palette.length]),(layer%2)*w*.025,layer*h/3);}
  else if(type===2){for(let j=0;j<3;j++){const bh=h*(.75+j*.1);part(w/3*.9,bh,d*.85,mat(palette[(palette.indexOf(color)+j)%palette.length]),(j-1)*w/3);}}
  else{part(w,h*.9,d,mat(color));part(w*1.03,h*.10,d*1.03,mat('#d4cabb'),0,h*.9);part(w*.3,h*.07,.004,mat('#5c6672'),0,h*.55,d/2+.002);}
  object.position.set(x,0,z);object.userData.clutterProp=true;group.add(object);
 }
 return group;
}
export function decorateStorageInterior(model){
 const groups=[];model.root.updateMatrixWorld(true);
 for(const slot of model.contentSlots||[]){
  const group=buildStorageClutter(slot.zone,slot.width,slot.height,slot.depth);if(!group.children.length)continue;
  group.position.set(slot.centerX,slot.baseY,slot.frontZ-slot.depth/2);model.root.add(group);model.root.updateMatrixWorld(true);
  if(slot.parent&&slot.parent!==model.root)slot.parent.attach(group);groups.push(group);
 }
 const original=model.animate;model.animate=progress=>{original(progress);for(const group of groups)group.visible=progress>0;};model.animate(0);model.clutter=groups;return model;
}
