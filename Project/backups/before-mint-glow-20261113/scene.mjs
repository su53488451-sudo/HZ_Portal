import {grain} from './art.mjs';
export async function loadScene(){}
export function scene(c,w,h,t,brightness=0,edition='2'){
 c.fillStyle=edition==='2'?'#e6eee9':'#f2f3f5';c.fillRect(0,0,w,h);grain(c,w,h);
}
