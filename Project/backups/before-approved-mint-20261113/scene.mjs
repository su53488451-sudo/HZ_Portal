import {grain} from './art.mjs';
export async function loadScene(){}
export function scene(c,w,h,t,brightness=0,edition='2'){
 c.fillStyle=edition==='2'?'#e4f6ef':'#f2f3f5';c.fillRect(0,0,w,h);grain(c,w,h,edition==='2'?.025:.065);
}
