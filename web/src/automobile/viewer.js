import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildTrailSuv } from '../three/trail-suv.js';
import { buildStorageClutter } from '../three/storage-clutter.js';
import { disposeObject } from '../three/storage-interior.js';
import { h } from '../ui/dom.js';

export function createCarViewer(host,{color='#278cb7',theme='dark',zones=[],selectedId=null,onSelect,reducedMotion=()=>false,memory=null}={}){
 const canvas=h('canvas',{'aria-label':'3D-модель автомобиля. Перетаскивайте для вращения, колесо для приближения',tabindex:0}),labels=h('div.au-zone-labels');host.append(canvas,labels);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 const scene=new THREE.Scene(),light=theme==='light';scene.background=new THREE.Color(light?'#e9eff6':'#101b2c');scene.fog=new THREE.Fog(scene.background,14,38);
 const camera=new THREE.PerspectiveCamera(36,1,.1,60);camera.position.set(6,4.4,6.8);
 const controls=new OrbitControls(camera,canvas);controls.target.set(0,1,0);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=3;controls.maxDistance=15;controls.maxPolarAngle=Math.PI*.49;
 scene.add(new THREE.HemisphereLight('#e5eeff','#5d6e7f',1));
 const key=new THREE.DirectionalLight('#ffe1bb',3);key.position.set(-4,7,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=5;key.shadow.camera.bottom=-5;key.shadow.normalBias=.025;scene.add(key);
 const rim=new THREE.DirectionalLight('#7bcbff',2.4);rim.position.set(5,3,-4);scene.add(rim);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.05);room.dispose();pmrem.dispose();scene.environment=env.texture;scene.environmentIntensity=.35;
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(70,70),new THREE.MeshStandardMaterial({color:light?'#dce5ef':'#1c2d42',roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.receiveShadow=true;scene.add(floor);
 const model=buildTrailSuv({color,dirt:.08,headlights:false}),vehicle=model.userData.vehicle;model.traverse(o=>{if(o.isMesh){o.castShadow=!o.userData.noShadow;o.receiveShadow=!o.userData.noShadow;}});scene.add(model);
 const opened={},toggleButtons=new Map();let disposed=false,running=true,frame=0,target=null,lights=false,time=0;
 for(const z of zones.filter(z=>['cabin','trunk'].includes(z.carCompartment))){const trunk=z.carCompartment==='trunk',clutter=buildStorageClutter({nodeId:z.id,fill:z.fill},trunk?1.1:.53,.35,trunk?.76:.32);clutter.position.set(trunk?0:.38,trunk?.755:.72,trunk?-1.55:.44);vehicle.inner.add(clutter);}
 const zoneMeshes=[];const labelRows=zones.filter(z=>['cabin','trunk'].includes(z.carCompartment)||z.id===selectedId).map((z,i)=>{
  const trunk=z.carCompartment!=='cabin',anchor=new THREE.Vector3(trunk?(i>1?-.8:0):.55,trunk?(i>1?1.6:1.1):1.35,trunk?-1.45:.4);
  const marker=new THREE.Mesh(new THREE.BoxGeometry(trunk?1.32:.75,.06,trunk?1:.9),new THREE.MeshBasicMaterial({color:trunk?'#ffbc55':'#65b6ff',transparent:true,opacity:z.id===selectedId?.25:.04,depthWrite:false}));marker.position.copy(anchor);scene.add(marker);zoneMeshes.push({id:z.id,marker});
  const b=h('button.au-zone-label',{type:'button','aria-label':'Открыть отсек: '+z.name,'aria-pressed':String(z.id===selectedId),onclick:()=>{focus(z.id);onSelect?.(z.id);}},h('span.au-zone-dot'),z.name);labels.append(b);return {z,anchor,b};
 });
 function setOpen(key,value){opened[key]=value;toggleButtons.get(key)?.setAttribute('aria-pressed',String(value));if(reducedMotion())vehicle.setOpen(key,value?1:0);else vehicle.animateOpen(key,value?1:0);}
 function focus(id){const zone=zones.find(z=>z.id===id);if(!zone)return;const trunk=zone.carCompartment!=='cabin';setOpen(trunk?'tailgate':'frontLeft',true);if(!trunk)setOpen('frontRight',true);target={position:new THREE.Vector3(trunk?4.1:4.7,trunk?3.2:4.2,trunk?-5.3:3.5),look:new THREE.Vector3(0,1,trunk?-1.1:.5)};for(const row of labelRows)row.b.setAttribute('aria-pressed',String(row.z.id===id));for(const z of zoneMeshes)z.marker.material.opacity=z.id===id?.24:.04;}
 const buttons=h('div.au-view-controls');
 for(const [part,label]of [['frontLeft','Левая дверь'],['frontRight','Правая дверь'],['tailgate','Багажник'],['hood','Капот']]){const b=h('button.iv-btn',{type:'button','aria-pressed':'false',onclick:()=>{setOpen(part,!opened[part]);b.setAttribute('aria-pressed',String(opened[part]));}},label);toggleButtons.set(part,b);buttons.append(b);}
 const lamps=h('button.iv-btn',{type:'button','aria-pressed':'false',onclick:()=>{lights=!lights;vehicle.setHeadlights(lights);lamps.setAttribute('aria-pressed',String(lights));}},'Фары');
 buttons.append(lamps,h('button.iv-btn',{type:'button',onclick:()=>{target={position:new THREE.Vector3(6,4.4,6.8),look:new THREE.Vector3(0,1,0)};}},'Общий вид'));host.append(buttons,h('span.au-view-hint','Вращайте мышью · колесо — масштаб'));
 controls.addEventListener('start',()=>{target=null;});
 canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)){e.preventDefault();const offset=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(offset);if(e.key==='ArrowLeft')s.theta-=.15;if(e.key==='ArrowRight')s.theta+=.15;if(e.key==='ArrowUp')s.phi=Math.max(.1,s.phi-.12);if(e.key==='ArrowDown')s.phi=Math.min(Math.PI*.48,s.phi+.12);if(e.key==='+')s.radius=Math.max(3,s.radius*.9);if(e.key==='-')s.radius=Math.min(15,s.radius*1.1);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));target=null;controls.update();}});
 function resize(){const {width,height}=host.getBoundingClientRect();if(width&&height){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}}const observer=new ResizeObserver(resize);observer.observe(host);resize();
 const clock=new THREE.Clock();function render(){if(disposed)return;if(running&&!document.hidden){const dt=Math.min(clock.getDelta(),.05);time+=dt;vehicle.animate(time,{reduceMotion:reducedMotion()});if(target){const p=reducedMotion()?1:1-Math.exp(-dt*6);camera.position.lerp(target.position,p);controls.target.lerp(target.look,p);if(camera.position.distanceTo(target.position)<.01){camera.position.copy(target.position);controls.target.copy(target.look);target=null;}}controls.update();renderer.render(scene,camera);const rect=host.getBoundingClientRect();for(const {anchor,b}of labelRows){const p=anchor.clone().project(camera);b.style.left=(p.x*.5+.5)*rect.width+'px';b.style.top=(-p.y*.5+.5)*rect.height+'px';b.hidden=p.z>1||Math.abs(p.x)>.9||Math.abs(p.y)>.85;}}frame=requestAnimationFrame(render);}
 if(memory){camera.position.fromArray(memory.position);controls.target.fromArray(memory.target);for(const [key,value]of Object.entries(memory.opened||{})){opened[key]=value;toggleButtons.get(key)?.setAttribute('aria-pressed',String(value));vehicle.setOpen(key,value?1:0);}}
 if(selectedId&&!memory)focus(selectedId);render();
 return {focus,get vehicle(){return vehicle;},snapshot:()=>({position:camera.position.toArray(),target:controls.target.toArray(),opened:{...opened}}),settle(){if(target){camera.position.copy(target.position);controls.target.copy(target.look);target=null;}controls.update();},setRunning(value){running=value;clock.getDelta();},dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();disposeObject(model);for(const {marker}of zoneMeshes){marker.geometry.dispose();marker.material.dispose();}floor.geometry.dispose();floor.material.dispose();env.dispose();renderer.dispose();renderer.forceContextLoss();host.replaceChildren();}};
}
