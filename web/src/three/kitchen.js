import * as THREE from 'three';
import { box, cyl, at } from './kit.js';
import { kitchenModules, KITCHEN_MODULE_TYPES } from '../inventory/ikea-storage.js';
import { buildKitchenAppliance } from './kitchen-appliance.js';

// The closed plan and the opened kitchen use this exact same module layout.
export function buildKitchen(shape,{zones=[],moduleKey=null}={}) {
  const spec=kitchenModules(shape),root=new THREE.Group(),hits=[],labels=[],doors=[],drawers=[],appliances=[],contentSlots=[];let focusRoot=null;
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
    g.userData.moduleType=m.type;
    if(moduleKey===m.key)focusRoot=g;
    if(!KITCHEN_MODULE_TYPES[m.type].storage){const appliance=buildKitchenAppliance(m);g.add(appliance.root);appliances.push({key:m.key,appliance});}
    else{
    panel(m.width,m.height,t,0,0,-m.depth/2,back,g);
    panel(t,m.height,m.depth,-m.width/2+t/2,0,0,body,g);panel(t,m.height,m.depth,m.width/2-t/2,0,0,body,g);
    panel(m.width,t,m.depth,0,0,0,body,g);panel(m.width,t,m.depth,0,m.height-t,0,body,g);
    if(moduleKey!==m.key)for(let i=1;i<m.shelves;i++)panel(m.width-2*t,t,m.depth-t,0,m.height*i/m.shelves,-t/2,body,g);
    const pivot=new THREE.Group();pivot.position.set(-m.width/2,0,m.depth/2+t);g.add(pivot);
    if(m.type==='dishDrainer'){
      const glass=new THREE.MeshStandardMaterial({color:'#bfd3d5',transparent:true,opacity:.2,roughness:.2,depthWrite:false});
      for(const x of [t*1.5,m.width-t*1.5])panel(t*3,m.height-.006,t,x,0,0,body,pivot);
      for(const y of [0,m.height-t*3])panel(m.width,t*3,t,m.width/2,y,0,body,pivot);
      panel(m.width-t*6,m.height-t*6,.005,m.width/2,t*3,0,glass,pivot);
      for(const y of [m.height*.18,m.height*.58]){panel(m.width-4*t,.008,m.depth*.8,0,y-.03,0,metal,g);for(let i=0;i<9;i++)panel(.005,.008,m.depth*.8,(i/8-.5)*(m.width-5*t),y,0,metal,g);for(let i=0;i<4;i++){const radius=Math.min(m.width*.09,m.height*.12),plate=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.009,24),body);plate.rotation.x=Math.PI/2;plate.position.set((i-1.5)*m.width*.2,y+radius,m.depth*.08);g.add(plate);}}
    }else panel(m.width-.006,m.height-.006,t,(m.width-.006)/2,0,0,body,pivot);
    panel(.012,.16,.03,m.width-.055,m.height*.46,t,metal,pivot);doors.push({pivot,key:m.key});
    }
    const moduleZones=moduleKey===m.key?zones:!moduleKey?zones.filter(z=>z.moduleKey===m.key):[];
    const edges=new Set();
    for(const z of moduleZones){const [x,y,w,h]=z.rect||[0,0,1,1],local=moduleKey?{x,y,w,h}:{x:0,y:0,w:1,h:1};
      const zw=(m.width-2*t)*local.w,zh=(m.height-2*t)*local.h,cx=-m.width/2+t+(local.x+local.w/2)*(m.width-2*t),cy=t+(1-local.y-local.h/2)*(m.height-2*t);
      if(moduleKey){for(const [axis,start,end] of [['x',local.x,local.y],['y',local.y+local.h,local.x]]){const key=[axis,start,end,axis==='x'?local.h:local.w].join(':');if(edges.has(key))continue;edges.add(key);
        if(axis==='x'&&start>0)panel(t,zh,m.depth-t,-m.width/2+t+start*(m.width-2*t),cy-zh/2,-t/2,body,g);
        if(axis==='y'&&start<.999)panel(zw,t,m.depth-t,cx,t+(1-start)*(m.height-2*t),-t/2,body,g);
      }}
      const tint=new THREE.MeshBasicMaterial({color:'#8ec5ff',transparent:true,opacity:.015,depthWrite:false,side:THREE.DoubleSide});
      const hit=panel(zw,zh,.008,cx,cy-zh/2,m.depth/2+.01,tint,g);hit.userData={kind:'section',id:z.nodeId};hits.push(hit);
      const anchor=new THREE.Object3D();anchor.position.set(cx,cy,m.depth/2+.045);g.add(anchor);labels.push({nodeId:z.nodeId,name:z.name,kind:z.kind,moduleKey:moduleKey?null:m.key,anchor,width:zw,height:zh});
      let contentParent=g;
      if(z.kind==='drawer'){const tray=new THREE.Group();tray.position.set(cx,cy-zh/2,0);g.add(tray);panel(zw-t,t,m.depth*.82,0,0,0,body,tray);panel(zw-t,zh*.65,t,0,0,m.depth*.41,body,tray);for(const side of [-1,1])panel(t,zh*.45,m.depth*.82,side*(zw/2-t),0,0,body,tray);panel(Math.min(.15,zw*.4),.012,.025,0,zh*.35,m.depth*.44,metal,tray);drawers.push({tray,depth:m.depth});contentParent=tray;}
      if(moduleKey===m.key&&m.type==='cabinet')contentSlots.push({zone:z,width:zw-2*t,height:zh-2*t,depth:m.depth-4*t,centerX:m.x+cx,baseY:m.y+cy-zh/2+t,frontZ:m.z+m.depth/2-2*t,parent:contentParent});
    }
  }
  if(spec.filler>.002)panel(spec.filler,.8*spec.scaleY,spec.depth,0,.08*spec.scaleY,0); // narrow filler kept outside cabinet interiors below
  if(spec.filler>.002){const filler=root.children[root.children.length-1];filler.position.x=-spec.width/2+spec.filler/2;}
  panel(spec.width,.08*spec.scaleY,spec.depth-.04,0,0,0,back);
  panel(spec.width+.02,.04*spec.scaleY,spec.depth+.03,0,.88*spec.scaleY,.005,stone);
  const hobW=Math.min(.58,spec.width*.22),sinkW=Math.min(.5,spec.width*.22),base=spec.modules.filter(m=>m.tier==='base'),stoves=base.filter(m=>m.type==='stove'),atX=x=>base.find(m=>x>=m.x-m.width/2-.001&&x<=m.x+m.width/2+.001);
  const hob=(x,width)=>{panel(width,.012,.5*spec.scaleZ,x,.92*spec.scaleY,0,dark);for(const sx of [-1,1])for(const sz of [-1,1]){const ring=new THREE.Mesh(new THREE.TorusGeometry(Math.min(.07,width*.17),.006,8,24),metal);ring.rotation.x=-Math.PI/2;ring.position.set(x+sx*width*.25,.934*spec.scaleY,sz*.13*spec.scaleZ);root.add(ring);}};
  for(const m of stoves)hob(m.x,m.width*.9);
  if(spec.width>=.8){if(!stoves.length&&atX(-spec.width/4)?.type==='cabinet')panel(hobW,.012,.5*spec.scaleZ,-spec.width/4,.92*spec.scaleY,0,dark);if(atX(spec.width/4)?.type==='cabinet'){panel(sinkW,.012,.38*spec.scaleZ,spec.width/4,.92*spec.scaleY,.02,metal);const tap=at(cyl(.015,.015,.24*spec.scaleY,metal,10),spec.width/4,.92*spec.scaleY,-.22*spec.scaleZ);root.add(tap);}}
  const animate=p=>{const v=THREE.MathUtils.smoothstep(p,0,1);doors.forEach(({pivot,key})=>pivot.rotation.y=key===moduleKey?-Math.PI*.59*v:0);drawers.forEach(({tray,depth})=>tray.position.z=depth*.3*v);appliances.forEach(({key,appliance})=>appliance.animate(key===moduleKey?p:0));};
  const highlight=id=>hits.forEach(hit=>hit.material.opacity=hit.userData.id===id?.18:.015);
  return {root,focusRoot:focusRoot||root,hits,labels,contentSlots,dimensions:[spec.width,spec.height,spec.depth],animate,highlight};
}
