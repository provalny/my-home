import {weatherKind} from '../inventory/weather.js';

const noise=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n);};
const mix=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
const SEASONS={
 spring:{grass:['#717f4e','#a4ab68','#3e654d'],trees:['#56766b','#3d6156','#24483d'],mountain:'#778994',ground:'#7c8959'},
 summer:{grass:['#8b9552','#b1a768','#4e7048'],trees:['#55746b','#35594f','#203f37'],mountain:'#7b8795',ground:'#95915b'},
 autumn:{grass:['#b48048','#d9a05c','#805c3c'],trees:['#66756c','#405951','#2c443d'],mountain:'#8a8196',ground:'#ad8356'},
 winter:{grass:['#c0cfda','#e0e7e8','#9aafbb'],trees:['#6b8990','#496972','#304f5c'],mountain:'#9eafc4',ground:'#c4d2db'},
};
function localDate(weather,now){
 if(Number.isFinite(weather?.utcOffsetSeconds)&&Math.abs(weather.utcOffsetSeconds)<=14*3600)return new Date(now+weather.utcOffsetSeconds*1000);
 if(/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(weather?.time||'')){
  const elapsed=Number.isFinite(weather.fetchedAt)?Math.max(0,now-weather.fetchedAt):0;
  const instant=Date.parse(weather.time.slice(0,16)+'Z')+elapsed;if(Number.isFinite(instant))return new Date(instant);
 }
 const d=new Date(now);return new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate(),d.getHours(),d.getMinutes()));
}
const minutes=iso=>/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(iso||'')?Number(iso.slice(11,13))*60+Number(iso.slice(14,16)):null;

export function carAtmosphere({weather=null,city=null,now=Date.now()}={}){
 const local=localDate(weather,now),month=local.getUTCMonth(),hour=local.getUTCHours()+local.getUTCMinutes()/60;
 const season=['winter','spring','summer','autumn'][Math.floor((((month+(city?.latitude<0?6:0))%12)+1)%12/3)];
 const kind=weather?.kind|| (Number.isInteger(weather?.code)?weatherKind(weather.code):'clear');
 const rise=minutes(weather?.sunrise),set=minutes(weather?.sunset),clock=hour*60;
 let period;
 if(rise!=null&&set!=null&&set>rise){period=Math.abs(clock-rise)<65?'dawn':Math.abs(clock-set)<75?'dusk':clock>rise&&clock<set?'day':'night';}
 else period=weather?.day===false?'night':hour<5||hour>=21?'night':hour<8?'dawn':hour>=17?'dusk':'day';
 const night=period==='night',wet=['rain','storm','fog'].includes(kind),snow=(season==='winter'||kind==='snow')&&(weather?.temperature??0)<=3;
 const colors=snow?SEASONS.winter:SEASONS[season==='winter'?'autumn':season],dim=c=>mix(c,night?'#122135':period==='dusk'?'#b76f66':period==='dawn'?'#cc9b87':'#9baaba',night?.67:wet?.38:period==='dusk'?.19:period==='dawn'?.14:0);
 let sky={night:['#0a1429','#29344d','#6d626b'],dawn:['#596782','#bf9097','#f8c992'],day:['#648dab','#b4c3cb','#e7d7af'],dusk:['#45476e','#b06c80','#f9bc83']}[period];
 if(wet||kind==='clouds'||kind==='snow')sky=sky.map(c=>mix(c,night?'#253147':'#89969f',kind==='storm'?.68:wet?.52:.28));
 return {season,period,kind,snow,night,wet,hour,sky,grass:colors.grass.map(dim),trees:colors.trees.map(dim),mountain:dim(colors.mountain),ground:dim(colors.ground),
  keyColor:night?'#b9d3f4':wet?'#d9e6f1':period==='day'?'#ffe9c2':'#ffc891',keyIntensity:night?1.15:wet?1.8:3,
  signature:[season,period,kind,snow].join(':')};
}
const polygon=(ctx,points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
function pine(ctx,x,y,size,color,snow){
 ctx.fillStyle=mix(color,'#171f29',.25);ctx.fillRect(x-size*.025,y-size*.1,size*.05,size*.18);
 for(let j=0;j<5;j++){
  const top=y-size+j*size*.145,half=size*(.10+j*.031);
  polygon(ctx,[[x,top],[x-half,top+size*.30],[x+half,top+size*.30]],color);
  if(snow)polygon(ctx,[[x,top],[x-half*.72,top+size*.21],[x+half*.15,top+size*.14]],mix(color,'#e7f0f3',.72));
 }
}
function tower(ctx,w,h,a){
 const x=w*.825,base=h*.635,top=h*.367,size=Math.min(w*.088,h*.18),wood=mix(a.trees[2],a.night?'#172338':'#b38a70',.55);
 ctx.strokeStyle=wood;ctx.lineWidth=Math.max(1,w*.002);ctx.beginPath();
 for(const side of [-1,1]){ctx.moveTo(x+side*size*.35,top+size*.5);ctx.lineTo(x+side*size*.52,base);}
 for(let j=0;j<3;j++){const y1=top+size*.5+(base-top-size*.5)*j/3,y2=top+size*.5+(base-top-size*.5)*(j+1)/3;ctx.moveTo(x-size*.44,y1);ctx.lineTo(x+size*.44,y2);ctx.moveTo(x+size*.44,y1);ctx.lineTo(x-size*.44,y2);}
 ctx.moveTo(x+size*.55,base);ctx.lineTo(x+size*.95,top+size*.6);ctx.lineTo(x+size*.55,top+size*.6);ctx.stroke();
 polygon(ctx,[[x-size*.64,top+size*.48],[x+size*.7,top+size*.48],[x+size*.7,top+size*.57],[x-size*.64,top+size*.57]],wood);
 polygon(ctx,[[x-size*.48,top],[x+size*.46,top],[x+size*.46,top+size*.46],[x-size*.48,top+size*.46]],a.trees[2]);
 ctx.fillStyle=a.night?'#f7b969':'#b4b7ae';ctx.globalAlpha=a.night?.8:.55;
 for(let j=0;j<3;j++)ctx.fillRect(x-size*.35+j*size*.25,top+size*.08,size*.17,size*.17);ctx.globalAlpha=1;
 polygon(ctx,[[x-size*.63,top],[x-size*.10,top-size*.16],[x+size*.62,top],[x+size*.46,top+size*.06]],mix(wood,'#151e2b',.42));
 ctx.lineWidth=Math.max(.7,w*.001);ctx.strokeStyle=wood;ctx.strokeRect(x-size*.65,top+size*.35,size*1.36,size*.15);
}

// Painted once per atmosphere/size change, then lightly blurred in its cache.
export function paintCarLandscape(ctx,w,h,a){
 const sky=ctx.createLinearGradient(0,0,0,h);a.sky.forEach((c,i)=>sky.addColorStop(i/2,c));ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 const warm=a.period==='dawn'||a.period==='dusk',sunX=w*.25,sunY=h*(warm?.37:.18);
 if(!a.wet&&a.kind!=='clouds'&&a.kind!=='snow'){
  const glow=ctx.createRadialGradient(sunX,sunY,2,sunX,sunY,w*.42);glow.addColorStop(0,a.night?'#c5d9ef25':'#ffe2ad9a');glow.addColorStop(1,'#ffe2ad00');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  ctx.fillStyle=a.night?'#d7e1ec':'#ffe9bb';ctx.beginPath();ctx.arc(sunX,sunY,h*(a.night?.027:.04),0,Math.PI*2);ctx.fill();
 }
 if(a.night&&!a.wet&&a.kind==='clear'){ctx.fillStyle='#d9e5f2';for(let i=0;i<40;i++){ctx.globalAlpha=.18+noise(i+90)*.45;ctx.fillRect(noise(i+10)*w,noise(i+50)*h*.48,1+noise(i),1+noise(i));}ctx.globalAlpha=1;}
 for(let layer=0;layer<3;layer++){
  const count=9,points=[[-w*.1,h]],ridge=[];
  for(let i=0;i<=count;i++){const x=(i/count*1.2-.1)*w,y=h*(.22+layer*.105+noise(i+layer*31)*.22);ridge.push([x,y]);}
  const mountain=mix(a.mountain,a.sky[1],.5-layer*.16);points.push(...ridge,[w*1.1,h]);polygon(ctx,points,mountain);
  for(let i=1;i<ridge.length-1;i++){
   const [x,y]=ridge[i],next=ridge[i+1];
   polygon(ctx,[[x,y],[next[0],next[1]],[x+(next[0]-x)*.32,h*(.64+layer*.08)]],mix(mountain,a.night?'#132135':'#343c61',.12+noise(i+layer)*.14));
   if(a.snow||layer===0&&i%3===0)polygon(ctx,[[x,y],[x-w*.023,y+h*.07],[x+w*.011,y+h*.046],[x+w*.028,y+h*.08]],mix(mountain,'#e5e5e4',a.snow?.72:.37));
  }
 }
 const valley=ctx.createLinearGradient(0,h*.43,0,h*.75);valley.addColorStop(0,a.sky[1]+'00');valley.addColorStop(.65,a.sky[1]+'75');valley.addColorStop(1,a.sky[1]+'00');ctx.fillStyle=valley;ctx.fillRect(0,h*.42,w,h*.38);
 for(let layer=0;layer<2;layer++)for(let i=0;i<26;i++){
  const x=w*(i/25+noise(i+layer*80)*.025),y=h*(.64+layer*.045+noise(i+55)*.025),size=h*(.065+noise(i+layer*210)*.11);
  pine(ctx,x,y,size,a.trees[layer],a.snow);
 }
 const land=ctx.createLinearGradient(0,h*.61,0,h);land.addColorStop(0,a.grass[1]);land.addColorStop(.45,a.grass[0]);land.addColorStop(1,a.grass[2]);
 ctx.beginPath();ctx.moveTo(0,h*.65);ctx.bezierCurveTo(w*.3,h*.56,w*.62,h*.70,w,h*.63);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fillStyle=land;ctx.fill();
 tower(ctx,w,h,a);
 const clearing=ctx.createRadialGradient(w*.5,h*.83,h*.02,w*.5,h*.83,w*.4);clearing.addColorStop(0,a.ground+'80');clearing.addColorStop(1,a.ground+'00');ctx.fillStyle=clearing;ctx.fillRect(0,h*.65,w,h*.35);
 for(let i=0;i<1000;i++){
  const y=h*(.66+noise(i+900)*.40),x=noise(i+1000)*w,p=(y/h-.64)/.36,length=h*(a.snow?.002+.009*noise(i):.009+noise(i+1100)*.06)*(.1+p),bend=length*(noise(i+1200)-.3);
  const inClearing=Math.abs(x/w-.5)<.14&&y<h*.86;
  if(inClearing&&noise(i)>.15||a.snow&&noise(i)>.1)continue;
  polygon(ctx,[[x,y],[x+bend,y-length],[x+length*.20,y]],i%3?a.grass[2]:a.grass[1]);
  if(a.season==='spring'&&!a.snow&&i%19===0){ctx.fillStyle=i%2?'#e7c4b1':'#e5d491';ctx.fillRect(x+bend,y-length,1.5,1.5);}
 }
 for(const [x,size]of [[-.012,.48],[1.015,.40]])pine(ctx,w*x,h*.79,h*size,a.trees[2],a.snow);
 if(a.wet||a.kind==='snow'||a.kind==='clouds'){
  const haze=ctx.createLinearGradient(0,h*.18,0,h*.83);haze.addColorStop(0,a.sky[1]+'00');haze.addColorStop(.55,a.sky[1]+(a.kind==='fog'?'a5':'35'));haze.addColorStop(1,a.sky[1]+'00');ctx.fillStyle=haze;ctx.fillRect(0,0,w,h);
 }
 const shade=ctx.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#07132238');shade.addColorStop(.28,'#07132200');shade.addColorStop(.8,'#07132200');shade.addColorStop(1,'#07132265');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
}

export function paintCarWeather(ctx,w,h,a,time){
 ctx.clearRect(0,0,w,h);
 const snow=a.kind==='snow',rain=a.kind==='rain'||a.kind==='storm';
 if(rain||snow){
  ctx.strokeStyle=a.night?'#ccdeed67':'#ddecf58c';ctx.fillStyle=a.night?'#e3edf0b0':'#f4f8f3d0';ctx.lineWidth=.75;
  for(let i=0;i<(snow?50:72);i++){
   const y=(noise(i+101)*h+time*(snow?15+noise(i)*14:210+noise(i)*100))%(h+25)-12;
   const x=(noise(i+202)*w+time*(snow?7:23)+Math.sin(time*.7+i)*(snow?9:0))%(w+20)-10;
   ctx.beginPath();if(snow){ctx.arc(x,y,.7+noise(i+404)*1.7,0,Math.PI*2);ctx.fill();}else{ctx.moveTo(x,y);ctx.lineTo(x+2,y+9+noise(i+303)*9);ctx.stroke();}
  }
 }else if(['fog','clouds'].includes(a.kind)){
  for(let i=0;i<2;i++){const x=(w*(.2+i*.6)+time*(1.2+i))%(w*1.3)-w*.15,y=h*(.28+i*.18),r=w*.35,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,a.sky[1]+'24');g.addColorStop(1,a.sky[1]+'00');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
 }
}

// Two bounded 2D layers, no extra WebGL scene, render loop or live blur pass.
export function createCarLandscape(host,{reducedMotion=()=>false}={}){
 const background=document.createElement('canvas'),fx=document.createElement('canvas'),cache=document.createElement('canvas');
 background.className='au-landscape-canvas';fx.className='au-weather-canvas';for(const c of [background,fx])c.setAttribute('aria-hidden','true');host.prepend(background,fx);
 const ctx=background.getContext('2d'),effects=fx.getContext('2d'),painter=cache.getContext('2d');
 let weather=null,city=null,width=0,height=0,key='',lastMinute=-1,lastFrame=-1,atmosphere=carAtmosphere();
 function paint(now=Date.now()){
  lastMinute=Math.floor(now/60000);atmosphere=carAtmosphere({weather,city,now});
  host.dataset.carSeason=atmosphere.season;host.dataset.carWeather=atmosphere.kind;host.dataset.carPeriod=atmosphere.period;
  const next=[width,height,atmosphere.signature].join(':');if(next===key||!width||!height||!ctx||!painter)return;key=next;
  cache.width=width;cache.height=height;paintCarLandscape(painter,width,height,atmosphere);
  ctx.clearRect(0,0,width,height);ctx.filter='blur(1.35px)';ctx.drawImage(cache,-2,-2,width+4,height+4);ctx.filter='none';
  if(effects)paintCarWeather(effects,width,height,atmosphere,0);lastFrame=-1;
 }
 function resize(){const r=host.getBoundingClientRect(),scale=Math.min(1,960/Math.max(1,r.width),640/Math.max(1,r.height));width=Math.max(1,Math.round(r.width*scale));height=Math.max(1,Math.round(r.height*scale));for(const c of [background,fx]){c.width=width;c.height=height;}key='';paint();}
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 return {update(value,location){weather=value;city=location;paint();return atmosphere;},render(time,now=Date.now()){
  if(Math.floor(now/60000)!==lastMinute)paint(now);
  if(effects&&width&&height&&['rain','storm','snow','clouds','fog'].includes(atmosphere.kind)&&!reducedMotion()&&time-lastFrame>=1/16){paintCarWeather(effects,width,height,atmosphere,time);lastFrame=time;}return atmosphere;
 },dispose(){observer.disconnect();background.remove();fx.remove();cache.width=cache.height=1;}};
}
