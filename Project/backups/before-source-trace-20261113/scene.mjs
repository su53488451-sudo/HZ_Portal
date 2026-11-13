import {grain} from './art.mjs';
let posterPlate;
export function posterBounds(w,h,edition='2'){
 if(edition!=='2')return {x:0,y:0,width:w,height:h};
 const scale=Math.min(w/1672,h/941),width=1672*scale,height=941*scale;
 return {x:(w-width)/2,y:(h-height)/2,width,height};
}
export async function loadScene(){
 const image=new Image();image.src=new URL('./assets/mint-title-plate.png',import.meta.url).href;
 await image.decode();posterPlate=image;document.body.dataset.posterPlate='ready';
}
export function scene(c,w,h,t,brightness=0,edition='2'){
 c.fillStyle=edition==='2'?'#e1f6ee':'#f2f3f5';c.fillRect(0,0,w,h);
 if(edition==='2'){
  const light=c.createRadialGradient(w*.42,h*.4,0,w*.42,h*.4,w*.7);
  light.addColorStop(0,'#f1fff7');light.addColorStop(1,'#d0eee3');c.fillStyle=light;c.fillRect(0,0,w,h);
  if(posterPlate&&brightness>.001){const b=posterBounds(w,h);c.save();c.globalAlpha=brightness;c.drawImage(posterPlate,b.x,b.y,b.width,b.height);c.restore();}
 }
 grain(c,w,h,edition==='2'?.025:.065);
}
