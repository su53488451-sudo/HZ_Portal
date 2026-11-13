import {silhouettePath} from './silhouette.mjs';
// New captures use the observed person mask; joint volumes support earlier recordings only.
export function imprintContour(points){
  const mid={x:(points[2].x+points[3].x)/2,y:(points[2].y+points[3].y)/2};
  const span=Math.max(.08,Math.hypot(points[2].x-points[3].x,points[2].y-points[3].y));
  const normalize=p=>({x:(p.x-mid.x)/span,y:(p.y-mid.y)/span});
  const curve=points.slice(0,6).map(normalize);
  const head=normalize(points[6]||{x:mid.x,y:mid.y-span*.7});
  const hips=[points[7]||{x:points[2].x,y:mid.y+span*1.45},points[8]||{x:points[3].x,y:mid.y+span*1.45}].map(normalize);
  return {curve,head,hips,mid,span};
}
export function imprintPlacement(index){
  const anchors=[{x:.15,y:.43},{x:.35,y:.45},{x:.47,y:.68},{x:.64,y:.18},{x:.61,y:.44},{x:.84,y:.49},{x:.77,y:.8}];
  return anchors[index]||{x:.17+(index*.61803398875%1)*.66,y:.24+(index*.41421356237%1)*.5};
}
// Locked to the five approved optical studies in assets/approved-afterimages.
// The pigment/exposure stays fixed; each visitor still supplies their own ten-second outline.
export const APPROVED_PIGMENTS=Object.freeze([
  Object.freeze(['#009c67','#ff5955','#153e35']),
  Object.freeze(['#2148ef','#ff4968','#382356']),
  Object.freeze(['#0750d9','#ffe332','#163862']),
  Object.freeze(['#00ae7d','#deed38','#1a7360']),
  Object.freeze(['#832dc5','#22c4ca','#44205d'])
]);
const colors=APPROVED_PIGMENTS;
// Persisted seed + index keep a visitor's scale and treatment unchanged on replay/reload.
// Most traces use the two approved dense/light-wake treatments; transparent ones are rare.
function randomUnit(record,salt){
  let x=((Math.round((Number.isFinite(record.seed)?record.seed:0)*10000) ^ Math.imul((record.index||0)+1,2654435761)) + salt)|0;
  x=Math.imul(x^(x>>>16),2246822507);x=Math.imul(x^(x>>>13),3266489909);
  return ((x^(x>>>16))>>>0)/4294967296;
}
export function imprintAppearance(record){
  const choice=randomUnit(record,109);
  return {scale:.2+.7*randomUnit(record,391),style:choice<.45?'soft':choice<.9?'flow':'transparent',direction:randomUnit(record,719)<.5?-1:1};
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
export function renderImprint(c,r,points,previous,w,h,alpha,shape=null,previousShape=null){
  const g=imprintContour(points),index=r.index||0,placement=imprintPlacement(index);
  const appearance=imprintAppearance(r),pigment=index%colors.length;
  const transparent=appearance.style==='transparent'||pigment===3,flow=appearance.style==='flow'||pigment===0;
  const size=Math.min(w,h*1.6)*.74*.22*.6*.72*appearance.scale;
  const base=imprintContour(r.frames?.[0]?.points||points).mid;
  const dx=Math.max(-.045,Math.min(.045,(g.mid.x-base.x)*.25))*w,dy=Math.max(-.045,Math.min(.045,(g.mid.y-base.y)*.25))*h;
  const col=colors[index%colors.length];
  const paint=(geometry,outline)=>outline?silhouettePath(c,outline,geometry,size):body(c,geometry,size);
  c.save();c.translate(placement.x*w+dx,placement.y*h+dy);
  const old=previous?imprintContour(previous):g;
  const vx=(old.mid.x-g.mid.x)/g.span,vy=(old.mid.y-g.mid.y)/g.span;
  const wristX=(old.curve[0].x+old.curve[5].x-g.curve[0].x-g.curve[5].x)*.18;
  const wristY=(old.curve[0].y+old.curve[5].y-g.curve[0].y-g.curve[5].y)*.18;
  const speed=Math.min(1.2,Math.hypot(vx+wristX,vy+wristY));
  const direction=Math.abs(vx+wristX)>.04?Math.sign(vx+wristX):appearance.direction;
  const slope=Math.max(-.35,Math.min(.35,vy+wristY));
  // The body treatment is stable when a wrist reverses direction; only its wake changes.
  c.transform(.88,-appearance.direction*.06,-appearance.direction*.3,1.06,0,0);
  const gradient=c.createLinearGradient(-direction*size,size*-.8,direction*size*.8,size*1.45);
  gradient.addColorStop(0,col[0]+'00');gradient.addColorStop(.18,col[0]);gradient.addColorStop(.42,col[0]);gradient.addColorStop(.63,col[1]);gradient.addColorStop(.82,col[1]+'d9');gradient.addColorStop(1,col[1]+'00');
  if(previous&&(!shape||previousShape)){
    // A directional exposure of a captured outline. The far end gets thinner and lighter,
    // not bigger and rounder. Wrist/torso movement steers the color wake.
    const reach=(flow?2.1:.85)+speed*1.6;
    for(const f of [1,.72,.45,.18]){
      const arc=pigment===4?Math.sin(f*Math.PI)*.65:0;
      c.save();c.translate(direction*size*reach*f,(slope*f+.08+arc)*size);
      if(pigment===4)c.rotate(direction*f*.18);
      c.transform(1+f*1.1,slope*f*.15,direction*f*.45,1-f*.7,0,0);
      c.globalAlpha=alpha*(transparent?.2:.65)*(1-f*.75);
      c.filter=`blur(${Math.max(.8,size*(.075+f*.12))}px)`;
      const wake=c.createLinearGradient(-direction*size,0,direction*size*2.5,size*.5);
      wake.addColorStop(0,col[0]+'00');wake.addColorStop(.24,col[0]);wake.addColorStop(.52,col[1]);wake.addColorStop(1,col[1]+'00');
      c.fillStyle=wake;paint(old,previousShape);c.restore();
    }
  }
  // A close second exposure supplies the approved blue/red color separation.
  if(pigment===1){
    c.save();c.translate(-appearance.direction*size*.2,size*.035);c.filter=`blur(${Math.max(.8,size*.1)}px)`;
    c.globalAlpha=alpha*.24;c.fillStyle=col[0];paint(g,shape);c.restore();
  }
  // Restrained color separation; no full-body radial halo or swollen dark disc.
  for(const [blur,opacity,offset] of [[.2,.52,.22],[.08,.78,.07]]){
    c.save();c.translate(direction*size*offset,0);c.globalAlpha=alpha*opacity*(transparent?.48:1);c.filter=`blur(${Math.max(.8,size*blur)}px)`;c.fillStyle=gradient;paint(g,shape);c.restore();
  }
  // A more defined torso/back fragment supplies shape. Fade before the head and bottom,
  // leaving these areas to the softer color passes instead of drawing facial detail.
  const core=c.createLinearGradient(-direction*size*.65,-size*.65,direction*size*.55,size*1.4);
  core.addColorStop(0,col[2]+'00');core.addColorStop(.2,col[2]+'38');core.addColorStop(.4,col[2]);
  core.addColorStop(.6,col[2]+'e8');core.addColorStop(.78,col[2]+'52');core.addColorStop(1,col[2]+'00');
  c.save();c.globalAlpha=alpha*(transparent?.12:.82);c.filter=`blur(${Math.max(.8,size*.055)}px)`;c.fillStyle=core;paint(g,shape);c.restore();
  c.restore();
}
