import * as THREE from 'three';
import {box,at,mat} from './kit.js';
import {extraDimensions} from './furniture-info.js';

// The same openings locate boards, inventory hit areas and decorative contents.
export function shelfFrame(shape){
 const [w,h,d]=extraDimensions(shape);
 if(shape.type==='kallaxShelf')return {w,h,d,columns:4,rows:4,left:-w/2+.04*w/1.47,top:h-(.0375-.018)*h/1.465,spanX:(1.47-.08+.018)*w/1.47,spanY:(1.465-.075+.018)*h/1.465,gapX:.018*w/1.47,gapY:.018*h/1.465};
 if(shape.type==='woodShelfLow')return {w,h,d,columns:1,rows:3,left:-w/2+.04*w/.89,top:1.19*h/1.2,spanX:w-.08*w/.89,spanY:1.11*h/1.2,gapX:0,gapY:.025*h/1.2};
 return {w,h,d,columns:1,rows:4,left:-w/2+.04*w/.89,top:1.72*h/1.79,spanX:w-.08*w/.89,spanY:1.64*h/1.79,gapX:0,gapY:.02*h/1.79};
}
export function shelfOpening(shape,rect){
 const f=shelfFrame(shape),[x,y,rw,rh]=rect,width=rw*f.spanX-f.gapX,baseY=f.top-(y+rh)*f.spanY+(shape.type==='kallaxShelf'?0:f.gapY);
 const height=shape.type==='woodShelfLow'?Math.min(rh*f.spanY-f.gapY,f.h-f.gapY-baseY):rh*f.spanY-f.gapY;
 return {width,height,depth:f.d-.02*f.d/(shape.type==='kallaxShelf'?.39:.30),centerX:f.left+x*f.spanX+width/2,baseY,frontZ:f.d/2-.01*f.d/(shape.type==='kallaxShelf'?.39:.30)};
}
function makeShelf(shape){
 const root=new THREE.Group(),f=shelfFrame(shape),wood=mat(shape.color||(shape.type==='kallaxShelf'?'#eeeae1':'#d5b78b'),{rough:.85});
 const part=(w,h,d,x,y,z=0,m=wood)=>root.add(at(box(w,h,d,m,{r:.003}),x,y,z));
 if(shape.type==='kallaxShelf'){
  const tx=.04*f.w/1.47,ty=.0375*f.h/1.465;
  for(const x of [-f.w/2+tx/2,f.w/2-tx/2])part(tx,f.h,f.d,x,0);
  for(const y of [0,f.h-ty])part(f.w-2*tx,ty,f.d,0,y);
  for(let i=1;i<4;i++){
   part(f.gapX,f.h-2*ty,f.d,f.left+i*f.spanX/4-f.gapX/2,ty);
   part(f.w-2*tx,f.gapY,f.d,0,f.top-i*f.spanY/4);
  }
 }else{
  const low=shape.type==='woodShelfLow',nominalH=low?1.2:1.79,px=.04*f.w/.89,pz=.04*f.d/.30,board=(low?.025:.02)*f.h/nominalH;
  for(const x of [-f.w/2+px/2,f.w/2-px/2])for(const z of [-f.d/2+pz/2,f.d/2-pz/2])part(px,low?f.h-board:f.h,pz,x,0,z);
  for(let i=0;i<(low?3:5);i++)part(f.w-2*px,board,f.d,0,(.08+i*(low?.37:.41))*f.h/nominalH);
  if(low){part(f.w,board,f.d,0,f.h-board);return root;}
  // Open pine side frames and a thin galvanised cross brace at the back.
  for(const x of [-f.w/2+px/2,f.w/2-px/2])for(const y of [.18,.90,1.61])part(px,.025*f.h/1.79,f.d-2*pz,x,y*f.h/1.79);
  const metal=mat('#a3a7a5',{metal:.7,rough:.4});
  for(const side of [-1,1]){
   const a=new THREE.Vector3(-f.w/2+px,.22*f.h/1.79,-f.d/2+pz/2),b=new THREE.Vector3(f.w/2-px,1.58*f.h/1.79,-f.d/2+pz/2);
   if(side<0)[a.y,b.y]=[b.y,a.y];
   const direction=b.clone().sub(a),brace=new THREE.Mesh(new THREE.CylinderGeometry(.003,.003,direction.length(),8),metal);
   brace.position.copy(a.add(b).multiplyScalar(.5));brace.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());root.add(brace);
  }
 }
 return root;
}
export const IKEA_SHELF_BUILDERS={kallaxShelf:makeShelf,ivarRack:makeShelf,woodShelfLow:makeShelf};
