import * as THREE from 'three';

const hash=i=>{i=Math.imul(i^(i>>>16),0x45d9f3b);i=Math.imul(i^(i>>>16),0x45d9f3b);return ((i^(i>>>16))>>>0)/4294967295;};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function inClearing(x,z,footprints,padding=.18){return footprints.some(p=>((x-p.x)/(p.width*.5+padding))**2+((z-p.z)/(p.depth*.5+padding))**2<1);}

// Preserve the model's authored dimensions. Only its position changes.
export function placeOnGround(model,{x=model.position.x,z=model.position.z,rotation=model.rotation.y}={}){
 model.position.set(x,0,z);model.rotation.y=rotation;model.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(model);if(!bounds.isEmpty())model.position.y-=bounds.min.y;
 model.updateMatrixWorld(true);return new THREE.Box3().setFromObject(model);
}

export function createTerrainPixels(atmosphere,{size=256,radius=10,footprints=[]}={}){
 const data=new Uint8Array(size*size*4),grass=rgb(atmosphere.grass[0]),dark=rgb(atmosphere.grass[2]),soil=rgb(atmosphere.ground);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const nx=(x/(size-1)*2-1),nz=(y/(size-1)*2-1),distance=Math.hypot(nx,nz),i=(y*size+x)*4,noise=hash(x+y*size);
  const clear=inClearing(nx*radius,nz*radius,footprints,.3),base=clear?soil:grass;
  const contrast=(clear||atmosphere.snow) ? .08 : .22,blend=(noise-.5)*contrast;
  for(let c=0;c<3;c++)data[i+c]=Math.max(0,Math.min(255,Math.round(base[c]*(1+blend)+(dark[c]-base[c])*(clear?.06:noise*.24))));
  data[i+3]=Math.round(255*Math.max(clear?1:0,1-smooth((distance-.38)/.58)));
 }
 return data;
}

// A real, horizontal receiving surface and sparse grass share a single texture.
// The outer edge fades into the cached landscape; the footprint area stays low.
export function createMeadowStage({radius=10,footprints=[]}={}){
 const root=new THREE.Group();root.name='Земля под хранилищами';let signature='',currentFootprints=footprints;
 const texture=new THREE.DataTexture(new Uint8Array(256*256*4),256,256);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(radius*2,radius*2),new THREE.MeshStandardMaterial({map:texture,color:'#b9bdb6',roughness:1,metalness:0,transparent:true,alphaTest:.005,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.renderOrder=-2;root.add(floor);
 const grassMaterial=new THREE.MeshStandardMaterial({color:'#9aa775',roughness:1,side:THREE.DoubleSide});
 const grassGeometry=new THREE.ConeGeometry(.027,.11,3),grass=new THREE.InstancedMesh(grassGeometry,grassMaterial,220);grass.receiveShadow=true;grass.castShadow=false;root.add(grass);
 const shadowData=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,r=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5);shadowData[i]=8;shadowData[i+1]=14;shadowData[i+2]=22;shadowData[i+3]=Math.round(105*(1-smooth(r)));}
 const shadowTexture=new THREE.DataTexture(shadowData,64,64);shadowTexture.magFilter=THREE.LinearFilter;shadowTexture.minFilter=THREE.LinearFilter;shadowTexture.needsUpdate=true;
 const shadowMaterial=new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}),shadows=[];
 function setFootprints(list){currentFootprints=list;signature='';for(const s of shadows){root.remove(s);s.geometry.dispose();}shadows.length=0;
  for(const p of list){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(.15,p.width*1.1),Math.max(.15,p.depth*1.1)),shadowMaterial);mesh.rotation.x=-Math.PI/2;mesh.position.set(p.x,.003,p.z);mesh.renderOrder=-1;root.add(mesh);shadows.push(mesh);}
 }
 setFootprints(footprints);
 return {root,floor,setFootprints,update(a){
  if(signature===a.signature)return;signature=a.signature;
  texture.image.data.set(createTerrainPixels(a,{radius,footprints:currentFootprints}));texture.needsUpdate=true;
  grassMaterial.color.set(a.grass[2]);const transform=new THREE.Object3D();let count=0;
  for(let i=0;i<500&&count<220;i++){
   const angle=hash(i+100)*Math.PI*2,r=Math.sqrt(hash(i+700))*radius*.62,x=Math.cos(angle)*r,z=Math.sin(angle)*r;
   if(inClearing(x,z,currentFootprints,.35))continue;
   const scale=a.snow?.08:.55+hash(i+20)*.9;transform.position.set(x,.055*scale,z);transform.scale.set(.65+hash(i+1),scale,.65+hash(i+2));transform.rotation.y=hash(i+80)*Math.PI;transform.updateMatrix();grass.setMatrixAt(count++,transform.matrix);
  }
  grass.count=count;grass.instanceMatrix.needsUpdate=true;
 },dispose(){floor.geometry.dispose();floor.material.dispose();texture.dispose();grassGeometry.dispose();grassMaterial.dispose();grass.dispose();for(const s of shadows)s.geometry.dispose();shadowMaterial.dispose();shadowTexture.dispose();}};
}
