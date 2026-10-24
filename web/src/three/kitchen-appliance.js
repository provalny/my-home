import * as THREE from 'three';
import { box, at, mat } from './kit.js';

// Built-in equipment fits the existing module footprint. The same geometry is
// used on the apartment plan and in the focused kitchen.
export function buildKitchenAppliance(m){
  const root=new THREE.Group(),w=m.width,h=m.height,d=m.depth,front=d/2,t=.018;
  root.userData.applianceType=m.type;
  const white=mat('#e5e7e7',{rough:.45}),steel=mat('#a4acb3',{rough:.32,metal:.7}),dark=mat('#17202a',{rough:.35}),glass=mat(m.type==='dryer'?'#4d4034':'#233f53',{rough:.2,metal:.25});
  const part=(pw,ph,pd,x,y,z,material=white,parent=root)=>{const p=at(box(Math.max(.004,pw),Math.max(.004,ph),Math.max(.004,pd),material,{r:.004}),x,y,z);parent.add(p);return p;};
  const disc=(radius,depth,x,y,z,material,parent=root)=>{const p=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,depth,32),material);p.rotation.x=Math.PI/2;p.position.set(x,y,z);parent.add(p);return p;};
  const ring=(radius,x,y,z,material,parent=root)=>{const p=new THREE.Mesh(new THREE.TorusGeometry(radius,.009,8,36),material);p.position.set(x,y,z);parent.add(p);return p;};
  let moving=null,axis='x',angle=Math.PI*.47;
  if(m.type==='hood'){
    part(w,.1*h,d,0,.04*h,0,steel);part(w*.86,.012,d*.8,0,.04*h-.012,0,dark);
    const canopy=new THREE.Mesh(new THREE.CylinderGeometry(.23,.5,.22,4),steel);canopy.rotation.y=Math.PI/4;canopy.scale.set(w/Math.SQRT1_2,h,d/Math.SQRT1_2);canopy.position.set(0,h*.25,0);root.add(canopy);
    part(w*.3,h*.52,d*.6,0,h*.37,-d*.1,steel);
    for(const x of [-w*.3,w*.3])disc(w*.045,.008,x,.085*h,front+.007,white);
    for(let i=0;i<4;i++)part(w*.035,.012,.008,(i-1.5)*w*.07,h*.12,front+.006,dark);
  }else{
    part(w,h,t,0,0,-d/2,steel);part(t,h,d,-w/2+t/2,0,0);part(t,h,d,w/2-t/2,0,0);part(w,t,d,0,0,0);part(w,t,d,0,h-t,0);
    if(m.type==='washingMachine'||m.type==='dryer'){
      const radius=Math.min(w*.31,h*.25),cy=h*.45;
      const face=new THREE.Shape();face.moveTo(-w/2,0);face.lineTo(w/2,0);face.lineTo(w/2,h);face.lineTo(-w/2,h);face.closePath();const hole=new THREE.Path();hole.absarc(0,cy,radius,0,Math.PI*2,true);face.holes.push(hole);
      const p=new THREE.Mesh(new THREE.ExtrudeGeometry(face,{depth:t,bevelEnabled:false,curveSegments:32}),white);p.position.z=front-t;root.add(p);
      disc(radius*.94,.014,0,cy,front-.06,dark);
      part(w*.92,h*.13,.012,0,h*.82,front+.007,steel);disc(w*.045,.02,-w*.07,h*.885,front+.025,dark);part(w*.24,h*.045,.015,w*.27,h*.86,front+.022,dark);
      part(w*.25,h*.075,.012,-w*.31,h*.845,front+.018,white);
      moving=new THREE.Group();moving.position.set(-radius,0,front+.028);root.add(moving);axis='y';angle=-Math.PI*.58;
      disc(radius,.025,radius,cy,0,steel,moving);disc(radius*.83,.029,radius,cy,.009,glass,moving);ring(radius*.89,radius,cy,.029,dark,moving);
      part(w*.035,h*.09,.025,radius*1.8,cy-h*.045,.035,white,moving);
      if(m.type==='dryer'){for(let i=0;i<5;i++)part(w*.7,.006,.008,0,h*.065+i*h*.025,front+.014,steel);}
      else part(w*.38,.005,.008,-w*.24,h*.85,front+.027,dark);
    }else{
      moving=new THREE.Group();moving.position.set(0,m.type==='stove'?h*.14:0,front);root.add(moving);
      const doorH=m.type==='stove'?h*.65:h*.93;
      part(w-.012,doorH,t,0,0,0,m.type==='stove'?steel:white,moving);
      if(m.type==='stove'){part(w,h*.21,t,0,h*.79,front-t/2,steel);part(w*.82,doorH*.73,.012,0,doorH*.1,t,dark,moving);part(w*.66,doorH*.52,.008,0,doorH*.18,t+.008,glass,moving);for(let i=0;i<4;i++)disc(w*.025,.018,(i-1.5)*w*.2,h*.9,front+.018,dark);}
      else{part(w*.95,h*.09,.012,0,doorH-h*.08,t,dark,moving);part(w*.2,h*.025,.008,w*.25,doorH-h*.05,t+.009,glass,moving);for(let i=0;i<4;i++)disc(w*.012,.012,-w*.33+i*w*.09,doorH-h*.04,t+.015,steel,moving);for(const y of [h*.25,h*.6]){for(let i=0;i<8;i++)part(.008,.01,d*.8,(i/7-.5)*w*.8,y,-d*.02,steel);part(w*.85,.012,.01,0,y,front-.06,steel);}}
      part(w*.65,.018,.035,0,doorH*.86,t+.014,steel,moving);
      part(w,h*.06,t,0,0,front,dark);
    }
  }
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return {root,animate(progress){if(moving)moving.rotation[axis]=angle*THREE.MathUtils.smoothstep(progress,0,1);}};
}
