// Continuous organic outline driven by observed joints, without a literal head/arms rig.
export function imprintContour(points){
  const mid={x:(points[2].x+points[3].x)/2,y:(points[2].y+points[3].y)/2};
  const span=Math.max(.08,Math.hypot(points[2].x-points[3].x,points[2].y-points[3].y));
  const joints=points.map((p,i)=>{
    const x=(p.x-mid.x)/span,y=(p.y-mid.y)/span;
    return {angle:Math.atan2(y,x),distance:Math.min(2.1,Math.hypot(x,y)),weight:[.64,.5,.28,.28,.5,.64,.32,.4,.4][i]||.3};
  });
  const curve=Array.from({length:24},(_,i)=>{
    const angle=i/24*Math.PI*2;
    let radius=.46;
    for(const j of joints){const d=Math.atan2(Math.sin(angle-j.angle),Math.cos(angle-j.angle));radius+=j.distance*j.weight*Math.exp(-d*d/.26)*.55;}
    return {x:Math.cos(angle)*radius,y:Math.sin(angle)*radius};
  });
  return {curve,mid,span};
}
export function imprintPlacement(index){
  return index===0?{x:.5,y:.5}:{x:.17+(index*.61803398875%1)*.66,y:.24+(index*.41421356237%1)*.5};
}
const colors=[['#035f47','#f46b63','#193736'],['#144cf0','#f45369','#162539'],['#194ee2','#f1cd46','#102b42'],['#16875b','#e4d649','#17382e'],['#7b46b4','#51cfd0','#29223b'],['#d4508c','#7bbbed','#282434']];
function path(c,points,size){
  const ps=points.map(p=>({x:p.x*size,y:p.y*size})),last=ps.at(-1),first=ps[0];
  c.beginPath();c.moveTo((last.x+first.x)/2,(last.y+first.y)/2);
  for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length];c.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2);}c.closePath();
}
export function renderImprint(c,r,points,previous,w,h,alpha){
  const {curve,mid,span}=imprintContour(points),index=r.index||0,placement=imprintPlacement(index);
  // 60% of the previous edition's linear scale; motion is not replaced by templates.
  const size=Math.min(w,h*1.6)*(.66+index%3*.08)*.22*.6;
  const origin=r.frames?.[0]?.points||points,base=imprintContour(origin).mid;
  const dx=Math.max(-.04,Math.min(.04,(mid.x-base.x)*.2))*w,dy=Math.max(-.04,Math.min(.04,(mid.y-base.y)*.2))*h;
  const col=colors[index%colors.length],reach=points[5].y-points[0].y;
  c.save();c.translate(placement.x*w+dx,placement.y*h+dy);c.rotate(reach*.16);
  const g=c.createLinearGradient(-size,-size*.6,size,size*.8);g.addColorStop(0,col[0]);g.addColorStop(.42,col[2]);g.addColorStop(.75,col[1]);g.addColorStop(1,col[1]);
  if(previous){c.save();const old=imprintContour(previous);c.translate((old.mid.x-mid.x)/span*size*.3,(old.mid.y-mid.y)/span*size*.3);c.globalAlpha=alpha*.25;c.filter=`blur(${size*.22}px)`;c.fillStyle=col[0];path(c,old.curve,size*1.08);c.fill();c.restore();}
  for(const [blur,opacity,scale] of [[.26,.65,1.2],[.1,.86,1],[.025,.62,.94]]){
    c.globalAlpha=alpha*opacity;c.filter=`blur(${Math.max(.5,size*blur)}px)`;c.fillStyle=g;path(c,curve,size*scale);c.fill();
  }
  // Offset color exposures are soft, not outlines or neon tubes.
  c.globalAlpha=alpha*.4;c.filter=`blur(${size*.18}px)`;
  const light=c.createRadialGradient(size*.6,size*.32,0,size*.6,size*.32,size*.8);light.addColorStop(0,col[1]);light.addColorStop(1,col[1]+'00');c.fillStyle=light;path(c,curve,size*1.1);c.fill();c.restore();
}
