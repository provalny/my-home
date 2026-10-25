// A cached, deliberately out-of-focus city. No photos, geolocation or extra requests.
const noise=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n);};
export function cozyAtmosphere(weather,theme='dark') {
  const hour=Number(weather?.time?.slice(11,13));
  const hasCityHour=Boolean(weather?.time)&&Number.isInteger(hour)&&hour>=0&&hour<24;
  const localHour=hasCityHour?hour:new Date().getHours();
  const period=!hasCityHour&&weather?.day!=null?(weather.day?'day':'night'):localHour<6||localHour>=21?'night':localHour<9?'morning':localHour>=17?'evening':'day';
  const day=weather?.day??(theme==='light'),kind=weather?.kind||'clouds';
  const palette={night:['#101a31','#24304a','#312c47'],morning:['#54657a','#a899a0','#bd9e8e'],day:['#7894a7','#a9b3b9','#bbbec0'],evening:['#313b61','#825e75','#a67567']}[period];
  return {day,kind,period,sky:palette,far:day?'#596b7d':'#1e2a43',near:day?'#394b61':'#111c33',windows:day?.3:.9};
}
export function paintExteriorSky(ctx,width,height,atmosphere) {
  const sky=ctx.createLinearGradient(0,0,0,height);
  sky.addColorStop(0,atmosphere.sky[0]);sky.addColorStop(.62,atmosphere.sky[1]);sky.addColorStop(1,atmosphere.sky[2]);
  ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
}
export function paintCozyBackdrop(ctx,width,height,atmosphere) {
  if(width<1||height<1)return;
  ctx.clearRect(0,0,width,height);paintExteriorSky(ctx,width,height,atmosphere);
  ctx.save();
  // Buildings and lit windows live in a half-resolution cache, then blur once
  // when composited by the weather scene. Their geometry never animates.
  for(let layer=0;layer<2;layer++) {
    const count=layer?15:26,base=height*(layer ? .96 : .83),unit=width/count;
    ctx.globalAlpha=layer ? .58 : .36;ctx.fillStyle=layer?atmosphere.near:atmosphere.far;
    for(let i=0;i<count;i++) {
      const x=i*unit-unit*.1,h=height*(.12+noise(i+layer*101)*.32),w=unit*(.72+noise(i+80)*.32);
      ctx.fillRect(x,base-h,w,h+height*.2);
      for(let row=0;row<9;row++)for(let col=0;col<3;col++)if(noise(i*73+row*7+col+layer*700)>.57) {
        ctx.fillStyle=noise(i*37+row*11+col)>.8?'#b9d9fa':'#ffd396';ctx.globalAlpha=atmosphere.windows*(layer ? .85 : .65);
        ctx.fillRect(x+w*(.16+col*.27),base-h+h*(.1+row*.095),Math.max(.7,w*.085),Math.max(.7,height*.006));
        ctx.fillStyle=layer?atmosphere.near:atmosphere.far;ctx.globalAlpha=layer ? .58 : .38;
      }
    }
  }
  const haze=ctx.createLinearGradient(0,height*.35,0,height);
  haze.addColorStop(0,'#ffffff00');haze.addColorStop(.55,atmosphere.sky[1]+'35');haze.addColorStop(1,atmosphere.sky[2]+'77');
  ctx.globalAlpha=1;ctx.fillStyle=haze;ctx.fillRect(0,0,width,height);
  ctx.restore();
}
export function paintNeighbourhoodLights(ctx,width,height,time,atmosphere) {
  ctx.save();
  for(let i=0;i<6;i++) {
    const x=noise(i+600)*width,y=height*(.58+noise(i+630)*.36),r=7+noise(i+660)*11;
    const light=ctx.createRadialGradient(x,y,0,x,y,r);
    light.addColorStop(0,'#ffe3ad');light.addColorStop(.14,'#ffc77399');light.addColorStop(1,'#ffc77300');
    ctx.globalAlpha=(atmosphere.day ? .09 : .32)*(.9+.1*Math.sin(time*.25+i));ctx.fillStyle=light;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  ctx.restore();
}
