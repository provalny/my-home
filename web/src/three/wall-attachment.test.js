import {test} from 'node:test';
import assert from 'node:assert/strict';
import {updateWallAttachments} from './wall-attachment.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<.00001,`${a} != ${b}`);
const room={id:'room',rect:[0,0,4,3]};
test('neon snaps to each wall with its illuminated face inside the room',()=>{
 for(const [pos,wall,rot]of [[[2,.1],'north',0],[[2,2.9],'south',180],[[.1,1.5],'west',90],[[3.9,1.5],'east',-90]]){
  const sign={id:'sign',type:'neonPorsche',pos,y:1.4};updateWallAttachments([sign],[room],{movingId:'sign'});assert.equal(sign.wallAttachment.wall,wall);assert.equal(sign.rot,rot);assert.equal(sign.y,1.4);
  assert.ok(sign.pos[0]>0&&sign.pos[0]<4&&sign.pos[1]>0&&sign.pos[1]<3);
 }
});
test('neon follows its saved wall when the room moves or shrinks and can detach',()=>{
 let sign={id:'sign',type:'neonPorsche',pos:[3.8,.1]};updateWallAttachments([sign],[room],{movingId:'sign'});sign=JSON.parse(JSON.stringify(sign));
 updateWallAttachments([sign],[{id:'room',rect:[5,6,2,3]}]);assert.equal(sign.wallAttachment.wall,'north');near(sign.pos[0],6.4);near(sign.pos[1],6.0325);
 sign.wallSnap=false;sign.pos=[8,8];updateWallAttachments([sign],[room]);assert.deepEqual(sign.pos,[8,8]);assert.equal(sign.wallAttachment,undefined);
});
test('a wall too short for the sign is skipped safely',()=>{
 const sign={id:'sign',type:'neonPorsche',pos:[0,0]};updateWallAttachments([sign],[{id:'tiny',rect:[0,0,.5,.5]}]);assert.equal(sign.wallAttachment,undefined);
});
