import {test} from 'node:test';
import assert from 'node:assert/strict';
import {carAtmosphere,createCarLandscape} from './landscape.js';

const at=(iso,latitude=55,weather={})=>carAtmosphere({now:Date.parse(iso),city:{latitude},weather:{utcOffsetSeconds:0,...weather}});
test('landscape seasons follow the city calendar and reverse across hemispheres',()=>{
 for(const [month,north,south] of [['01','winter','summer'],['04','spring','autumn'],['07','summer','winter'],['10','autumn','spring'],['12','winter','summer']]){
  assert.equal(at(`2026-${month}-15T12:00:00Z`).season,north);assert.equal(at(`2026-${month}-15T12:00:00Z`,-34).season,south);
 }
 assert.equal(at('2026-02-28T23:30:00Z',55,{utcOffsetSeconds:3*3600}).season,'spring');
 assert.equal(at('2026-03-01T01:00:00Z',55,{utcOffsetSeconds:-5*3600}).season,'winter');
});
test('local sunrise and sunset drive lighting instead of the device theme or timezone',()=>{
 const solar={sunrise:'2026-10-25T08:00',sunset:'2026-10-25T17:00',utcOffsetSeconds:3*3600};
 assert.equal(at('2026-10-25T05:15:00Z',55,solar).period,'dawn');
 assert.equal(at('2026-10-25T10:00:00Z',55,solar).period,'day');
 assert.equal(at('2026-10-25T14:15:00Z',55,solar).period,'dusk');
 assert.equal(at('2026-10-25T19:00:00Z',55,solar).period,'night');
 assert.equal(at('2026-12-15T13:00:00Z',78,{day:false}).period,'night');
 const cityTime=carAtmosphere({now:Date.parse('2026-10-25T01:00:00Z'),weather:{time:'2026-10-25T12:00',fetchedAt:Date.parse('2026-10-25T01:00:00Z')}});
 assert.equal(cityTime.hour,12);assert.equal(cityTime.period,'day');
 assert.doesNotThrow(()=>carAtmosphere({weather:{utcOffsetSeconds:1e50,time:'2026-99-99T99:99'}}));
});
test('weather changes precipitation, haze, snow cover and vehicle lighting without changing the season',()=>{
 const clear=at('2026-10-25T12:00:00Z'),rain=at('2026-10-25T12:00:00Z',55,{code:65}),snow=at('2026-10-25T12:00:00Z',55,{code:73,temperature:-1});
 assert.equal(rain.kind,'rain');assert.equal(rain.wet,true);assert.equal(rain.season,'autumn');assert.notDeepEqual(rain.sky,clear.sky);assert.ok(rain.keyIntensity<clear.keyIntensity);
 assert.equal(snow.kind,'snow');assert.equal(snow.snow,true);assert.equal(snow.season,'autumn');assert.notDeepEqual(snow.grass,clear.grass);
 assert.equal(at('2026-07-15T12:00:00Z').snow,false);assert.equal(at('2026-01-15T12:00:00Z').snow,true);
 assert.equal(at('2026-01-15T12:00:00Z',55,{temperature:10,kind:'rain'}).snow,false);
});

test('scenery caches the blur, bounds resolution and pauses decorative weather under reduced motion',()=>{
 const oldDocument=globalThis.document,oldObserver=globalThis.ResizeObserver,canvases=[],callbacks=[];let reduced=false;
 const makeCanvas=()=>{const calls=[],context={calls};for(const key of ['clearRect','fillRect','save','restore','beginPath','moveTo','lineTo','closePath','fill','stroke','arc','strokeRect','bezierCurveTo','drawImage'])context[key]=(...args)=>calls.push([key,...args]);for(const key of ['createLinearGradient','createRadialGradient'])context[key]=()=>({addColorStop(){}});const c={width:0,height:0,getContext:()=>context,setAttribute(){},remove(){this.removed=true;},context};canvases.push(c);return c;};
 globalThis.document={createElement:makeCanvas};globalThis.ResizeObserver=class{constructor(cb){callbacks.push(cb);}observe(){}disconnect(){this.disconnected=true;}};
 const host={dataset:{},prepend(){},getBoundingClientRect:()=>({width:2400,height:1500})};
 try{
  const backdrop=createCarLandscape(host,{reducedMotion:()=>reduced});assert.ok(canvases[0].width<=960);assert.ok(canvases[0].height<=640);
  const now=Date.parse('2026-10-25T12:00:00Z');backdrop.update({kind:'rain',utcOffsetSeconds:0,fetchedAt:now},{latitude:55});
  backdrop.render(0,now);const backgroundPaints=canvases[0].context.calls.length,fxPaints=canvases[1].context.calls.filter(c=>c[0]==='clearRect').length;
  for(let i=1;i<=60;i++)backdrop.render(i/60,now);
  assert.equal(canvases[0].context.calls.length,backgroundPaints);assert.ok(canvases[1].context.calls.filter(c=>c[0]==='clearRect').length-fxPaints<=16);
  reduced=true;const stopped=canvases[1].context.calls.length;backdrop.render(2,now);backdrop.render(3,now);assert.equal(canvases[1].context.calls.length,stopped);
  backdrop.dispose();assert.equal(canvases[0].removed,true);assert.equal(canvases[1].removed,true);
 }finally{globalThis.document=oldDocument;globalThis.ResizeObserver=oldObserver;}
});
