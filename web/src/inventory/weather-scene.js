// An exterior layer behind the WebGL canvas. A projected silhouette excludes
// precipitation from the apartment even where a wall becomes transparent.
export function convexHull(points){
  const sorted=points.filter(p=>p.every(Number.isFinite)).slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(sorted.length<3)return sorted;
  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const half=list=>{const h=[];for(const p of list){while(h.length>1&&cross(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}return h;};
  return [...half(sorted).slice(0,-1),...half(sorted.slice().reverse()).slice(0,-1)];
}
const noise=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n);};
export function createWeatherScene(host,{reducedMotion=false}={}){
  const canvas=document.createElement('canvas');canvas.className='iv-weather-canvas';canvas.setAttribute('aria-hidden','true');host.prepend(canvas);
  const ctx=canvas.getContext('2d');let weather=null,mask=[],width=1,height=1,raf=0,running=true,time=0,last=0;
  function draw(){if(!ctx||width<1||height<1)return;ctx.clearRect(0,0,width,height);if(!weather)return;
    const day=weather.day,kind=weather.kind,gradient=ctx.createLinearGradient(0,0,0,height);
    const colors=kind==='snow'?(day?['#7c9db8','#d3dce4']:['#152438','#384d64']):kind==='rain'||kind==='storm'?(day?['#344f70','#8497ab']:['#101c33','#263a52']):day?['#75abdb','#c6dbe7']:['#0d1730','#243750'];
    gradient.addColorStop(0,colors[0]);gradient.addColorStop(1,colors[1]);ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
    // Everything moving is clipped outside the projected model, including clouds.
    ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);if(mask.length>2){ctx.moveTo(...mask[0]);for(const p of mask.slice(1))ctx.lineTo(...p);ctx.closePath();}ctx.clip('evenodd');
    if(kind==='clear'&&day){const sx=width*(.82+Math.sin(time*.08)*.025),sy=height*(.14+Math.cos(time*.07)*.02),sun=ctx.createRadialGradient(sx,sy,2,sx,sy,width*(.3+Math.sin(time*.15)*.015));sun.addColorStop(0,'#fff3c666');sun.addColorStop(1,'#fff3c600');ctx.fillStyle=sun;ctx.fillRect(0,0,width,height);}
    if(!day&&kind==='clear'){ctx.fillStyle='#e6eeff99';for(let i=0;i<45;i++){const x=noise(i+1)*width,y=noise(i+60)*height;ctx.globalAlpha=(.3+.5*noise(i+90))*(.8+.2*Math.sin(time*.5+i));ctx.fillRect(x,y,1.2,1.2);}ctx.globalAlpha=1;}
    if(['clouds','fog','rain','storm','snow'].includes(kind))for(let i=0;i<6;i++){
      const x=((noise(i+10)*1.5*width+time*(3+i))%(width*1.6))-width*.3,y=noise(i+20)*height*.7,r=width*(.13+noise(i+30)*.12),cloud=ctx.createRadialGradient(x,y,0,x,y,r);
      cloud.addColorStop(0,day?'#eff5ff28':'#9aaec022');cloud.addColorStop(1,'#aabbcc00');ctx.fillStyle=cloud;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
    if(['rain','storm','snow'].includes(kind)){
      const snow=kind==='snow',count=snow?70:100;ctx.strokeStyle=day?'#d5eaff99':'#abc9e36b';ctx.fillStyle=day?'#ffffffbf':'#deeeffb0';ctx.lineWidth=.8;
      for(let i=0;i<count;i++){
        const speed=snow?12+noise(i+300)*17:170+noise(i+300)*130;
        const y=(noise(i+100)*height+time*speed)%(height+30)-15;
        const x=(noise(i+200)*width+time*(snow?8:20)+Math.sin(time+i)* (snow?9:0))%width;
        if(snow){ctx.beginPath();ctx.arc(x,y,1+noise(i+400)*1.8,0,Math.PI*2);ctx.fill();}
        else {ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+2,y+9+noise(i+400)*8);ctx.stroke();}
      }
    }
    ctx.restore();
  }
  function frame(now){raf=0;if(!running||!weather)return;time+=Math.min(.05,(now-last)/1000);last=now;draw();if(!reducedMotion)raf=requestAnimationFrame(frame);}
  function wake(){draw();if(!raf&&running&&weather&&!reducedMotion){last=performance.now();raf=requestAnimationFrame(frame);}}
  function resize(){const r=host.getBoundingClientRect(),ratio=Math.min(globalThis.devicePixelRatio||1,2);width=r.width;height=r.height;canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));ctx?.setTransform(ratio,0,0,ratio,0,0);wake();}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  return {setWeather(value){weather=value;host.classList.toggle('has-weather',Boolean(value));wake();},setMask(points){mask=convexHull(points);if(reducedMotion)draw();},setRunning(on){running=on;if(!on&&raf){cancelAnimationFrame(raf);raf=0;}else wake();},dispose(){running=false;if(raf)cancelAnimationFrame(raf);observer.disconnect();canvas.remove();}};
}
