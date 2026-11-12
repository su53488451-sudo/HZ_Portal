import {clamp,grain} from './art.mjs';
let image,light,dark,cacheW=0,cacheH=0;
export async function loadScene(){image=new Image();image.src='./assets/motion-atmosphere.png';await image.decode();cacheW=0;}
function layers(w,h){
  if(cacheW===w&&cacheH===h)return;
  cacheW=w;cacheH=h;
  light=document.createElement('canvas');light.width=w;light.height=h;
  const c=light.getContext('2d');c.fillStyle='#deebf4';c.fillRect(0,0,w,h);
  if(image){const k=Math.max(w/image.width,h/image.height);c.drawImage(image,(w-image.width*k)/2,(h-image.height*k)/2,image.width*k,image.height*k);}
  dark=document.createElement('canvas');dark.width=w;dark.height=h;const d=dark.getContext('2d');
  d.drawImage(light,0,0);const pixels=d.getImageData(0,0,w,h),a=pixels.data;
  // A luminance/chroma grade preserves the SAME artwork through the dark-to-light reveal.
  for(let i=0;i<a.length;i+=4){const chroma=clamp((a[i+2]-a[i])/120),v=(a[i]+a[i+1]+a[i+2])/765;
    a[i]=8+v*5+chroma*7;a[i+1]=25+v*8+chroma*50;a[i+2]=43+v*12+chroma*65;}
  d.putImageData(pixels,0,0);
}
export function scene(c,w,h,t,brightness=0){
  layers(Math.round(w),Math.round(h));
  const dx=Math.sin(t*.00016)*w*.008,dy=Math.cos(t*.00013)*h*.008;
  c.save();c.translate(w/2+dx,h/2+dy);c.scale(1.035,1.035);c.drawImage(dark,-w/2,-h/2,w,h);
  c.globalAlpha=clamp(brightness);c.drawImage(light,-w/2,-h/2,w,h);c.restore();
  if(brightness<1){const g=c.createRadialGradient(w*.5,h*.4,0,w*.5,h*.4,w*.42);g.addColorStop(0,`rgba(8,25,40,${.55*(1-brightness)})`);g.addColorStop(1,'#08192800');c.fillStyle=g;c.fillRect(0,0,w,h);}
  grain(c,w,h);
}
