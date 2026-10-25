import './model-gallery.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { h } from '../ui/dom.js';
import { buildFurniture } from './furniture.js';
import { EXTRA_MODEL_INFO, extraDimensions } from './furniture-info.js';
import { collectFurnitureAnimators, animateFurniture } from './furniture-animation.js';
import { disposeObject } from './storage-interior.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { trailOpeningClips } from './trail-suv.js';
import { BAG_TYPES,BAG_COLORS } from './luggage-models.js';

const isCar=type=>Boolean(EXTRA_MODEL_INFO[type]?.vehicleParts);

function stage(canvas) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#101827');
  const camera=new THREE.PerspectiveCamera(34,1,0.05,100);
  const ambient=new THREE.HemisphereLight('#e0edff','#78654e',2);scene.add(ambient);
  const key=new THREE.DirectionalLight('#fff1d8',4);key.position.set(4,6,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.normalBias=0.02;scene.add(key);
  const rim=new THREE.DirectionalLight('#8faeff',1.5);rim.position.set(-3,3,-4);scene.add(rim);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(6,6),new THREE.MeshStandardMaterial({color:'#263247',roughness:0.95}));floor.rotation.x=-Math.PI/2;floor.position.y=-0.012;floor.receiveShadow=true;scene.add(floor);
  let model=null,animators=[],time=0,last=null,exporting=false;
  let studio=null;
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clear(){if(!model)return;scene.remove(model);disposeObject(model);model=null;animators=[];}
  function show(type,options={}){
    clear();model=buildFurniture([{id:'preview',type,pos:[0,0],...options}]);
    if(isCar(type)&&!studio){const generator=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();studio=generator.fromScene(room,.05);room.dispose();generator.dispose();}
    scene.environment=isCar(type)?studio.texture:null;scene.environmentIntensity=.25;
    ambient.intensity=isCar(type)?.6:2;
    key.color.set(isCar(type)?'#ffaea1':'#fff1d8');key.intensity=isCar(type)?4.5:4;key.position.set(isCar(type)?-3:4,6,4);
    rim.color.set(isCar(type)?'#5edcff':'#8faeff');rim.intensity=isCar(type)?3:1.5;rim.position.set(isCar(type)?4:-3,3,-4);
    renderer.toneMappingExposure=isCar(type)?1:1.25;
    if(type==='vestaSwCross2019'){key.color.set('#fff2df');rim.color.set('#bedcff');ambient.intensity=1.0;renderer.toneMappingExposure=1.15;}
    animators=collectFurnitureAnimators(model);time=0;last=null;
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),scale=2.2/Math.max(size.x,size.y,size.z);
    model.scale.setScalar(scale);scene.add(model);
    model.traverse(o=>o.userData.vehicle?.setLightingScale(scale));
    const height=size.y*scale;if(isCar(type))camera.position.set(2.75,1.72,3.35);else camera.position.set(3.25,2.25,type==='simCockpitTriple'?-3.75:3.75);camera.lookAt(0,height*0.45,0);return height;
  }
  function resize(width,height){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
  return {renderer,scene,camera,show,resize,get exporting(){return exporting;},bag(){let bag=null;model?.traverse(o=>{if(o.userData.bag)bag=o.userData.bag;});return bag;},vehicle(){let car=null;model?.traverse(o=>{if(o.userData.vehicle)car=o.userData.vehicle;});return car;},async exportModel(){
    // Export a metre-sized model without the display scale or runtime controllers.
    const current=model,vehicle=this.vehicle(),saved=[],scale=current.scale.clone(),lightScale=vehicle?.lightingScale,openings=vehicle?.openings||[],rotations=openings.map(p=>p.pivot.rotation[p.axis]);
    const animations=trailOpeningClips(openings);exporting=true;
    openings.forEach(p=>p.pivot.rotation[p.axis]=0);vehicle?.setLightingScale(1);current.traverse(o=>{saved.push([o,o.userData]);const bag=o.userData.bag;o.userData=bag?{modelType:bag.type,capacityLiters:bag.capacityLiters}:{};});current.scale.setScalar(1);
    try{return await new GLTFExporter().parseAsync(current,{binary:true,animations});}finally{current.scale.copy(scale);for(const [o,data]of saved)o.userData=data;openings.forEach((p,i)=>p.pivot.rotation[p.axis]=rotations[i]);vehicle?.setLightingScale(lightScale);exporting=false;last=performance.now();}
  },render(){if(exporting)return;const now=performance.now();if(last!==null)time+=Math.min(.05,(now-last)/1000);last=now;animateFurniture(animators,time,{reduceMotion});renderer.render(scene,camera);},dispose(){clear();studio?.dispose();floor.geometry.dispose();floor.material.dispose();renderer.dispose();renderer.forceContextLoss();}};
}

export function openModelGallery({root=null,onChoose=null}={}) {
  const standalone=Boolean(root),host=standalone?h('section.mg-page'):h('dialog.mg-dialog',{'aria-label':'Новые 3D-модели'});
  const canvas=h('canvas',{'aria-label':'3D-просмотр выбранной модели'}),viewport=h('div.mg-viewport',canvas),cards=h('div.mg-cards'),name=h('h2'),dimensions=h('p.mg-dimensions'),note=h('p.mg-note');
  const selectLayout=h('select',{'aria-label':'Расположение четырёх шин'},h('option',{value:'stack'},'Шины стопкой'),h('option',{value:'row'},'Шины в ряд'));
  const selectParrots=h('select',{'aria-label':'Попугаи в клетке'},h('option',{value:'1'},'Один попугай'),h('option',{value:'2'},'Два попугая'));
  const bagColors={},bagColor=h('input',{type:'color','aria-label':'Цвет ткани'}),swatches=[];
  const bagControls=h('div.mg-car-controls',h('label','Цвет ткани',bagColor));
  const updateSwatches=()=>swatches.forEach(([color,button])=>button.setAttribute('aria-pressed',String(color===bagColor.value)));
  bagColor.oninput=()=>{bagColors[type]=bagColor.value;viewer?.bag()?.setColor(bagColor.value);updateSwatches();};
  for(const [color,label]of BAG_COLORS){const button=h('button.mg-swatch',{type:'button','aria-label':label,title:label,style:{backgroundColor:color},onclick:()=>{bagColor.value=color;bagColor.oninput();}});swatches.push([color,button]);bagControls.append(button);}
  let carOpen={};const carStates=new Map(),carToggles=new Map(),carColor=h('input',{type:'color',value:'#278cb7','aria-label':'Цвет кузова'}),carDirt=h('input',{type:'range',min:0,max:100,value:45,'aria-label':'Грязь на кузове'});
  const carLights=h('input',{type:'checkbox',checked:true,'aria-label':'Фары',onchange:e=>viewer?.vehicle()?.setHeadlights(e.target.checked)});
  const carOptions=()=>({color:carColor.value,dirt:Number(carDirt.value)/100,vehicleOpen:{...carOpen},headlights:carLights.checked});
  const carControls=h('div.mg-car-controls',h('label','Цвет кузова',carColor),h('label','Грязь на кузове',carDirt));
  for(const [key,label]of [['frontLeft','Передняя левая'],['frontRight','Передняя правая'],['rearLeft','Задняя левая'],['rearRight','Задняя правая'],['tailgate','Багажник'],['hood','Капот']]){
    const toggle=h('input',{type:'checkbox','aria-label':label,onchange:e=>{carOpen[key]=e.target.checked?1:0;viewer?.vehicle()?.animateOpen(key,carOpen[key]);}});
    const row=h('label',toggle,label);carToggles.set(key,{toggle,row});carControls.append(row);
  }
  carColor.oninput=()=>viewer?.vehicle()?.setColor(carColor.value);carDirt.oninput=()=>viewer?.vehicle()?.setDirt(Number(carDirt.value)/100);
  carControls.append(h('label',carLights,'Фары'));
  const exportCar=h('button.mg-btn',{type:'button',onclick:async()=>{
    exportCar.disabled=true;try{const result=await viewer.exportModel(),url=URL.createObjectURL(new Blob([result],{type:'model/gltf-binary'}));const link=h('a',{href:url,download:EXTRA_MODEL_INFO[type].exportFile||'trail-suv.glb'});document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){note.textContent='Не удалось экспортировать: '+error.message;}finally{exportCar.disabled=false;}
  }},'Скачать модель GLB');carControls.append(exportCar);
  const types=Object.keys(EXTRA_MODEL_INFO),buttons=new Map(),requested=new URLSearchParams(location.search).get('model');let type=types.includes(requested)?requested:types[0],viewer=null,controls=null,frame=null,observer=null,closed=false;
  const close=()=>{if(closed)return;closed=true;window.removeEventListener('pagehide',close);cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();viewer?.dispose();if(!standalone)host.close();host.remove();};
  const add=h('button.mg-btn.primary',{type:'button',onclick:()=>{const selected=type,options=BAG_TYPES.includes(type)?{color:bagColor.value}:isCar(type)?carOptions():type==='tireStack'?{layout:selectLayout.value}:type==='parrotCage'?{parrotCount:Number(selectParrots.value)}:{};close();onChoose?.(selected,options);}},'Разместить на плане');add.hidden=!onChoose;
  function select(next){if(viewer?.exporting)return;if(isCar(type)&&viewer?.vehicle())carStates.set(type,carOptions());type=next;const info=EXTRA_MODEL_INFO[type];
    if(isCar(type)){const state=carStates.get(type)||{color:info.color,dirt:type==='vestaSwCross2019'?0:.45,headlights:true,vehicleOpen:{}};carColor.value=state.color;carDirt.value=state.dirt*100;carLights.checked=state.headlights;carOpen={...state.vehicleOpen};for(const [key,{toggle,row}]of carToggles){row.hidden=!info.vehicleParts.includes(key);toggle.checked=Boolean(carOpen[key]);}}
    name.textContent=info.name;note.textContent=type==='woodShelfLow'?'Деревянный стеллаж высотой 120 см: три полки и сплошная верхняя крышка в цвет дерева.':type==='parrotCage'?'Один или два попугая прыгают между жердочками. Иногда появляются ноты, а изредка — %@?$.':type==='kallaxShelf'?'Сетка 4 × 4: 16 равных квадратных отсеков. У каждой ячейки своё хранение; содержимое появляется по заполненности.':type==='ivarRack'?'Открытый сосновый стеллаж с пятью досками, четырьмя зонами хранения и задней крестовиной. Содержимое зависит от заполненности.':type==='kitchenBase'?'Тот же нижний ряд кухни, без верхних шкафчиков. Столешница — 92 см; высота 116 см указана вместе со смесителем.':type==='hoodCabinet'?'Отдельный верхний шкаф с полками и встроенной вытяжкой. Этот тип также доступен для верхних модулей кухонного гарнитура.':type==='neonPorsche'?'Сине-розовый свет. В редакторе привязывается к ближайшей стене; высоту можно задать вручную.':type==='gamingDesktop'?'Единый RGB-комплект с привязкой к поверхности. Размер коврика — 80 × 35 см.':type==='ikeaFloorLamp'?'Высокий светящийся торшер в стиле IKEA, высота 160 см.':type==='printerCabinet'?'Столешница 50 × 50 см, по ширине обеих моделей принтера. Высота — 76 см. Внутри две полки.':['printer3dOpen','printer3dEnclosed'].includes(type)?'Ширина и глубина — 50 см. Установите на тумбочку высотой 76 см; для пола задайте высоту размещения 0.':info.fixedSize?'Один размер корпуса. Характеристики доступны в редакторе и карточке.':['simCockpit','simCockpitTriple'].includes(type)?'Кокпит без ПК, с внутренним хранилищем. Комплектация не меняет внешний вид.':type==='crossover'?'Универсальный кроссовер без марки. Модель для будущего раздела автомобиля.':'Модель для редактора квартиры. Размеры и цвет можно изменить.';selectLayout.hidden=type!=='tireStack';
    const dims=extraDimensions({type,layout:selectLayout.value});dimensions.textContent=`${dims.map(n=>Math.round(n*100)).join(' × ')} см · ширина × высота × глубина`;
    for(const [key,b]of buttons)b.setAttribute('aria-pressed',String(key===type));
    selectParrots.hidden=type!=='parrotCage';
    carControls.hidden=!isCar(type);
    bagControls.hidden=!BAG_TYPES.includes(type);
    if(BAG_TYPES.includes(type)){
      bagColor.value=bagColors[type]||info.color;updateSwatches();bagControls.append(exportCar);
      note.textContent=type==='duffel60'?'Багажная сумка на 60 л: стропы вокруг корпуса, две ручки, боковые захваты, молния и наружный карман.':type==='backpack20'?'Рюкзак на 20 л: мягкие лямки, спинка, передний и боковые карманы, верхняя ручка и утяжки.':'Дорожная сумка на 30 л: две ручки, плечевой ремень, молния, карман и усиленное дно.';
      dimensions.textContent=`${info.capacityLiters} л · ${dims.map(n=>Math.round(n*100)).join(' × ')} см с ручками`;
    }else carControls.append(exportCar);
    if(type==='trailSuv')note.textContent='Внедорожник по референсу: белая крыша, две байдарки, силовой бампер с лебёдкой и внедорожные колёса. Двери, багажник и капот открываются плавно. Фары освещают землю; сквозь тонированные стёкла виден салон. Внутри — отдельное хранение вещей.';
    if(type==='vestaSwCross2019'){note.textContent='Lada Vesta SW Cross 2019: дорестайлинговый универсал с обвесом Cross, рейлингами и двухцветными дисками. Открываются четыре двери, капот и багажник. Есть салон, смена цвета, фары и дорожная пыль.';dimensions.textContent='442 × 179 × 154 см · длина × ширина кузова × высота; с зеркалами — 205 см';}
    if(viewer){const height=viewer.show(type,{layout:selectLayout.value,parrotCount:Number(selectParrots.value),...(BAG_TYPES.includes(type)?{color:bagColor.value}:isCar(type)?carOptions():{})});controls.target.set(0,height*0.45,0);controls.update();viewer.render();}
  }
  selectLayout.onchange=()=>select(type);
  selectParrots.onchange=()=>select(type);
  host.append(h('header.mg-header',h('div',h('h1','Новые 3D-модели'),h('p',`${types.length} предметов · мебель, техника, хранение и симрейсинг`)),standalone?null:h('button.mg-btn',{type:'button',onclick:close},'Закрыть')),
    h('div.mg-layout',cards,h('section.mg-inspector',viewport,h('div.mg-info',name,dimensions,selectLayout,selectParrots,carControls,bagControls,note,h('p.mg-hint','Перетаскивайте модель для вращения · колесо для масштаба'),add))));
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
