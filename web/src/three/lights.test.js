import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LightUnit} from './lights.js';
import {LIGHT_KINDS,LIGHT_INTENSITY_DEFAULTS,normalize} from '../config.js';
const cfg=(type,intensity)=>({id:'lamp',type,room:'room',pos:[1,1],capabilities:[],length:2.5,...(intensity==null?{}:{intensity})});
const state={on:true,brightness:1,temp:3200};
test('intensity scales real light output for all fixture types including strips with multiple emitters',()=>{
 for(const type of LIGHT_KINDS){
  const base=LIGHT_INTENSITY_DEFAULTS[type];
  for(const factor of [0,1,2.5,3]){
   const lamp=new LightUnit(cfg(type,base*factor),2.7);lamp.apply(state,{instant:true});
   const output=lamp.lights.reduce((s,l)=>s+l.intensity,0);
   assert.ok(Math.abs(output-base*factor)<1e-6,type+': '+output);
   if(!factor)assert.equal(lamp.glow[0].emissiveIntensity,0);
  }
  const lamp=new LightUnit(cfg(type),2.7);lamp.apply(state,{instant:true});
  assert.ok(Math.abs(lamp.lights.reduce((s,l)=>s+l.intensity,0)-base)<1e-6);
 }
});
test('lamp intensity survives plan serialization; negative and nonfinite values are rejected',()=>{
 const raw={rooms:[{id:'room',rect:[0,0,4,4]}],lights:LIGHT_KINDS.map((type,i)=>({...cfg(type,LIGHT_INTENSITY_DEFAULTS[type]*2),id:'lamp-'+i}))};
 const copy=normalize(JSON.parse(JSON.stringify(raw)));assert.deepEqual(copy.lights.map(l=>l.intensity),raw.lights.map(l=>l.intensity));
 for(const intensity of [-1,Infinity,NaN,'2'])assert.throws(()=>normalize({...raw,lights:[cfg('table',intensity)]}),/интенсивность/);
});
