// Collect once when a scene is created. Hidden furniture and reduced motion stay still.
export function collectFurnitureAnimators(root){
 const animators=[];root.traverse(object=>{if(typeof object.userData.furnitureAnimate==='function')animators.push(object);});return animators;
}
export function animateFurniture(animators,time,{reduceMotion=false}={}){
 let active=false;
 for(const object of animators){
  let visible=true;for(let p=object;p;p=p.parent)if(!p.visible){visible=false;break;}
  if(!visible)continue;
  const moving=object.userData.furnitureAnimate(reduceMotion?0:time,{reduceMotion});
  active||=!reduceMotion&&moving!==false;
 }
 return active;
}
