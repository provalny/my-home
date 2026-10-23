import * as THREE from 'three';
import { box, cyl, mat, at } from './kit.js';
import { EXTRA_MODEL_INFO, extraDimensions } from './furniture-info.js';

const group=(...parts)=>{const g=new THREE.Group(),children=parts.flat().filter(Boolean);if(children.length)g.add(...children);return g;};
const metal=()=>mat('#a9b1bc',{rough:0.33,metal:0.7});
const dark=()=>mat('#252b34',{rough:0.75});
const glass=()=>mat('#30485e',{rough:0.22,metal:0.35});
const cream=()=>mat('#eeeae2',{rough:0.7});
const part=(w,h,d,m,x=0,y=0,z=0,r=0.012)=>at(box(w,h,d,m,{r}),x,y,z);
function disk(radius,thickness,m,x,y,z) {const o=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,thickness,32),m);o.rotation.x=Math.PI/2;return at(o,x,y,z);}
function ring(radius,tube,m,x,y,z) {return at(new THREE.Mesh(new THREE.TorusGeometry(radius,tube,8,36),m),x,y,z);}
function rod(a,b,r,m) {const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),m);o.position.copy(start.add(end).multiplyScalar(0.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;}
function handles(g,xs,y,z,width=0.16){for(const x of xs)g.add(part(width,0.018,0.026,metal(),x,y,z,0.008));}
function seams(g,width,ys,z){for(const y of ys)g.add(part(width,0.006,0.006,dark(),0,y,z,0));}
function instancedBoxes(material,boxes){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,boxes.length),matrix=new THREE.Matrix4();boxes.forEach(([w,h,d,x,y,z],i)=>{matrix.makeScale(w,h,d);matrix.setPosition(x,y+h/2,z);mesh.setMatrixAt(i,matrix);});mesh.instanceMatrix.needsUpdate=true;return mesh;}

function makeRack({color}){
  const frame=mat(color,{metal:0.65,rough:0.45}),board=mat('#b4a58e',{rough:0.95});
  const g=group(),holes=[];
  for(const x of [-0.43,0.43])for(const z of [-0.18,0.18]){
    g.add(part(0.035,1.8,0.016,frame,x,0,z),part(0.016,1.8,0.035,frame,x,0,z));
    for(let y=0.12;y<1.75;y+=0.14)holes.push([0.009,0.023,0.004,x,y,z+0.012]);
    g.add(part(0.05,0.018,0.05,dark(),x,0,z));
  }
  for(let i=0;i<5;i++){const y=0.1+i*0.405;g.add(part(0.88,0.025,0.38,board,0,y,0),part(0.9,0.035,0.016,frame,0,y-0.01,0.19),part(0.9,0.035,0.016,frame,0,y-0.01,-0.19));}
  g.add(instancedBoxes(dark(),holes),rod([-0.42,0.12,-0.19],[0.42,1.73,-0.19],0.008,frame),rod([0.42,0.12,-0.19],[-0.42,1.73,-0.19],0.008,frame));return g;
}

function tire(){
  const rubber=mat('#22252a',{rough:0.94}),tread=mat('#30343a',{rough:1});
  const points=[[0.205,-0.1],[0.245,-0.11],[0.31,-0.1],[0.337,-0.065],[0.337,0.065],[0.31,0.1],[0.245,0.11],[0.205,0.1],[0.205,-0.1]].map(([r,y])=>new THREE.Vector2(r,y));
  const g=group(new THREE.Mesh(new THREE.LatheGeometry(points,40),rubber));
  const blocks=new THREE.InstancedMesh(new THREE.BoxGeometry(0.012,0.065,0.037),tread,72),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),pos=new THREE.Vector3();
  for(let i=0;i<72;i++){const a=Math.floor(i/2)/36*Math.PI*2;pos.set(Math.sin(a)*0.337,(i%2?1:-1)*0.033,Math.cos(a)*0.337);q.setFromEuler(new THREE.Euler(0,a,i%2?0.15:-0.15));matrix.compose(pos,q,new THREE.Vector3(1,1,1));blocks.setMatrixAt(i,matrix);}
  g.add(blocks);return g;
}
function makeTires({layout}){const g=group();g.userData.tireCount=4;for(let i=0;i<4;i++){const t=tire();if(layout==='row'){t.rotation.x=Math.PI/2;t.position.set((i-1.5)*0.7,0.34,0);}else t.position.y=0.11+i*0.23;g.add(t);}return g;}

function makeWasher({color}){
  const g=group(part(0.6,0.84,0.58,mat(color,{rough:0.4})),part(0.57,0.09,0.012,cream(),0,0.73,0.298),
    disk(0.2,0.025,dark(),0,0.415,0.302),disk(0.161,0.029,glass(),0,0.415,0.317),ring(0.181,0.016,metal(),0,0.415,0.333),
    disk(0.026,0.015,metal(),0.04,0.778,0.314),part(0.12,0.033,0.014,dark(),0.18,0.76,0.304),part(0.15,0.032,0.015,mat('#d0d4d9'),-0.18,0.76,0.304));
  seams(g,0.55,[0.08],0.3);return g;
}
function makeDishwasher({color}){
  const g=group(part(0.6,0.82,0.6,mat(color,{rough:0.42,metal:0.3})),part(0.57,0.66,0.018,cream(),0,0.06,0.304),part(0.55,0.067,0.012,dark(),0,0.725,0.308),part(0.56,0.055,0.013,dark(),0,0.015,0.308));
  handles(g,[0],0.69,0.33,0.38);for(let x=-0.2;x<-0.02;x+=0.055)g.add(disk(0.008,0.008,metal(),x,0.76,0.319));return g;
}
function makeStove({color}){
  const g=group(part(0.5,0.83,0.58,mat(color,{rough:0.45})),part(0.5,0.025,0.6,dark(),0,0.83,0),part(0.41,0.37,0.02,dark(),0,0.19,0.3),part(0.34,0.27,0.008,glass(),0,0.23,0.314));
  for(const x of [-0.13,0.13])for(const z of [-0.15,0.15]){const burner=ring(0.075,0.006,metal(),x,0.859,z);burner.rotation.x=Math.PI/2;g.add(burner);}
  for(let i=0;i<4;i++)g.add(disk(0.019,0.025,dark(),(i-1.5)*0.095,0.755,0.3));handles(g,[0],0.62,0.327,0.34);return g;
}
function makeMicrowave({color}){
  const g=group(part(0.48,0.29,0.37,mat(color,{rough:0.4,metal:0.25})),part(0.35,0.22,0.012,dark(),-0.044,0.035,0.188),part(0.28,0.15,0.006,glass(),-0.054,0.07,0.196),part(0.045,0.025,0.008,dark(),0.193,0.215,0.192),disk(0.021,0.014,dark(),0.193,0.109,0.196));
  g.add(part(0.014,0.16,0.028,metal(),0.102,0.064,0.208));for(let i=0;i<4;i++)g.add(part(0.018,0.006,0.005,dark(),0.193,0.17-i*0.012,0.195,0));return g;
}
function makeShoeCabinet({color}){
  const g=group(part(0.8,1.08,0.26,mat(color,{rough:0.7}),0,0.02,0),part(0.81,0.025,0.28,mat('#d4b68e'),0,1.075,0));
  for(let i=0;i<3;i++){const y=0.06+i*0.33;g.add(part(0.75,0.315,0.018,cream(),0,y,0.137));handles(g,[0],y+0.27,0.16,0.28);}return g;
}
function makeHall({color}){
  const wood=mat(color,{rough:0.7}),mirror=mat('#a6bccb',{rough:0.17,metal:0.85});
  const g=group(part(1.2,0.06,0.4,wood),part(0.51,2.02,0.4,wood,-0.345,0.06,0),part(0.44,1.65,0.018,mirror,-0.345,0.28,0.208),part(0.66,0.42,0.4,wood,0.27,0.06,0),part(0.66,0.055,0.41,mat('#555b5b',{rough:1}),0.27,0.48,0),part(0.66,1.56,0.025,wood,0.27,0.54,-0.186),part(0.67,0.035,0.4,wood,0.27,2.055,0));
  for(const x of [0.04,0.27,0.5])g.add(rod([x,1.55,-0.16],[x,1.55,-0.06],0.012,metal()),rod([x,1.55,-0.06],[x,1.6,-0.06],0.012,metal()));
  handles(g,[0.1,0.44],0.39,0.216,0.15);g.add(part(0.007,0.38,0.008,dark(),0.27,0.09,0.205,0));return g;
}
function makeCornerSofa({color,chaise}){
  const fabric=mat(color,{rough:1}),base=mat(new THREE.Color(color).multiplyScalar(0.72).getStyle(),{rough:1}),g=group();
  g.add(part(2.65,0.23,0.9,base,0,0.09,-0.3,0.05),part(0.8,0.23,0.85,base,0.925,0.09,0.37,0.05),part(2.33,0.43,0.19,base,0,0.4,-0.66,0.06));
  for(const x of [-1.24,1.24])g.add(part(0.17,0.47,x>0?1.5:0.9,base,x,0.25,x>0?0:-0.3,0.06));
  for(let i=0;i<3;i++){const x=(i-1)*0.79;g.add(part(0.77,0.16,i===2?1.27:0.68,fabric,x,0.34,i===2?0.08:-0.24,0.06),part(0.75,0.32,0.15,fabric,x,0.5,-0.52,0.05));}
  for(const x of [-1.15,1.15])for(const z of [-0.6,0.63])g.add(part(0.05,0.09,0.05,dark(),x,0,z));
  const pillow=part(0.3,0.29,0.13,mat('#cfb68f',{rough:1}),-0.93,0.5,-0.38,0.05);pillow.rotation.z=0.16;g.add(pillow);if(chaise==='left')g.scale.x=-1;return g;
}
function makeSlidingWardrobe({color}){
  const body=mat(color,{rough:0.65}),mirror=mat('#aabfc9',{rough:0.17,metal:0.82}),g=group(part(2,2.35,0.62,body));
  for(let i=0;i<3;i++){const x=(i-1)*0.65,z=0.32+(i%2)*0.015;g.add(part(0.64,2.21,0.018,i===1?mirror:cream(),x,0.07,z),part(0.012,2.21,0.018,metal(),x+0.312,0.07,z+0.015));}
  g.add(part(1.96,0.02,0.045,metal(),0,0.04,0.32),part(1.96,0.02,0.045,metal(),0,2.29,0.32));return g;
}
function makeWallUnit({color}){
  const wood=mat(color,{rough:0.68}),g=group(part(2.5,0.4,0.42,wood,0,0.03,0),part(0.5,1.43,0.4,wood,-1,0.43,0),part(0.48,0.85,0.35,wood,1.01,1.05,-0.025),part(1.5,0.1,0.31,wood,0,1.73,-0.055),part(1.29,0.75,0.04,dark(),0.02,0.68,0.03),part(1.21,0.67,0.012,glass(),0.02,0.72,0.058));
  for(let i=0;i<5;i++)g.add(part(0.48,0.32,0.012,cream(),(i-2)*0.496,0.075,0.215));
  g.add(part(0.44,1.3,0.012,cream(),-1,0.5,0.207),part(0.42,0.77,0.012,cream(),1.01,1.09,0.157),part(0.65,0.025,0.24,wood,0.06,1.45,0));return g;
}
function makeShelf({color}){const wood=mat(color,{rough:0.65}),g=group(part(1.1,0.028,0.26,wood),part(1.1,0.028,0.26,wood,0,0.43,0));for(const x of [-0.43,0.43])g.add(part(0.025,0.46,0.025,dark(),x,0,-0.115),rod([x,0.03,0.1],[x,0.21,-0.115],0.009,dark()));return g;}
function makeBasket({color}){
  const weave=mat(color,{rough:0.95}),bars=[[0.4,0.025,0.34,0,0,0]];
  for(let y=0.035;y<0.57;y+=0.035)bars.push([0.42,0.018,0.014,0,y,0.172],[0.42,0.018,0.014,0,y,-0.172],[0.014,0.018,0.36,-0.203,y,0],[0.014,0.018,0.36,0.203,y,0]);
  for(const x of [-0.19,-0.095,0,0.095,0.19])for(const z of [-0.168,0.168])bars.push([0.01,0.55,0.01,x,0.02,z]);
  for(const x of [-0.202,0.202])for(const z of [-0.13,0,0.13])bars.push([0.01,0.55,0.01,x,0.02,z]);return group(instancedBoxes(weave,bars));
}
function makeShower(){
  const glazed=new THREE.MeshStandardMaterial({color:'#b8d4df',roughness:0.12,metalness:0.1,transparent:true,opacity:0.22,depthWrite:false,side:THREE.DoubleSide});
  const g=group(part(0.9,0.13,0.9,cream(),0,0,0,0.04),part(0.75,0.015,0.75,mat('#c8d6dc'),0,0.13,0,0.025));
  for(const x of [-0.43,0.43])for(const z of [-0.43,0.43])g.add(part(0.023,1.97,0.023,metal(),x,0.13,z));
  g.add(part(0.84,1.9,0.008,glazed,0,0.16,0.43),part(0.84,1.9,0.008,glazed,0,0.16,-0.43),part(0.008,1.9,0.84,glazed,-0.43,0.16,0),part(0.008,1.9,0.84,glazed,0.43,0.16,0),part(0.88,0.02,0.88,metal(),0,2.08,0));
  g.add(rod([0,0.9,-0.38],[0,1.9,-0.38],0.013,metal()),rod([0,1.9,-0.38],[0,1.9,-0.13],0.013,metal()),at(cyl(0.09,0.09,0.018,metal(),20),0,1.88,-0.13),part(0.018,0.24,0.03,metal(),0.1,0.95,0.449));return g;
}

function sideExtrusion(points,width,m){const shape=new THREE.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false,steps:1});geo.translate(0,0,-width/2);const mesh=new THREE.Mesh(geo,m);mesh.rotation.y=Math.PI/2;return mesh;}
function quad(points,m){const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();return new THREE.Mesh(geometry,m);}
function makeCrossover({color}){
  const paint=mat(color,{rough:0.35,metal:0.4}),g=group();
  const shell=new THREE.Shape();shell.moveTo(-2.15,0.39);shell.lineTo(-1.75,0.39);shell.absarc(-1.35,0.39,0.4,Math.PI,0,true);shell.lineTo(0.95,0.39);shell.absarc(1.35,0.39,0.4,Math.PI,0,true);shell.lineTo(2.15,0.39);shell.lineTo(2.17,0.76);shell.lineTo(1.83,0.97);shell.lineTo(-1.85,0.97);shell.lineTo(-2.18,0.78);shell.closePath();
  const shellGeo=new THREE.ExtrudeGeometry(shell,{depth:1.76,bevelEnabled:false,steps:1});shellGeo.translate(0,0,-0.88);const body=new THREE.Mesh(shellGeo,paint);body.rotation.y=Math.PI/2;g.add(body);
  g.add(sideExtrusion([[-1.3,0.95],[-0.89,1.56],[0.85,1.56],[1.33,0.95]],1.57,paint));
  const windows=glass().clone();windows.side=THREE.DoubleSide;
  g.add(quad([[-0.73,1.01,1.27],[0.73,1.01,1.27],[0.69,1.5,0.94],[-0.69,1.5,0.94]],windows),quad([[-0.73,1.01,-1.295],[-0.69,1.5,-0.91],[0.69,1.5,-0.91],[0.73,1.01,-1.295]],windows));
  for(const sx of [-1,1]){
    g.add(quad([[sx*0.791,1.02,-1.16],[sx*0.791,1.49,-0.85],[sx*0.791,1.49,0.75],[sx*0.791,1.02,1.17]],windows),part(0.022,0.49,0.06,dark(),sx*0.8,1.01,0.05),part(0.05,0.035,1.78,dark(),sx*0.58,1.56,0),part(0.13,0.08,0.22,paint,sx*0.9,1.06,0.88,0.025));
    for(const z of [-1.35,1.35]){
      const wheel=group(disk(0.34,0.22,mat('#22252b',{rough:0.95}),0,0,0),disk(0.23,0.23,metal(),0,0,0),disk(0.165,0.24,dark(),0,0,0),disk(0.065,0.25,metal(),0,0,0));
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;wheel.add(rod([Math.cos(a)*0.07,Math.sin(a)*0.07,0.126],[Math.cos(a)*0.21,Math.sin(a)*0.21,0.126],0.025,metal()));}
      wheel.rotation.y=Math.PI/2;wheel.position.set(sx*0.82,0.34,z);wheel.userData.wheel=true;g.add(wheel);
    }
    for(const z of [-0.5,0.65])g.add(part(0.018,0.025,0.14,metal(),sx*0.888,0.94,z));
  }
  for(const sx of [-1,1])g.add(part(0.47,0.065,0.025,mat('#f3ecd3',{emissive:'#d2d2a6',emissiveIntensity:0.4}),sx*0.56,0.82,2.174),part(0.43,0.065,0.025,mat('#a94441'),sx*0.58,0.82,-2.18));
  g.add(part(0.78,0.21,0.03,dark(),0,0.5,2.185),part(0.4,0.1,0.015,cream(),0,0.53,2.205),part(1.55,0.09,0.055,dark(),0,0.37,-2.17));g.userData.wheelCount=4;return g;
}

const raw={metalRack:makeRack,tireStack:makeTires,washingMachine:makeWasher,dishwasher:makeDishwasher,stove:makeStove,microwave:makeMicrowave,shoeCabinet:makeShoeCabinet,hallUnit:makeHall,cornerSofa:makeCornerSofa,slidingWardrobe:makeSlidingWardrobe,wallUnit:makeWallUnit,wallShelf:makeShelf,laundryBasket:makeBasket,showerCabin:makeShower,crossover:makeCrossover};
export const EXTRA_BUILDERS=Object.fromEntries(Object.entries(raw).map(([type,make])=>[type,item=>{
  const inner=make({...item,color:item.color||EXTRA_MODEL_INFO[type].color}),bounds=new THREE.Box3().setFromObject(inner),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),dimensions=extraDimensions({...item,type});
  inner.position.set(-center.x,-bounds.min.y,-center.z);
  const root=group(inner);root.scale.set(dimensions[0]/size.x,dimensions[1]/size.y,dimensions[2]/size.z);root.userData={...inner.userData,modelType:type};return root;
}]));
