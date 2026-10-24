import * as THREE from 'three';
import {box,cyl,mat,at} from './kit.js';
import {extraDimensions} from './furniture-info.js';
const part=(g,w,h,d,m,x=0,y=0,z=0)=>{const o=at(box(w,h,d,m,{r:.008}),x,y,z);g.add(o);return o;};
const dark=()=>mat('#202530',{metal:.35,rough:.55});
const steel=()=>mat('#949eab',{metal:.7,rough:.35});
function officeChair(){
 const g=new THREE.Group(),fabric=mat('#444b57',{rough:1});
 g.add(at(cyl(.035,.045,.40,steel()),0,.09,0));
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5,arm=part(g,.045,.035,.30,dark(),0,.06,.14);arm.rotation.y=a;arm.position.set(Math.sin(a)*.14,.06,Math.cos(a)*.14);g.add(at(cyl(.035,.035,.045,dark(),12),Math.sin(a)*.28,.015,Math.cos(a)*.28));}
 part(g,.48,.07,.47,fabric,0,.44,0);
 const back=part(g,.44,.49,.065,fabric,0,.51,-.21);back.rotation.x=-.1;
 for(const x of [-.275,.275]){part(g,.025,.22,.04,steel(),x,.44,0);part(g,.065,.035,.25,dark(),x,.65,0);}
 return g;
}
function gamingDesktop(){
 const g=new THREE.Group(),base=dark(),blue=mat('#55c8ff',{emissive:'#328dff',emissiveIntensity:1.5}),pink=mat('#ff65ca',{emissive:'#ff36b0',emissiveIntensity:1.5});
 part(g,.8,.005,.35,base);part(g,.8,.003,.006,blue,0,.005,.172);part(g,.8,.003,.006,pink,0,.005,-.172);
 part(g,.006,.003,.35,blue,-.397,.005);part(g,.006,.003,.35,pink,.397,.005);
 part(g,.44,.019,.15,base,-.12,.007,-.01);
 for(let row=0;row<5;row++)for(let col=0;col<15;col++)part(g,.024,.008,.022,(col+row)%3?mat('#4a5262'):row%2?pink:blue,-.32+col*.028,.026,-.065+row*.026);
 part(g,.17,.007,.019,blue,-.12,.026,.067);
 const mouse=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),mat('#363e50'));mouse.scale.set(.034,.022,.06);mouse.position.set(.29,.022,0);g.add(mouse);
 part(g,.003,.007,.06,pink,.29,.033,-.006);return g;
}
function monitor(desktop=false){
 const g=new THREE.Group();
 part(g,desktop?.23:.45,.025,desktop?.20:.38,dark());
 part(g,.04,desktop?.17:.92,.045,steel(),0,.025,-.045);
 const y=desktop?.18:.94;
 part(g,.62,.36,.032,dark(),0,y,-.015);
 part(g,.587,.324,.003,mat('#456b95',{emissive:'#305b87',emissiveIntensity:.4}),0,y+.018,.003);
 part(g,.587,.075,.004,mat('#67999f',{emissive:'#43787d',emissiveIntensity:.25}),0,y+.018,.006);
 part(g,.06,.003,.004,mat('#8ca3ba'),0,y+.005,.007);return g;
}
function smallDesk(item){
 const g=new THREE.Group(),wood=mat(item.color||'#c8b18f');part(g,.60,.035,.45,wood,0,.715);
 for(const x of [-.26,.26])for(const z of [-.185,.185])part(g,.035,.715,.035,steel(),x,0,z);
 return g;
}
function neonPorsche(){
 const g=new THREE.Group();
 const tube=(points,color,r=.007)=>{const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,.014)),false,'centripetal');const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,80,r,8,false),mat(color,{emissive:color,emissiveIntensity:1.4}));g.add(mesh);};
 // Low sports-car silhouette, rounded roof, long bonnet and rear spoiler.
 tube([[-.57,.10],[-.59,.18],[-.52,.23],[-.30,.27],[-.18,.39],[.02,.43],[.22,.38],[.35,.28],[.53,.23],[.59,.16],[.58,.10]],'#1686ff');
 tube([[-.57,.10],[-.44,.08],[-.32,.075],[.31,.075],[.45,.08],[.58,.10]],'#ff168d');
 tube([[-.27,.275],[-.15,.375],[.02,.405],[.18,.36],[.28,.28],[-.27,.275]],'#ff168d',.005);
 tube([[-.56,.24],[-.56,.30],[-.43,.30]],'#1686ff',.005);
 for(const x of [-.36,.36]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.079,.006,8,48),mat('#ff168d',{emissive:'#ff168d',emissiveIntensity:1.4}));wheel.position.set(x,.09,.014);g.add(wheel);}
 for(const x of [-.45,.45]){const light=new THREE.PointLight(x<0?'#399bff':'#ff42b4',.45,1.8,2);light.position.set(x,.25,.08);g.add(light);}
 return g;
}
function ikeaFloorLamp(){
 const g=new THREE.Group(),white=mat('#f2eee6',{emissive:'#ffe4b8',emissiveIntensity:.65});
 g.add(at(cyl(.17,.18,.025,steel()),0,0,0));
 part(g,.045,1.52,.045,dark(),0,.025,0);
 part(g,.19,1.42,.19,white,0,.10,0);
 for(const y of [.10,.35,.60,.85,1.1,1.35,1.52])part(g,.195,.009,.195,mat('#c7bda9'),0,y,0);
 const light=new THREE.PointLight('#ffe3b1',.55,2.3,2);light.position.set(0,.8,0);g.add(light);return g;
}
function whiteSpeaker(){
 const g=new THREE.Group();part(g,.17,.27,.17,mat('#f0f0eb',{rough:.9}));
 for(const [y,r]of [[.10,.052],[.215,.022]]){const cone=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.008,32),mat('#c4cbd0'));cone.rotation.x=Math.PI/2;cone.position.set(0,y,.087);g.add(cone);}
 part(g,.012,.004,.004,mat('#80bbef',{emissive:'#80bbef'}),0,.018,.088);return g;
}
function bookcase(item,tall){
 const g=new THREE.Group(),h=tall?2.1:1.25,wood=mat(item.color||'#c7ad87'),count=tall?6:3;
 part(g,.8,h,.018,wood,0,0,-.15);
 for(const x of [-.389,.389])part(g,.022,h,.32,wood,x,0,0);
 for(let i=0;i<=count;i++){
 const y=i*(h-.025)/count;part(g,.8,.025,.32,wood,0,y,0);
 if(i<count)for(let j=0;j<7;j++){const bh=.17+(j%3)*.025;part(g,.035,bh,.19,mat(['#596e83','#ac6968','#c9b590','#6e8577'][j%4]),-.30+j*.065,y+.025,.015);}
 }
 return g;
}
const raw={officeChair,gamingDesktop,monitorStand:()=>monitor(false),smallDesk,neonPorsche,ikeaFloorLamp,whiteSpeaker,desktopMonitor:()=>monitor(true),bookcaseTall:item=>bookcase(item,true),bookcaseMedium:item=>bookcase(item,false)};
export const WORKSPACE_BUILDERS=Object.fromEntries(Object.entries(raw).map(([type,make])=>[type,item=>{
 const inner=make(item),bounds=new THREE.Box3().setFromObject(inner),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());inner.position.set(-center.x,-bounds.min.y,-center.z);
 const root=new THREE.Group();root.add(inner);const dims=extraDimensions({...item,type});root.scale.set(dims[0]/size.x,dims[1]/size.y,dims[2]/size.z);return root;
}]));
