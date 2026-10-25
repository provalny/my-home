import * as THREE from 'three';
import {buildTrailSuv} from './trail-suv.js';
import {buildVestaSwCross} from './vesta-sw-cross.js';
import {disposeObject} from './storage-interior.js';
import {vehicleModelType} from '../automobile/vehicle-model.js';

const cache=new Map();
export function renderCarPreviews(cars){
  const images=new Map();let renderer;
  try{
    for(const car of cars){
      const type=vehicleModelType(car),key=type+':'+car.color;
      if(cache.has(key)){images.set(car.id,cache.get(key));continue;}
      if(!renderer){renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(640,360);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;}
      const scene=new THREE.Scene();scene.background=new THREE.Color('#172537');
      const model=(type==='vestaSwCross2019'?buildVestaSwCross:buildTrailSuv)({color:car.color||'#278cb7',dirt:0,headlights:false});scene.add(model);
      scene.add(new THREE.HemisphereLight('#f2f6ff','#607585',2));
      const keyLight=new THREE.DirectionalLight('#ffe0bf',4);keyLight.position.set(-4,7,6);scene.add(keyLight);
      const rim=new THREE.DirectionalLight('#bbdfff',3);rim.position.set(4,4,-4);scene.add(rim);
      const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),camera=new THREE.PerspectiveCamera(34,640/360,.05,100);
      const distance=Math.max(size.y,size.x/camera.aspect,size.z*.75)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.5;
      camera.position.copy(center).add(new THREE.Vector3(1,.65,1.35).normalize().multiplyScalar(distance));camera.lookAt(center);
      try{renderer.render(scene,camera);const src=renderer.domElement.toDataURL('image/jpeg',.87);cache.set(key,src);images.set(car.id,src);}finally{disposeObject(scene);}
    }
    while(cache.size>24)cache.delete(cache.keys().next().value);
  }catch(error){console.warn('Превью автомобиля недоступно',error);}
  finally{renderer?.dispose();renderer?.forceContextLoss();}
  return images;
}
