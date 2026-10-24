import * as THREE from 'three';
import { box, cyl, mat, at } from './kit.js';
import { extraDimensions } from './furniture-info.js';

const part=(g,w,h,d,m,x=0,y=0,z=0)=>{const mesh=at(box(w,h,d,m,{r:.006}),x,y,z);g.add(mesh);return mesh;};
const dark=()=>mat('#161b25',{metal:.4,rough:.45});
const metal=()=>mat('#9ca6b7',{metal:.7,rough:.3});
function ring(g,r,t,color,x,y,z){
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,t,8,40),mat(color,{emissive:color,emissiveIntensity:2}));
  mesh.position.set(x,y,z);g.add(mesh);return mesh;
}
function pcCase(item){
  const g=new THREE.Group(),shell=mat(item.color||'#202532',{metal:.5,rough:.4});
  part(g,.24,.025,.46,shell,0,.025);part(g,.24,.018,.46,shell,0,.462);
  part(g,.018,.43,.46,shell,.111,.04);part(g,.24,.43,.018,shell,0,.04,-.221);
  for(const z of [-.219,.219])part(g,.014,.43,.018,shell,-.113,.04,z);
  const glass=new THREE.MeshPhysicalMaterial({color:'#a3cbe5',transparent:true,opacity:.16,roughness:.1,metalness:.1,depthWrite:false,side:THREE.DoubleSide});
  const panel=part(g,.004,.405,.412,glass,-.122,.05,0);panel.userData.sidePanel=true;
  // The front grille leaves the luminous fan rings exposed.
  for(const x of [-.11,.11])part(g,.02,.42,.02,shell,x,.043,.22);
  const board=mat('#253b3c',{rough:.6});part(g,.012,.29,.29,board,.094,.15,-.035);
  part(g,.18,.065,.40,dark(),0,.05,-.01); // power supply shroud
  part(g,.15,.04,.26,metal(),0,.20,-.025); // GPU
  for(const z of [-.11,-.08])part(g,.022,.14,.012,mat('#66768c'),.067,.28,z);
  const glow=mat('#56d7ff',{emissive:'#56d7ff',emissiveIntensity:2});
  part(g,.006,.29,.008,glow,-.10,.15,-.19);
  for(const [y,color]of [[.16,'#51d9ff'],[.29,'#9d7aff'],[.42,'#ec78d5']]){
    ring(g,.046,.006,color,0,y,.226);
    const hub=at(cyl(.014,.014,.009,dark(),16),0,y,.225);hub.rotation.x=Math.PI/2;g.add(hub);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const blade=part(g,.014,.032,.006,metal(),Math.cos(a)*.023,y-.016+Math.sin(a)*.023,.224);blade.rotation.z=a;}
  }
  const cooler=ring(g,.045,.006,'#67e0ff',-.073,.35,.035);cooler.rotation.y=Math.PI/2;
  part(g,.025,.006,.025,glow,.06,.481,.15);
  const light=new THREE.PointLight('#6acbff',.35,.8,2);light.position.set(-.025,.32,.04);g.add(light);
  for(const x of [-.08,.08])for(const z of [-.17,.17])part(g,.035,.025,.04,dark(),x,0,z);
  g.scale.x=-1; // Put the glass panel on the side visible from the default camera.
  return g;
}
function macBook(item){
  const g=new THREE.Group(),silver=mat(item.color||'#b7bec8',{metal:.8,rough:.3});
  part(g,.31,.013,.215,silver,0,0,.012);
  part(g,.272,.002,.082,dark(),0,.014,-.026);
  for(let row=0;row<4;row++)for(let col=0;col<12;col++)part(g,.017,.001,.013,mat('#647080'),-.123+col*.022,.016,-.056+row*.019);
  part(g,.105,.001,.065,mat('#929ba8',{metal:.6}),0,.014,.061);
  const lid=new THREE.Group();lid.position.set(0,.013,-.09);lid.rotation.x=-.17;g.add(lid);
  part(lid,.31,.202,.008,silver,0,0,0);
  part(lid,.294,.183,.002,dark(),0,.009,.005);
  part(lid,.282,.168,.001,mat('#356780',{emissive:'#277ea0',emissiveIntensity:.45}),0,.015,.0065);
  part(lid,.05,.006,.002,dark(),0,.185,.008);
  return g;
}
function simCockpit(item){
  const g=new THREE.Group(),frame=mat(item.color||'#252b35',{metal:.65,rough:.4}),seat=mat('#262833',{rough:1}),red=mat('#9c3e48',{rough:.9});
  for(const x of [-.30,.30])part(g,.065,.075,1.6,frame,x,0,0);
  for(const z of [-.66,.05,.68])part(g,.66,.065,.06,frame,0,.03,z);
  part(g,.43,.13,.49,seat,0,.27,-.40);
  const back=part(g,.43,.64,.12,seat,0,.40,-.64);back.rotation.x=-.14;
  for(const x of [-.22,.22]){part(g,.075,.22,.49,red,x,.31,-.4);part(g,.075,.43,.12,red,x,.51,-.60);}
  part(g,.27,.15,.10,seat,0,.91,-.67);
  for(const x of [-.29,.29])part(g,.055,.65,.06,frame,x,.075,.10);
  part(g,.64,.035,.23,metal(),0,.72,.14);
  part(g,.20,.13,.22,dark(),0,.755,.15); // wheel base
  const wheel=new THREE.Mesh(new THREE.TorusGeometry(.15,.018,10,48),dark());wheel.position.set(0,.86,-.025);wheel.rotation.x=-.22;g.add(wheel);
  part(g,.25,.027,.03,metal(),0,.84,-.025);part(g,.04,.13,.03,metal(),0,.74,-.025);
  part(g,.13,.03,.19,frame,.325,.53,-.06);
  g.add(at(cyl(.013,.013,.15,metal(),12),.325,.56,-.06));
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.026,16,12),dark());knob.position.set(.325,.71,-.06);g.add(knob);
  const deck=part(g,.48,.035,.30,metal(),0,.12,.58);deck.rotation.x=.18;
  for(const x of [-.15,0,.15]){const pedal=part(g,.085,.15,.028,dark(),x,.15,.61);pedal.rotation.x=-.32;}
  // A real storage box below the seat, separate from the computer hardware.
  part(g,.36,.17,.34,frame,0,.085,-.40);
  const lid=part(g,.37,.014,.35,metal(),0,.255,-.40);lid.userData.storageLid=true;
  part(g,.09,.018,.014,dark(),0,.205,-.222);
  return g;
}
function simCockpitTriple(item){
  const g=new THREE.Group(),base=simCockpit(item),bounds=new THREE.Box3().setFromObject(base),size=bounds.getSize(new THREE.Vector3());
  base.scale.set(.78/size.x,1.08/size.y,1.6/size.z);g.add(base);
  const steel=dark();
  for(const x of [-.34,.34]){part(g,.045,1.17,.045,steel,x,0,.42);part(g,.11,.04,.45,steel,x,0,.43);}
  part(g,1.4,.045,.045,steel,0,1.11,.39);
  for(const [x,z,angle]of [[0,.46,0],[-.60,.30,-.50],[.60,.30,.50]]){
    const screen=new THREE.Group();screen.position.set(x,1.01,z);screen.rotation.y=angle;screen.userData.monitor=true;g.add(screen);
    part(screen,.65,.38,.035,steel,0,0,0);
    const display=mat('#315c73',{emissive:'#315c73',emissiveIntensity:.4});
    part(screen,.619,.345,.004,display,0,.017,-.02);
    part(screen,.619,.10,.005,mat('#536d57',{emissive:'#314a36',emissiveIntensity:.2}),0,.017,-.024);
    part(screen,.22,.12,.006,mat('#464c56'),0,.017,-.029);
    for(const sx of [-1,1]){const stripe=part(screen,.009,.12,.007,mat('#e9ded0'),sx*.12,.017,-.032);stripe.rotation.z=sx*.2;}
    part(screen,.035,.024,.008,mat('#a0a9b7'),0,-.005,-.02);
  }
  return g;
}
function printerMechanism(g,{open=false}={}){
  const frame=mat(open?'#eeeeea':'#303741',{metal:.35,rough:.5});
  part(g,.46,.065,.46,frame,0,.015,0);
  for(const x of [-.18,.18]){part(g,.025,.40,.035,frame,x,.07,-.13);g.add(at(cyl(.004,.004,.37,metal(),10),x,.08,-.105));}
  part(g,.39,.025,.035,frame,0,.46,-.13);
  part(g,.35,.018,.33,metal(),0,.135,.01);
  part(g,.32,.006,.30,mat('#383e43'),0,.154,.01);
  part(g,.39,.017,.022,metal(),0,.33,-.03);
  part(g,.07,.07,.065,frame,.035,.292,-.03);
  const nozzle=at(cyl(.010,.003,.023,mat('#bfa36e',{metal:.7}),12),.035,.27,-.025);g.add(nozzle);
  // A small printed part makes the build plate easy to recognise.
  part(g,.075,.08,.075,mat('#5ca9b0'),.035,.16,.01);
  part(g,.11,.035,.008,dark(),.105,.04,.235);
  part(g,.088,.023,.004,mat('#6abacb',{emissive:'#6abacb',emissiveIntensity:.5}),.105,.046,.241);
  if(open){
    const spool=new THREE.Mesh(new THREE.TorusGeometry(.047,.016,10,32),mat('#b7bcc3'));spool.position.set(-.08,.526,-.13);g.add(spool);
    part(g,.018,.05,.025,frame,-.08,.475,-.13);
  }
}
function printer3dEnclosed(){
  const g=new THREE.Group(),shell=mat('#181b22',{metal:.35,rough:.4});
  printerMechanism(g);
  part(g,.5,.025,.5,shell,0,0);part(g,.5,.025,.5,shell,0,.525);
  part(g,.5,.50,.018,shell,0,.025,-.241);
  for(const x of [-.241,.241]){
    part(g,.018,.50,.5,shell,x,.025);
    part(g,.018,.50,.023,shell,x,.025,.242);
  }
  const glass=new THREE.MeshPhysicalMaterial({color:'#99b9ce',transparent:true,opacity:.19,roughness:.12,depthWrite:false,side:THREE.DoubleSide});
  const door=part(g,.455,.435,.005,glass,0,.085,.25);door.userData.printerEnclosure=true;
  part(g,.018,.12,.025,metal(),.192,.23,.26);
  const light=mat('#bbddeb',{emissive:'#8fcfef',emissiveIntensity:.8});part(g,.36,.008,.012,light,0,.50,-.18);
  return g;
}
function printer3dOpen(){const g=new THREE.Group();printerMechanism(g,{open:true});return g;}
function printerCabinet(item){
  const g=new THREE.Group(),wood=mat(item.color||'#c8b18f',{rough:.75});
  part(g,.5,.035,.5,wood,0,.725);
  part(g,.47,.655,.46,wood,0,.07,0);
  const front=mat('#d9cbb6',{rough:.7});part(g,.44,.61,.014,front,0,.09,.238);
  part(g,.013,.12,.018,metal(),.16,.34,.235);
  for(const x of [-.19,.19])for(const z of [-.18,.18])part(g,.035,.07,.035,dark(),x,0,z);
  return g;
}

export const EQUIPMENT_BUILDERS=Object.fromEntries(Object.entries({pcCase,macBook,simCockpit,simCockpitTriple,printer3dEnclosed,printer3dOpen,printerCabinet}).map(([type,make])=>[type,item=>{
  const inner=make(item),bounds=new THREE.Box3().setFromObject(inner),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  inner.position.set(-center.x,-bounds.min.y,-center.z);
  const root=new THREE.Group();root.add(inner);const dims=extraDimensions({...item,type});root.scale.set(dims[0]/size.x,dims[1]/size.y,dims[2]/size.z);return root;
}]));
