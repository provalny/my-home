import * as THREE from 'three';
import { box, cyl, at } from './kit.js';
import { kitchenModules } from '../inventory/ikea-storage.js';

// The closed plan and the opened kitchen use this exact same module layout.
export function buildKitchen(shape,{zones=[],moduleKey=null}={}) {
  const spec=kitchenModules(shape),root=new THREE.Group(),hits=[],labels=[],doors=[],drawers=[];
  const body=new THREE.MeshStandardMaterial({color:shape.color||'#e4e1da',roughness:.66});
  const back=new THREE.MeshStandardMaterial({color:'#b9b8ae',roughness:.85});
  const stone=new THREE.MeshStandardMaterial({color:'#33363d',roughness:.35});
  const metal=new THREE.MeshStandardMaterial({color:'#9a9fa8',roughness:.3,metalness:.8});
  const dark=new THREE.MeshStandardMaterial({color:'#10141a',roughness:.22});
  function panel(w,h,d,x,y,z,m=body,parent=root){const p=at(box(Math.max(.004,w),Math.max(.004,h),Math.max(.004,d),m,{r:.003}),x,y,z);parent.add(p);return p;}
  const t=.018;
  for(const m of spec.modules){
    const g=new THREE.Group();g.position.set(m.x,m.y,m.z);root.add(g);
    g.userData.kitchenModule=m.key;
    panel(m.width,m.height,t,0,0,-m.depth/2,back,g);
    panel(t,m.height,m.depth,-m.width/2+t/2,0,0,body,g);panel(t,m.height,m.depth,m.width/2-t/2,0,0,body,g);
    panel(m.width,t,m.depth,0,0,0,body,g);panel(m.width,t,m.depth,0,m.height-t,0,body,g);
    for(let i=1;i<3;i++)panel(m.width-2*t,t,m.depth-t,0,m.height*i/3,-t/2,body,g);
    const pivot=new THREE.Group();pivot.position.set(-m.width/2,0,m.depth/2+t);g.add(pivot);
    panel(m.width-.006,m.height-.006,t,(m.width-.006)/2,0,0,body,pivot);
    panel(.012,.16,.03,m.width-.055,m.height*.46,t,metal,pivot);doors.push(pivot);
    const moduleZones=moduleKey===m.key?zones:!moduleKey?zones.filter(z=>z.moduleKey===m.key):[];
    for(const z of moduleZones){const [x,y,w,h]=z.rect||[0,0,1,1],local=moduleKey?{x,y,w,h}:{x:0,y:0,w:1,h:1};
      const zw=(m.width-2*t)*local.w,zh=(m.height-2*t)*local.h,cx=-m.width/2+t+(local.x+local.w/2)*(m.width-2*t),cy=t+(1-local.y-local.h/2)*(m.height-2*t);
      const tint=new THREE.MeshBasicMaterial({color:'#8ec5ff',transparent:true,opacity:.015,depthWrite:false,side:THREE.DoubleSide});
      const hit=panel(zw,zh,.008,cx,cy-zh/2,m.depth/2+.01,tint,g);hit.userData={kind:'section',id:z.nodeId};hits.push(hit);
      const anchor=new THREE.Object3D();anchor.position.set(cx,cy,m.depth/2+.025);g.add(anchor);labels.push({nodeId:z.nodeId,name:z.name,kind:z.kind,anchor,width:zw,height:zh});
      if(z.kind==='drawer'){const tray=new THREE.Group();tray.position.set(cx,cy-zh/2,0);g.add(tray);panel(zw-t,t,m.depth*.82,0,0,0,body,tray);panel(zw-t,zh*.65,t,0,0,m.depth*.41,body,tray);for(const side of [-1,1])panel(t,zh*.45,m.depth*.82,side*(zw/2-t),0,0,body,tray);panel(Math.min(.15,zw*.4),.012,.025,0,zh*.35,m.depth*.44,metal,tray);drawers.push({tray,depth:m.depth});}
    }
  }
  if(spec.filler>.002)panel(spec.filler,.8*spec.scaleY,spec.depth,0,.08*spec.scaleY,0); // narrow filler kept outside cabinet interiors below
  if(spec.filler>.002){const filler=root.children[root.children.length-1];filler.position.x=-spec.width/2+spec.filler/2;}
  panel(spec.width,.08*spec.scaleY,spec.depth-.04,0,0,0,back);
  panel(spec.width+.02,.04*spec.scaleY,spec.depth+.03,0,.88*spec.scaleY,.005,stone);
  const hobW=Math.min(.58,spec.width*.22),sinkW=Math.min(.5,spec.width*.22);
  if(spec.width>=.8){panel(hobW,.012,.5*spec.scaleZ,-spec.width/4,.92*spec.scaleY,0,dark);panel(sinkW,.012,.38*spec.scaleZ,spec.width/4,.92*spec.scaleY,.02,metal);const tap=at(cyl(.015,.015,.24*spec.scaleY,metal,10),spec.width/4,.92*spec.scaleY,-.22*spec.scaleZ);root.add(tap);}
  const animate=p=>{const v=THREE.MathUtils.smoothstep(p,0,1);doors.forEach(door=>door.rotation.y=-Math.PI*.59*v);drawers.forEach(({tray,depth})=>tray.position.z=depth*.3*v);};
  const highlight=id=>hits.forEach(hit=>hit.material.opacity=hit.userData.id===id?.18:.015);
  return {root,hits,labels,dimensions:[spec.width,spec.height,spec.depth],animate,highlight};
}
