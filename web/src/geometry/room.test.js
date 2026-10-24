import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roomPoints,roomContains,validateContour,roomInteriorPoint} from './room.js';
import {normalize} from '../config.js';
import {floorGeometry} from '../three/kit.js';
import {wallSegments} from '../three/house.js';
const notch=[[0,0],[.75,0],[.75,.25],[1,.25],[1,1],[0,1]];
const room={id:'room',rect:[0,0,4,4],contour:notch};
const plan=rooms=>({rooms,openings:[],furniture:[],lights:[],acs:[]});
test('notched floors exclude the ventilation footprint and preserve contour through normalizing',()=>{
  validateContour(notch);assert.equal(roomContains(room,[3.5,.5]),false);assert.equal(roomContains(room,[2,2]),true);
  const cfg=normalize(JSON.parse(JSON.stringify(plan([room]))));assert.deepEqual(cfg.rooms[0].contour,notch);
  const geo=floorGeometry(cfg.rooms[0]),pos=geo.attributes.position,index=geo.index;let area=0;
  for(let i=0;i<index.count;i+=3){const ps=[0,1,2].map(j=>{const k=index.getX(i+j);return [pos.getX(k),pos.getZ(k)];});
    area+=Math.abs((ps[1][0]-ps[0][0])*(ps[2][1]-ps[0][1])-(ps[2][0]-ps[0][0])*(ps[1][1]-ps[0][1]))/2;
    const c=[ps.reduce((s,p)=>s+p[0],0)/3,ps.reduce((s,p)=>s+p[1],0)/3];assert.ok(roomContains(room,c));
  }assert.equal(area,15);geo.dispose();
});
test('bevel has a diagonal wall, no phantom rectangle edges and correct outward normals',()=>{
  const r={...room,contour:[[0,0],[.75,0],[1,.25],[1,1],[0,1]]};
  const walls=wallSegments(normalize(plan([r])));assert.equal(walls.length,5);
  const diagonal=walls.find(s=>Math.abs(s.ux)>.1&&Math.abs(s.uz)>.1);assert.ok(diagonal);assert.ok(diagonal.outX>0&&diagonal.outZ<0);
  assert.equal(roomContains(r,[3.9,.1]),false);
});
test('shared walls are emitted once and openings split a shared wall',()=>{
  const cfg=normalize(plan([{id:'a',rect:[0,0,4,4]},{id:'b',rect:[4,0,4,4]}]));
  cfg.openings=[{type:'door',from:[4,1],to:[4,2]}];
  const shared=wallSegments(cfg).filter(s=>s.kind==='interior');assert.equal(shared.length,3);
  assert.equal(shared.filter(s=>s.opening?.type==='door').length,1);
  assert.equal(shared.reduce((sum,s)=>sum+s.b-s.a,0),4);
});
test('self crossings, repeated vertices, backtracking and invalid coordinates are rejected',()=>{
  for(const contour of [[[0,0],[1,1],[0,1],[1,0]],[[0,0],[1,0],[1,0],[0,1]],[[0,0],[1,0],[.5,0],[1,1],[0,1]],[[0,0],[2,0],[0,1]]])assert.throws(()=>validateContour(contour));
  assert.deepEqual(validateContour(notch.slice().reverse()),notch.slice().reverse());
});
test('moving and resizing the room transforms every contour vertex and keeps a valid placement point',()=>{
  const moved={...room,rect:[10,-5,8,2]};assert.deepEqual(roomPoints(moved)[1],[16,-5]);
  assert.ok(roomContains(moved,roomInteriorPoint(moved)));
  assert.equal(roomContains(moved,[17,-4.9]),false);
});
