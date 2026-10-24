import * as THREE from 'three';
import {box,at,mat} from './kit.js';
import {extraDimensions} from './furniture-info.js';

export const parrotCount=shape=>Number(shape.parrotCount)===2?2:1;
const perches=[[-.16,.26,.065],[.16,.46,-.065]];
// Absolute time makes playback independent of frame rate, saves and previews.
export function parrotState(index,time){
 const t=Math.max(0,Number.isFinite(time)?time:0),shifted=t+index*1.85,cycle=Math.floor(shifted/5),phase=shifted%5;
 const jump=Math.max(0,Math.min(1,(phase-4.3)/.7)),from=(cycle+index)%2,to=1-from,a=perches[from],b=perches[to];
 const voiceTime=t+index*3.7-2,episode=Math.floor(voiceTime/9),speaking=t>0&&voiceTime>=0&&voiceTime%9<1.6;
 return {position:a.map((value,i)=>(value+(b[i]-value)*jump+(i===1?Math.sin(jump*Math.PI)*.11:0))*(i===0&&index===1?-1:1)),jump,from,to,speech:speaking?(episode%11===10?'swear':'music'):null};
}
function speechSprite(text){
 const material=new THREE.SpriteMaterial({color:'#ffffff',depthWrite:false,toneMapped:false});
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=112;const c=canvas.getContext('2d');
  c.fillStyle='#fff5db';c.beginPath();c.roundRect(3,3,250,96,26);c.fill();c.beginPath();c.moveTo(88,93);c.lineTo(109,110);c.lineTo(124,93);c.fill();
  c.fillStyle='#2a3749';c.font='bold 49px -apple-system, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,128,53);
  material.map=new THREE.CanvasTexture(canvas);material.map.colorSpace=THREE.SRGBColorSpace;
 }
 const sprite=new THREE.Sprite(material);sprite.visible=false;sprite.scale.set(0,0,0);sprite.position.set(0,.5,0);return sprite;
}
function bird(index){
 const root=new THREE.Group();root.userData.parrotIndex=index;
 const green=index===0,body=mat(green?'#69ad40':'#63b7df'),head=mat(green?'#e5dc54':'#e6f2ee'),wing=mat(green?'#357e43':'#3480b5'),black=mat('#1b2931');
 const oval=(r,s,m,p)=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),m);mesh.scale.set(...s);mesh.position.set(...p);root.add(mesh);return mesh;};
 oval(1,[.035,.064,.035],body,[0,.078,0]);oval(1,[.033,.034,.031],head,[0,.145,.014]);
 for(const side of [-1,1]){
  oval(1,[.013,.046,.025],wing,[side*.03,.078,-.008]);
  oval(1,[.006,.007,.004],mat('#f6f4da'),[side*.027,.15,.031]);oval(1,[.003,.004,.003],black,[side*.029,.15,.034]);
  root.add(at(box(.019,.008,.027,mat('#c7a087'),{r:.002}),side*.014,.003,.009));
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.01,.10,4),wing);tail.rotation.x=-.43;tail.rotation.z=Math.PI;tail.position.set(side*.008,.011,-.038);root.add(tail);
 }
 const beak=new THREE.Mesh(new THREE.ConeGeometry(.012,.022,8),mat('#e1ad61'));beak.rotation.x=Math.PI/2;beak.position.set(0,.136,.048);root.add(beak);
 root.traverse(o=>{if(o.isMesh)o.userData.dynamicFurniture=true;});
 return root;
}
export function buildParrotCage(shape){
 const root=new THREE.Group(),inner=new THREE.Group();root.add(inner);
 const metal=mat('#8e9da3',{metal:.7,rough:.4}),tray=mat(shape.color||'#526b72'),wood=mat('#bd9666'),food=mat('#d6c29a');
 const part=(w,h,d,x,y,z,m=metal)=>inner.add(at(box(w,h,d,m,{r:.003}),x,y,z));
 part(.64,.055,.45,0,0,0,tray);part(.59,.008,.40,0,.055,0,mat('#ddd4ba'));
 for(const y of [.06,.69]){part(.61,.014,.012,0,y,.205);part(.61,.014,.012,0,y,-.205);for(const x of [-.30,.30])part(.012,.014,.41,x,y,0);}
 const bars=[];for(let i=0;i<=14;i++)for(const z of [-.205,.205])bars.push([-.30+i*.60/14,z]);
 for(let i=1;i<10;i++)for(const x of [-.30,.30])bars.push([x,-.205+i*.41/10]);
 const grid=new THREE.InstancedMesh(new THREE.CylinderGeometry(.0022,.0022,.63,6),metal,bars.length),matrix=new THREE.Matrix4();
 bars.forEach(([x,z],i)=>{matrix.makeTranslation(x,.375,z);grid.setMatrixAt(i,matrix);});inner.add(grid);
 // Flat wire roof leaves the birds visible from above as well as the front.
 for(let i=0;i<=10;i++)part(.004,.006,.41,-.30+i*.06,.71,0);
 for(const z of [-.205,.205])part(.61,.008,.01,0,.71,z);
 const handle=new THREE.Mesh(new THREE.TorusGeometry(.044,.006,6,24,Math.PI),metal);handle.position.set(0,.77,0);inner.add(handle);part(.11,.01,.02,0,.76,0);
 // A small front door and latch, without filling the bars with an opaque panel.
 for(const x of [-.105,.105])part(.006,.27,.006,x,.20,.210);
 for(const y of [.20,.47])part(.216,.006,.006,0,y,.210);part(.035,.008,.016,.10,.33,.213);
 for(const [,y,z]of perches){const perch=new THREE.Mesh(new THREE.CylinderGeometry(.010,.010,.58,12),wood);perch.rotation.z=Math.PI/2;perch.position.set(0,y-.01,z);inner.add(perch);}
 for(const x of [-.23,.23]){const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.042,.032,.04,16),tray);bowl.position.set(x,.14,.14);inner.add(bowl);const filling=new THREE.Mesh(new THREE.CircleGeometry(.035,16),x<0?food:mat('#79bbd0'));filling.rotation.x=-Math.PI/2;filling.position.set(x,.161,.14);inner.add(filling);}
 const birds=Array.from({length:parrotCount(shape)},(_,i)=>{const parrot=bird(i),music=speechSprite('♪ ♫'),swear=speechSprite('%@?$');music.userData.speech='music';swear.userData.speech='swear';inner.add(parrot,music,swear);return {parrot,music,swear};});
 root.userData.parrotCount=birds.length;
 root.userData.furnitureAnimate=time=>birds.forEach(({parrot,music,swear},index)=>{
  const state=parrotState(index,time);parrot.position.set(...state.position);parrot.rotation.y=state.to===1?.5:-.5;parrot.rotation.x=-Math.sin(state.jump*Math.PI)*.18;
  for(const sprite of [music,swear]){sprite.visible=state.speech===sprite.userData.speech;sprite.scale.set(sprite.visible?.22:0,sprite.visible?.10:0,1);sprite.position.set(state.position[0],state.position[1]+.235,state.position[2]+.055);}
 });
 root.userData.furnitureAnimate(0);
 const [w,h,d]=extraDimensions(shape);root.scale.set(w/.64,h/.82,d/.45);
 return root;
}
