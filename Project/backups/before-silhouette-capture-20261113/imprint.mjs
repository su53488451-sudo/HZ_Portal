// Measured upper-body volumes preserve elbows, neck and head instead of a radial blob.
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
export function renderImprint(c,r,points,previous,w,h,alpha){
  const g=imprintContour(points),index=r.index||0,placement=imprintPlacement(index);
  const size=Math.min(w,h*1.6)*(.66+index%3*.08)*.22*.6*.72;
  const base=imprintContour(r.frames?.[0]?.points||points).mid;
  const dx=Math.max(-.045,Math.min(.045,(g.mid.x-base.x)*.25))*w,dy=Math.max(-.045,Math.min(.045,(g.mid.y-base.y)*.25))*h;
  const col=colors[index%colors.length];
  c.save();c.translate(placement.x*w+dx,placement.y*h+dy);
  const gradient=c.createLinearGradient(-size,size*-.8,size*.8,size*1.5);
  gradient.addColorStop(0,col[0]);gradient.addColorStop(.32,col[2]);gradient.addColorStop(.68,col[1]);gradient.addColorStop(1,col[1]);
  if(previous){const old=imprintContour(previous);c.save();c.translate((old.mid.x-g.mid.x)/g.span*size,(old.mid.y-g.mid.y)/g.span*size);c.globalAlpha=alpha*.38;c.filter=`blur(${size*.17}px)`;c.fillStyle=col[1];body(c,old,size);c.restore();}
  for(const [blur,opacity,offset] of [[.27,.64,.1],[.12,.78,0],[.065,.42,0]]){
    c.save();c.translate(size*offset,0);c.globalAlpha=alpha*opacity;c.filter=`blur(${Math.max(.5,size*blur)}px)`;c.fillStyle=gradient;body(c,g,size);c.restore();
  }
  c.restore();
}
