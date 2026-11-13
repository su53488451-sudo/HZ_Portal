// Camera anatomy and recorded poses are independent of the approved optical design.
export const APPROVED_TRACE_URL=new URL('./assets/approved-afterimages/05.png',import.meta.url).href;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function imprintContour(points){
  const mid={x:(points[2].x+points[3].x)/2,y:(points[2].y+points[3].y)/2};
  const span=Math.max(.08,Math.hypot(points[2].x-points[3].x,points[2].y-points[3].y));
  const normalize=p=>({x:(p.x-mid.x)/span,y:(p.y-mid.y)/span});
  return {mid,span,curve:points.slice(0,6).map(normalize),head:normalize(points[6]||{x:mid.x,y:mid.y-span*.7}),hips:[points[7]||{x:points[2].x,y:mid.y+span*1.45},points[8]||{x:points[3].x,y:mid.y+span*1.45}].map(normalize)};
}
export function imprintPlacement(index){
  const anchors=[{x:.15,y:.43},{x:.35,y:.45},{x:.47,y:.68},{x:.64,y:.18},{x:.61,y:.44},{x:.84,y:.49},{x:.77,y:.8}];
  return anchors[index]||{x:.17+(index*.61803398875%1)*.66,y:.24+(index*.41421356237%1)*.5};
}
function randomUnit(record,salt){
  let x=((Math.round((Number.isFinite(record.seed)?record.seed:0)*10000)^Math.imul((record.index||0)+1,2654435761))+salt)|0;
  x=Math.imul(x^(x>>>16),2246822507);x=Math.imul(x^(x>>>13),3266489909);
  return ((x^(x>>>16))>>>0)/4294967296;
}
export function imprintAppearance(record){return {scale:.3+.6*randomUnit(record,391),opacity:.7+.3*randomUnit(record,827),palette:Math.floor(randomUnit(record,109)*5)};}
export async function loadImprint(){return DESIGN_PALETTES;}
export function imprintTransform(record,points,w,h){
  const placement=imprintPlacement(record.index||0),appearance=imprintAppearance(record);
  const first=record.frames?.[0]?.points||points;
  const shoulder=p=>({x:(p[2].x+p[3].x)/2,y:(p[2].y+p[3].y)/2});
  const base=shoulder(first),current=shoulder(points);
  const hands=p=>({x:(p[0].x+p[5].x)/2,y:(p[0].y+p[5].y)/2});
  const bh=hands(first),ch=hands(points);
  // The complete ten-second body/hand trajectory drives translation only.
  // Uniform size: no stretch, turn, mirror, additional blur, or invented appendage.
  const dx=clamp((current.x-base.x)*.32+(ch.x-bh.x)*.1,-.07,.07)*w;
  const dy=clamp((current.y-base.y)*.32+(ch.y-bh.y)*.1,-.07,.07)*h;
  const width=Math.min(w,h*1672/941)*.52*appearance.scale,height=width*941/1672;
  return {x:clamp(placement.x*w+dx-width*.47,0,w-width),y:clamp(placement.y*h+dy-height*.48,0,h-height),width,height,scale:appearance.scale};
}

function sleeve(c,shoulder,elbow,wrist,s){
  const normal=(a,b)=>{const d=Math.hypot(b.x-a.x,b.y-a.y)||1;return {x:-(b.y-a.y)/d,y:(b.x-a.x)/d};};
  const a=normal(shoulder,elbow),b=normal(elbow,wrist),n=normal(shoulder,wrist);
  const pt=(p,v,r)=>[(p.x+v.x*r)*s,(p.y+v.y*r)*s];
  // Tapered continuous arms: the gesture has a direction, rather than rounded capsules.
  c.beginPath();c.moveTo(...pt(shoulder,a,.19));
  c.quadraticCurveTo(...pt(elbow,n,.15),...pt(wrist,b,.065));
  c.quadraticCurveTo(wrist.x*s+b.x*s*.02,wrist.y*s+b.y*s*.02,...pt(wrist,b,-.065));
  c.quadraticCurveTo(...pt(elbow,n,-.15),...pt(shoulder,a,-.19));
  c.closePath();c.fill();
}
function body(c,g,s){
  const [lw,le,ls,rs,re,rw]=g.curve,[lh,rh]=g.hips,head={x:g.head.x*.92,y:g.head.y*.85};
  c.beginPath();c.moveTo((head.x-.18)*s,(head.y+.18)*s);
  c.bezierCurveTo((head.x-.28)*s,(head.y-.07)*s,(head.x-.18)*s,(head.y-.35)*s,(head.x+.03)*s,(head.y-.29)*s);
  c.bezierCurveTo((head.x+.26)*s,(head.y-.27)*s,(head.x+.23)*s,(head.y+.04)*s,(head.x+.13)*s,(head.y+.21)*s);c.closePath();c.fill();
  c.beginPath();c.moveTo((ls.x-.1)*s,(ls.y+.06)*s);
  c.quadraticCurveTo((head.x-.32)*s,(head.y+.35)*s,(head.x-.12)*s,(head.y+.22)*s);
  c.quadraticCurveTo(head.x*s,(head.y+.11)*s,(head.x+.15)*s,(head.y+.25)*s);
  c.quadraticCurveTo((head.x+.3)*s,(head.y+.37)*s,(rs.x+.1)*s,(rs.y+.06)*s);
  c.bezierCurveTo((rs.x+.16)*s,s*.55,(rh.x+.1)*s,(rh.y-.2)*s,rh.x*s,rh.y*s);
  c.quadraticCurveTo((lh.x+rh.x)*s/2,(Math.max(lh.y,rh.y)+.14)*s,lh.x*s,lh.y*s);
  c.bezierCurveTo((lh.x-.1)*s,(lh.y-.2)*s,(ls.x-.16)*s,s*.55,(ls.x-.1)*s,(ls.y+.06)*s);c.closePath();c.fill();
  for(const [shoulder,elbow,wrist] of [[ls,le,lw],[rs,re,rw]])sleeve(c,shoulder,elbow,wrist,s);
}

const DESIGN_PALETTES=[
 ['#7531bd','#16c5d0','#49306b'],['#00a977','#f85c68','#246254'],
 ['#2456ef','#f85b79','#3b3b72'],['#175bd8','#f5de41','#24527a'],
 ['#06b680','#e2e945','#257c60']
];
let foreground,painted;
export function capturedOutlineBounds(shape){
 let minX=shape.width,minY=shape.height,maxX=0,maxY=0;
 for(let i=0;i<shape.runs.length;i+=2){const start=shape.runs[i],x=start%shape.width,y=Math.floor(start/shape.width);minX=Math.min(minX,x);maxX=Math.max(maxX,x+shape.runs[i+1]);minY=Math.min(minY,y);maxY=Math.max(maxY,y+1);}
 return {minX,minY,maxX,maxY};
}
export function renderImprint(c,record,points,previous,w,h,alpha,shape=null,previousShape=null){
 const appearance=imprintAppearance(record),box=imprintTransform(record,points,w,h);
 const sw=480,sh=shape?Math.round(sw*shape.height/shape.width):360;
 foreground??=document.createElement('canvas');painted??=document.createElement('canvas');
 for(const layer of [foreground,painted])if(layer.width!==sw||layer.height!==sh){layer.width=sw;layer.height=sh;}
 const mask=foreground.getContext('2d'),ink=painted.getContext('2d');
 mask.clearRect(0,0,sw,sh);mask.fillStyle='#fff';
 let bounds;
 if(shape){
  // Literal observed person pixels, at the camera's aspect ratio. No template anatomy.
  const scale=sw/shape.width;
  for(let i=0;i<shape.runs.length;i+=2){const n=shape.runs[i];mask.fillRect(n%shape.width*scale,Math.floor(n/shape.width)*scale,shape.runs[i+1]*scale,scale);}
  const b=capturedOutlineBounds(shape);bounds={x:b.minX*scale,y:b.minY*scale,width:(b.maxX-b.minX)*scale,height:(b.maxY-b.minY)*scale};
 }else{
  // Existing pose-only archives: filled anatomy follows saved joints.
  const g=imprintContour(points);mask.save();mask.translate(sw*.5,sh*.4);body(mask,g,60);mask.restore();
  bounds={x:sw*.2,y:sh*.05,width:sw*.6,height:sh*.9};
 }
 const col=DESIGN_PALETTES[appearance.palette],{x,y,width:bw,height:bh}=bounds;
 ink.clearRect(0,0,sw,sh);ink.globalCompositeOperation='source-over';
 // Approved two-color optical exposure; retain a translucent colored center.
 const gradient=ink.createLinearGradient(x+bw*.3,y,x+bw*.7,y+bh);
 gradient.addColorStop(0,col[1]);gradient.addColorStop(.27,col[0]);gradient.addColorStop(.46,col[2]);gradient.addColorStop(.62,col[0]);gradient.addColorStop(.84,col[1]);gradient.addColorStop(1,col[1]+'00');
 ink.fillStyle=gradient;ink.fillRect(0,0,sw,sh);
 ink.globalCompositeOperation='destination-in';ink.drawImage(foreground,0,0);
 // Feather the exposure toward the bottom; the head and arms still follow the person.
 const fade=ink.createLinearGradient(0,y,0,y+bh);fade.addColorStop(0,'#ffffffb0');fade.addColorStop(.15,'#fff');fade.addColorStop(.65,'#fff');fade.addColorStop(1,'#ffffff00');
 ink.fillStyle=fade;ink.fillRect(0,0,sw,sh);ink.globalCompositeOperation='source-over';
 const ratio=box.width/sw,dw=box.width,dh=sh*ratio;
 const originX=box.x,originY=clamp(box.y,0,Math.max(0,h-dh));
 const motion=previous?clamp(((points[0].x+points[5].x)-(previous[0].x+previous[5].x))*.5,-.1,.1):0;
 const reach=-motion*dw*1.7;
 c.save();c.globalAlpha=alpha*appearance.opacity;
 for(const [blur,opacity,offset] of [[.032,.45,reach],[.014,.6,reach*.3],[.0045,.62,0]]){
  c.save();c.globalAlpha*=opacity;c.filter='blur('+Math.max(.9,dw*blur)+'px)';
  c.drawImage(painted,originX+offset,originY,dw,dh);c.restore();
 }
 c.restore();
}
