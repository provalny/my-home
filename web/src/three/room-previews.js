import * as THREE from 'three';
import { normalize } from '../config.js';
import { buildHouse } from './house.js';
import { buildFurniture } from './furniture.js';
import { isSharedMaterial } from './kit.js';

// One transient renderer for all thumbnails; cached images never hold WebGL contexts.
const cache=new Map();
export function roomPreviewPlan(plan,roomId,excludedIds=[]) {
  const room=plan.rooms.find(r=>r.id===roomId);if(!room)return null;
  const [x,z,w,d]=room.rect,excluded=new Set(excludedIds);
  const furniture=(plan.furniture||[]).filter(f=>!excluded.has(f.id)&&f.pos[0]>=x&&f.pos[0]<=x+w&&f.pos[1]>=z&&f.pos[1]<=z+d);
  return {...plan,rooms:[room],furniture,lights:[],acs:[],scenes:[]};
}
export function renderRoomPreviews(plan,roomIds,excludedIds=[]) {
  const result=new Map(),pending=[];
  for(const id of roomIds){const raw=roomPreviewPlan(plan,id,excludedIds);if(!raw)continue;const key=JSON.stringify(raw);if(cache.has(key))result.set(id,cache.get(key));else pending.push({id,key,raw});}
  if(!pending.length)return result;
  let renderer;
  try {
    renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(640,360);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    for(const {id,key,raw} of pending){
      const cfg=normalize(raw),r=cfg.rooms[0],scene=new THREE.Scene();scene.background=new THREE.Color('#172033');
      const az=THREE.MathUtils.degToRad(cfg.camera.azimuth),dir=new THREE.Vector3(Math.sin(az),0,Math.cos(az));
      const house=buildHouse(cfg,dir);scene.add(house.group,buildFurniture(cfg.furniture));
      scene.add(new THREE.HemisphereLight('#ffeddb','#6e5849',1.6));
      const light=new THREE.DirectionalLight('#ffe0b3',3.4);light.position.set(r.x+r.w+3,7,r.z+r.d+4);light.target.position.set(r.x+r.w/2,0,r.z+r.d/2);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=light.shadow.camera.bottom=-Math.max(r.w,r.d);light.shadow.camera.right=light.shadow.camera.top=Math.max(r.w,r.d);light.shadow.normalBias=.025;scene.add(light,light.target);
      const glow=new THREE.PointLight('#ffd4a0',12,Math.max(r.w,r.d)*2,2);glow.position.set(r.x+r.w*.45,1.9,r.z+r.d*.45);scene.add(glow);
      const camera=new THREE.PerspectiveCamera(35,640/360,.1,200);
      const center=new THREE.Vector3(r.x+r.w/2,.5,r.z+r.d/2);
      // Fit all room corners in camera space, including tall furniture, around the room center.
      const elevation=THREE.MathUtils.degToRad(54),direction=new THREE.Vector3(dir.x*Math.cos(elevation),Math.sin(elevation),dir.z*Math.cos(elevation));
      camera.position.copy(center).add(direction);camera.lookAt(center);camera.updateMatrixWorld();
      const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
      const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=1;
      for(const x of [r.x-.3,r.x+r.w+.3])for(const z of [r.z-.3,r.z+r.d+.3])for(const y of [-.3,cfg.wallHeight]){
        const p=new THREE.Vector3(x,y,z).sub(center);distance=Math.max(distance,p.dot(direction)+Math.abs(p.dot(right))/(tan*camera.aspect),p.dot(direction)+Math.abs(p.dot(up))/tan);
      }
      camera.position.copy(center).addScaledVector(direction,distance*.74);camera.lookAt(center);
      try{renderer.render(scene,camera);const src=renderer.domElement.toDataURL('image/jpeg',.85);cache.set(key,src);result.set(id,src);}
      finally{const geometries=new Set(),materials=new Set();scene.traverse(o=>{o.shadow?.map?.dispose();if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m&&!isSharedMaterial(m))materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
    }
    while(cache.size>40)cache.delete(cache.keys().next().value);
  }catch(error){console.warn('Не удалось создать фон комнат',error);}
  finally{renderer?.dispose();renderer?.forceContextLoss();}
  return result;
}
