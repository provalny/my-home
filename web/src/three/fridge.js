import * as THREE from 'three';
import { box, at } from './kit.js';
import { fridgeConfig, fridgeChambers } from '../inventory/fridge-layout.js';

// One shell, facade and chamber layout for the plan and every opened view.
export function buildFridge(shape={}, {zones=[],chamberKey=null}={}){
  const size=(v,f)=>Number.isFinite(v)&&v>0?v:f,w=size(shape.width,.7),h=size(shape.height,1.92),d=size(shape.depth,.68),t=Math.min(.025,w*.04,h*.025,d*.06);
  const config=fridgeConfig(shape),builtIn=config.installation==='builtIn',root=new THREE.Group(),hits=[],labels=[],doors=[],lights=[];
  root.userData.fridgeInstallation=config.installation;
  const exterior=new THREE.MeshStandardMaterial({color:shape.color||(builtIn?'#e4e1da':'#c5c9d0'),roughness:builtIn?.65:.35,metalness:builtIn?.05:.5});
  const lining=new THREE.MeshStandardMaterial({color:'#e9eff1',roughness:.65}),glass=new THREE.MeshStandardMaterial({color:'#b4d5df',transparent:true,opacity:.38,roughness:.2,depthWrite:false}),steel=new THREE.MeshStandardMaterial({color:'#929fa9',metalness:.65,roughness:.3});
  const part=(pw,ph,pd,x,y,z,material=lining,parent=root)=>{const p=at(box(Math.max(.003,pw),Math.max(.003,ph),Math.max(.003,pd),material,{r:.006}),x,y,z);p.castShadow=true;p.receiveShadow=true;parent.add(p);return p;};
  part(w,h,t,0,0,-d/2+t/2,exterior);part(t,h,d,-w/2+t/2,0,0,exterior);part(t,h,d,w/2-t/2,0,0,exterior);part(w,t,d,0,0,0,exterior);part(w,t,d,0,h-t,0,exterior);
  let focusRoot=null;
  for(const chamber of fridgeChambers(shape)){
    const [,y,,rh]=chamber.rect,bottom=t+(1-y-rh)*(h-2*t),height=rh*(h-2*t),innerW=w-2*t,innerD=d-2*t;
    const g=new THREE.Group();g.position.y=bottom;g.userData.fridgeChamber=chamber.key;root.add(g);if(chamberKey===chamber.key)focusRoot=g;
    part(innerW,height,t,0,0,-d/2+t,lining,g);part(t,height,innerD,-w/2+t*1.5,0,0,lining,g);part(t,height,innerD,w/2-t*1.5,0,0,lining,g);part(innerW,t,innerD,0,0,0,lining,g);part(innerW,t,innerD,0,height-t,0,lining,g);
    const shelves=chamber.key==='cooling'?Math.max(1,Math.min(4,Math.floor(height/.28))):chamber.key==='freezer'?Math.max(1,Math.min(3,Math.floor(height/.22))):1;
    for(let i=1;i<=shelves;i++){const sy=(height-t)*i/(shelves+1);part(innerW-t,.008,innerD*.85,0,sy,0,glass,g);if(chamber.key!=='cooling'){const trayH=Math.min(.13,height/(shelves+1)*.65);part(innerW-t*2,trayH,.012,0,sy-trayH,d*.34,glass,g);}}
    if(chamber.key==='cooling'){part(innerW-t*2,height*.12,.012,0,t,d*.34,glass,g);part(innerW-t*2,.008,innerD*.8,0,height*.12,0,glass,g);}
    const pivot=new THREE.Group();pivot.position.set(-w/2,0,d/2);g.add(pivot);pivot.userData.fridgeDoor=chamber.key;
    part(w-.006,height-.006,t,w/2,0,-t/2,exterior,pivot);part(innerW-t,height-t*2,t,w/2,t,-t*1.5,lining,pivot);
    if(builtIn)part(w*.4,.012,.012,w*.66,height*.8,t*.2,steel,pivot);
    else part(.018,Math.min(.35,height*.6),.035,w-.055,height*.2,t*.65,steel,pivot);
    if(chamber.key==='cooling')for(const sy of [height*.18,height*.53]){part(innerW*.82,.008,d*.14,w/2,sy,-d*.09,lining,pivot);part(innerW*.82,Math.min(.07,height*.12),.009,w/2,sy,-d*.15,glass,pivot);}
    doors.push({key:chamber.key,pivot});
    const led=new THREE.MeshStandardMaterial({color:'#f0faff',emissive:'#d8efff',emissiveIntensity:0,roughness:.3});part(.012,Math.max(.04,height*.7),.012,-innerW/2+t,height*.12,-d*.2,led,g);
    const light=new THREE.PointLight('#e7f4ff',0,Math.max(w,d)*1.7,0);light.position.set(-innerW*.25,height*.75,d*.05);light.castShadow=false;g.add(light);lights.push({key:chamber.key,light,led});
    const sectionZones=chamberKey===chamber.key?zones:!chamberKey?zones.filter(z=>z.fridgeChamber===chamber.key||!z.fridgeChamber&&z.rect[1]+z.rect[3]/2>=y&&z.rect[1]+z.rect[3]/2<y+rh):[];
    for(const zone of sectionZones){const [zx,zy,zw,zh]=zone.rect||[0,0,1,1],width=zw*(innerW-t),zoneH=zh*(height-t),cx=-innerW/2+t/2+(zx+zw/2)*(innerW-t),cy=(1-zy-zh/2)*(height-t)+t/2;
      const tint=new THREE.MeshBasicMaterial({color:'#8ec5ff',transparent:true,opacity:.015,depthWrite:false,side:THREE.DoubleSide});const hit=part(width,zoneH,.006,cx,cy-zoneH/2,d/2+.01,tint,g);hit.userData={kind:'section',id:zone.nodeId};hits.push(hit);
      const anchor=new THREE.Object3D();anchor.position.set(cx,cy,d/2+.035);g.add(anchor);labels.push({nodeId:zone.nodeId,name:zone.name,kind:zone.kind,anchor,width,height:zoneH});
    }
  }
  function animate(progress){const p=THREE.MathUtils.smoothstep(progress,0,1);for(const door of doors)door.pivot.rotation.y=door.key===chamberKey?-Math.PI*.61*p:0;for(const {key,light,led}of lights){light.intensity=key===chamberKey?p*.42:0;led.emissiveIntensity=key===chamberKey?p*.3:0;}}
  const highlight=id=>hits.forEach(hit=>{hit.material.opacity=hit.userData.id===id?.18:.015;});animate(0);
  return {root,focusRoot:focusRoot||root,hits,labels,doors,lights,dimensions:[w,h,d],animate,highlight};
}
