import './model-gallery.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { h } from '../ui/dom.js';
import { buildFurniture } from './furniture.js';
import { EXTRA_MODEL_INFO, extraDimensions } from './furniture-info.js';

function stage(canvas) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#101827');
  const camera=new THREE.PerspectiveCamera(34,1,0.05,100);
  scene.add(new THREE.HemisphereLight('#e0edff','#78654e',2));
  const key=new THREE.DirectionalLight('#fff1d8',4);key.position.set(4,6,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.normalBias=0.02;scene.add(key);
  const rim=new THREE.DirectionalLight('#8faeff',1.5);rim.position.set(-3,3,-4);scene.add(rim);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(6,6),new THREE.MeshStandardMaterial({color:'#263247',roughness:0.95}));floor.rotation.x=-Math.PI/2;floor.position.y=-0.012;floor.receiveShadow=true;scene.add(floor);
  let model=null;
  function clear(){if(!model)return;scene.remove(model);const geometries=new Set();model.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.isInstancedMesh)n.dispose();});for(const g of geometries)g.dispose();model=null;}
  function show(type,options={}){
    clear();model=buildFurniture([{id:'preview',type,pos:[0,0],...options}]);
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),scale=2.2/Math.max(size.x,size.y,size.z);
    model.scale.setScalar(scale);scene.add(model);
    const height=size.y*scale;camera.position.set(3.25,2.25,type==='simCockpitTriple'?-3.75:3.75);camera.lookAt(0,height*0.45,0);return height;
  }
  function resize(width,height){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
  return {renderer,scene,camera,show,resize,render:()=>renderer.render(scene,camera),dispose(){clear();floor.geometry.dispose();floor.material.dispose();renderer.dispose();renderer.forceContextLoss();}};
}

export function openModelGallery({root=null,onChoose=null}={}) {
  const standalone=Boolean(root),host=standalone?h('section.mg-page'):h('dialog.mg-dialog',{'aria-label':'Новые 3D-модели'});
  const canvas=h('canvas',{'aria-label':'3D-просмотр выбранной модели'}),viewport=h('div.mg-viewport',canvas),cards=h('div.mg-cards'),name=h('h2'),dimensions=h('p.mg-dimensions'),note=h('p.mg-note');
  const selectLayout=h('select',{'aria-label':'Расположение четырёх шин'},h('option',{value:'stack'},'Шины стопкой'),h('option',{value:'row'},'Шины в ряд'));
  const types=Object.keys(EXTRA_MODEL_INFO),buttons=new Map();let type=types[0],viewer=null,controls=null,frame=null,observer=null,closed=false;
  const close=()=>{if(closed)return;closed=true;window.removeEventListener('pagehide',close);cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();viewer?.dispose();if(!standalone)host.close();host.remove();};
  const add=h('button.mg-btn.primary',{type:'button',onclick:()=>{const selected=type,options=type==='tireStack'?{layout:selectLayout.value}:{};close();onChoose?.(selected,options);}},'Разместить на плане');add.hidden=!onChoose;
  function select(next){type=next;const info=EXTRA_MODEL_INFO[type];name.textContent=info.name;note.textContent=type==='neonPorsche'?'Сине-розовый свет. В редакторе привязывается к ближайшей стене; высоту можно задать вручную.':type==='gamingDesktop'?'Единый RGB-комплект с привязкой к поверхности. Размер коврика — 80 × 35 см.':type==='ikeaFloorLamp'?'Высокий светящийся торшер в стиле IKEA, высота 160 см.':type==='printerCabinet'?'Столешница 50 × 50 см, по ширине обеих моделей принтера. Высота — 76 см. Внутри две полки.':['printer3dOpen','printer3dEnclosed'].includes(type)?'Ширина и глубина — 50 см. Установите на тумбочку высотой 76 см; для пола задайте высоту размещения 0.':info.fixedSize?'Один размер корпуса. Характеристики доступны в редакторе и карточке.':['simCockpit','simCockpitTriple'].includes(type)?'Кокпит без ПК, с внутренним хранилищем. Комплектация не меняет внешний вид.':type==='crossover'?'Универсальный кроссовер без марки. Модель для будущего раздела автомобиля.':'Модель для редактора квартиры. Размеры и цвет можно изменить.';selectLayout.hidden=type!=='tireStack';
    const dims=extraDimensions({type,layout:selectLayout.value});dimensions.textContent=`${dims.map(n=>Math.round(n*100)).join(' × ')} см · ширина × высота × глубина`;
    for(const [key,b]of buttons)b.setAttribute('aria-pressed',String(key===type));
    if(viewer){const height=viewer.show(type,{layout:selectLayout.value});controls.target.set(0,height*0.45,0);controls.update();viewer.render();}
  }
  selectLayout.onchange=()=>select(type);
  host.append(h('header.mg-header',h('div',h('h1','Новые 3D-модели'),h('p',`${types.length} предметов · мебель, техника, хранение и симрейсинг`)),standalone?null:h('button.mg-btn',{type:'button',onclick:close},'Закрыть')),
    h('div.mg-layout',cards,h('section.mg-inspector',viewport,h('div.mg-info',name,dimensions,selectLayout,note,h('p.mg-hint','Перетаскивайте модель для вращения · колесо для масштаба'),add))));
  if(standalone)root.replaceChildren(host);else{document.body.append(host);host.showModal();host.addEventListener('cancel',e=>{e.preventDefault();close();});}
  try{
    viewer=stage(canvas);controls=new OrbitControls(viewer.camera,canvas);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=1.7;controls.maxDistance=9;controls.maxPolarAngle=Math.PI*0.49;
    // A single temporary renderer creates previews of the actual geometry, then releases its context.
    const thumbnailCanvas=document.createElement('canvas'),thumbnail=stage(thumbnailCanvas);thumbnail.resize(256,170);
    for(const [key,info]of Object.entries(EXTRA_MODEL_INFO)){
      thumbnail.show(key);thumbnail.render();
      const b=h('button.mg-model',{type:'button','aria-label':info.name,'aria-pressed':String(key===type),onclick:()=>select(key)},h('img',{src:thumbnailCanvas.toDataURL('image/png'),alt:'',width:256,height:170}),h('strong',info.name));buttons.set(key,b);cards.append(b);
    }
    thumbnail.dispose();
    observer=new ResizeObserver(()=>{const rect=viewport.getBoundingClientRect();if(rect.width&&rect.height)viewer.resize(rect.width,rect.height);});observer.observe(viewport);
    const render=()=>{if(closed)return;if(!document.hidden){controls.update();viewer.render();}frame=requestAnimationFrame(render);};
    select(type);render();
  }catch(error){viewport.replaceChildren(h('p.mg-note','3D-просмотр недоступен: '+error.message));}
  window.addEventListener('pagehide',close,{once:true});
  return host;
}
export const bootModelGallery=root=>openModelGallery({root});
