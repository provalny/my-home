import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ghostOpacity, installWallGhost } from './wall-ghost.js';
test('wall opacity increases smoothly away from the cursor and returns when it leaves',()=>{
  assert.equal(ghostOpacity(0),.06000000000000005);assert.ok(ghostOpacity(.1)<ghostOpacity(.2));assert.equal(ghostOpacity(.3),1);assert.equal(ghostOpacity(0,0),1);
  const material=new THREE.MeshStandardMaterial({color:'#fff'}),a=new THREE.Mesh(new THREE.BoxGeometry(),material),b=a.clone(),before=a.position.toArray(),effect=installWallGhost([a,b]);
  assert.notEqual(a.material,material);assert.equal(a.material,b.material);assert.equal(material.transparent,false);assert.equal(a.material.depthWrite,false);assert.deepEqual(a.position.toArray(),before);
  const shader={uniforms:{},fragmentShader:'#include <opaque_fragment>'};a.material.onBeforeCompile(shader);effect.resize(800,600);effect.move(.5,.5);effect.update(1);assert.ok(shader.uniforms.wallStrength.value>.99);assert.deepEqual(shader.uniforms.wallResolution.value.toArray(),[800,600]);effect.leave();effect.update(1);assert.equal(shader.uniforms.wallStrength.value,0);assert.match(shader.fragmentShader,/smoothstep/);
  a.geometry.dispose();a.material.dispose();material.dispose();
});
