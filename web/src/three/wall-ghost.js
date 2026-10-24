import * as THREE from 'three';

export const ghostOpacity=(distance,strength=1,radius=.24)=>1-.94*Math.max(0,Math.min(1,strength))*(1-THREE.MathUtils.smoothstep(distance,.015,radius));
// Only the wall materials are cloned. Camera targets, geometry, picking and
// shadow casters retain their original behavior.
export function installWallGhost(walls) {
  const pointer={value:new THREE.Vector2(-10,-10)},resolution={value:new THREE.Vector2(1,1)},strength={value:0},clones=new Map();let goal=0;
  const clone=original=>{
    if(clones.has(original))return clones.get(original);
    const material=original.clone();material.transparent=true;material.depthWrite=false;
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{wallPointer:pointer,wallResolution:resolution,wallStrength:strength});
      shader.fragmentShader='uniform vec2 wallPointer;\nuniform vec2 wallResolution;\nuniform float wallStrength;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`vec2 wallDelta = (gl_FragCoord.xy / wallResolution - wallPointer) * vec2(wallResolution.x / wallResolution.y, 1.0);
      diffuseColor.a *= 1.0 - 0.94 * wallStrength * (1.0 - smoothstep(0.015, 0.24, length(wallDelta)));
      #include <opaque_fragment>`);
    };
    material.customProgramCacheKey=()=> 'inventory-wall-ghost-v1';clones.set(original,material);return material;
  };
  for(const wall of walls)wall.material=Array.isArray(wall.material)?wall.material.map(clone):clone(wall.material);
  return {
    move(x,y){pointer.value.set(x,1-y);goal=1;},leave(){goal=0;},
    resize(width,height){resolution.value.set(width,height);},
    update(dt,instant=false){const before=strength.value;strength.value=instant?goal:THREE.MathUtils.lerp(before,goal,1-Math.exp(-dt*12));if(Math.abs(goal-strength.value)<.001)strength.value=goal;return Math.abs(before-strength.value)>.00001;},
  };
}
