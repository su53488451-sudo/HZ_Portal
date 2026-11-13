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
const colors=[['#087756','#ff7058','#123b32'],['#305ae4','#ed696b','#253658'],['#204dc2','#e8cf38','#203b52'],['#248052','#e2d13b','#244734'],['#7942b0','#51bed2','#3c2959'],['#b75291','#73b7d4','#3d3454']];
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
function segment(c,a,b,ra,rb,s){
  const angle=Math.atan2(b.y-a.y,b.x-a.x),nx=-Math.sin(angle),ny=Math.cos(angle);
  c.beginPath();c.moveTo((a.x+nx*ra)*s,(a.y+ny*ra)*s);c.lineTo((b.x+nx*rb)*s,(b.y+ny*rb)*s);
  c.arc(b.x*s,b.y*s,rb*s,angle+Math.PI/2,angle-Math.PI/2,true);
  c.lineTo((a.x-nx*ra)*s,(a.y-ny*ra)*s);c.arc(a.x*s,a.y*s,ra*s,angle-Math.PI/2,angle+Math.PI/2,true);c.closePath();c.fill();
}
function body(c,g,s){
  const [lw,le,ls,rs,re,rw]=g.curve,[lh,rh]=g.hips,head=g.head;
  segment(c,head,{x:0,y:.12},.13,.2,s);
  c.beginPath();c.ellipse(head.x*s,head.y*s,s*.25,s*.33,Math.atan2(rs.y-ls.y,rs.x-ls.x)*.35,0,Math.PI*2);c.fill();
  c.beginPath();c.moveTo(ls.x*s,ls.y*s);c.quadraticCurveTo(0,-s*.15,rs.x*s,rs.y*s);
  c.bezierCurveTo((rs.x+.04)*s,s*.55,(rh.x+.09)*s,(rh.y-.2)*s,rh.x*s,rh.y*s);
  c.quadraticCurveTo((lh.x+rh.x)*s/2,(Math.max(lh.y,rh.y)+.14)*s,lh.x*s,lh.y*s);
  c.bezierCurveTo((lh.x-.09)*s,(lh.y-.2)*s,(ls.x-.04)*s,s*.55,ls.x*s,ls.y*s);c.closePath();c.fill();
  for(const [shoulder,elbow,wrist] of [[ls,le,lw],[rs,re,rw]]){segment(c,shoulder,elbow,.21,.15,s);segment(c,elbow,wrist,.15,.09,s);}
}
export function renderImprint(c,r,points,previous,w,h,alpha,shape=null,previousShape=null){
  const g=imprintContour(points),index=r.index||0,placement=imprintPlacement(index);
  const appearance=imprintAppearance(r),transparent=appearance.style==='transparent',flow=appearance.style==='flow';
  const size=Math.min(w,h*1.6)*.74*.22*.6*.72*appearance.scale;
  const base=imprintContour(r.frames?.[0]?.points||points).mid;
  const dx=Math.max(-.045,Math.min(.045,(g.mid.x-base.x)*.25))*w,dy=Math.max(-.045,Math.min(.045,(g.mid.y-base.y)*.25))*h;
  const col=colors[index%colors.length];
  const paint=(geometry,outline)=>outline?silhouettePath(c,outline,geometry,size):body(c,geometry,size);
  c.save();c.translate(placement.x*w+dx,placement.y*h+dy);
  const gradient=c.createLinearGradient(-size,size*-.8,size*.9,size*1.8);
  gradient.addColorStop(0,col[0]);gradient.addColorStop(.3,transparent?col[0]:col[2]);gradient.addColorStop(.64,col[1]);gradient.addColorStop(.82,col[1]);gradient.addColorStop(1,col[1]+'00');
  if(previous&&(!shape||previousShape)){
    const old=imprintContour(previous),vx=(old.mid.x-g.mid.x)/g.span,vy=(old.mid.y-g.mid.y)/g.span;
    // Use an earlier captured outline for the wake, so the entire ten-second gesture remains visible.
    const reach=Math.min(1.2,Math.hypot(vx,vy)+Math.abs(old.curve[0].x-g.curve[0].x)*.18+Math.abs(old.curve[5].x-g.curve[5].x)*.18);
    const trail=flow?(.45+reach):.12;
    c.save();c.translate((vx+appearance.direction*trail)*size,vy*size);c.scale(flow?1.3:1.04,1);
    c.globalAlpha=alpha*(transparent?.13:flow?.35:.24);c.filter=`blur(${Math.max(1,size*(flow?.3:.22))}px)`;c.fillStyle=col[1];paint(old,previousShape);c.restore();
  }
  // No crisp anatomical pass: heads, elbows and fingers dissolve into the same optical volume.
  // Broad torso mass still reads as a person; the source outline itself is never replaced.
  for(const [blur,opacity,offset] of [[.29,.5,.1],[.12,.8,0],[.085,.32,0]]){
    c.save();c.translate(size*offset,0);c.globalAlpha=alpha*opacity*(transparent?.43:1);c.filter=`blur(${Math.max(.8,size*blur)}px)`;c.fillStyle=gradient;paint(g,shape);c.restore();
  }
  c.restore();
}
