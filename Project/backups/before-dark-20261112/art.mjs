export const PALETTES = [
  ['#173986','#355ff0','#a6d9ff'], ['#782958','#e94c98','#ffc1d9'],
  ['#125266','#17a8ae','#a0e7de'], ['#973d39','#f36e4d','#ffc2a0'],
  ['#453081','#8954e0','#cbb8ff'], ['#18564d','#29a889','#afe4c8']
];
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function simplify(points,limit=54){
  if(points.length<=limit)return points;
  return Array.from({length:limit},(_,i)=>points[Math.round(i*(points.length-1)/(limit-1))]);
}
export function raisedHand(p){return !!p && [15,16].some(i=>p[i]?.visibility>.65 && p[0]?.visibility>.65 && p[i].y<p[0].y-.07);}
export function usablePose(p){return !!p && [11,12,15,16].every(i=>p[i]?.visibility>.5);}
export function createRecord(traces,pose,index){
  const paths=traces.filter(p=>p.length>2).map(p=>simplify(p).map(q=>({x:clamp(q.x),y:clamp(q.y)})));
  const armPathIndex=pose?paths.length:-1;
  if(pose){paths.push([15,13,11,12,14,16].map(i=>({x:1-pose[i].x,y:pose[i].y})));}
  if(!paths.length)return null;
  // Geometry is derived from observed positions, not chosen from symbol templates.
  let distance=0;for(const path of paths)for(let i=1;i<path.length;i++)distance+=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);
  const poseWidth=pose?Math.abs(pose[15].x-pose[16].x):.5;
  return {id:crypto.randomUUID(),created:Date.now(),version:4,paths,armPathIndex,palette:index%PALETTES.length,seed:Math.random()*100,width:clamp(.055+poseWidth*.09+distance*.004,.06,.15),distance};
}
function rgba(hex,a){const c=hex.match(/\w\w/g).map(v=>parseInt(v,16));return `rgba(${c[0]},${c[1]},${c[2]},${a})`;}
export function reduceMotion(points,tolerance){
  if(points.length<3)return points.map(p=>({...p}));
  const a=points[0],b=points.at(-1),dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
  let max=0,index=0;
  for(let i=1;i<points.length-1;i++){const p=points[i],t=len?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/len):0,d=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);if(d>max){max=d;index=i;}}
  if(max<=tolerance)return [{...a},{...b}];
  return [...reduceMotion(points.slice(0,index+1),tolerance).slice(0,-1),...reduceMotion(points.slice(index),tolerance)];
}
export function motionProfile(points){
  if(!points.length)return {extent:0,length:0,angularity:0,closed:false,controls:[]};
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),extent=Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
  // Suppress small tracking tremors before extracting deliberate turns.
  const filtered=points.length>16?points.map((p,i)=>{
    if(i===0||i===points.length-1)return p;
    const a=points[i-1],b=points[i+1];return{x:(a.x+2*p.x+b.x)/4,y:(a.y+2*p.y+b.y)/4};
  }):points;
  let tolerance=Math.max(extent*.04,.00001),controls=reduceMotion(filtered,tolerance);
  while(controls.length>16){tolerance*=1.35;controls=reduceMotion(filtered,tolerance);}
  let length=0,turns=[];
  for(let i=1;i<controls.length;i++)length+=Math.hypot(controls[i].x-controls[i-1].x,controls[i].y-controls[i-1].y);
  for(let i=1;i<controls.length-1;i++){const a=controls[i-1],p=controls[i],b=controls[i+1],u={x:p.x-a.x,y:p.y-a.y},v={x:b.x-p.x,y:b.y-p.y},den=Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y);if(den>1e-10)turns.push(Math.acos(clamp((u.x*v.x+u.y*v.y)/den,-1,1)));}
  const area=Math.abs(controls.reduce((sum,p,i)=>{const q=controls[(i+1)%controls.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
  return {extent,length,angularity:turns.length?clamp(Math.max(...turns)/Math.PI):0,closed:extent>0&&length>extent*2&&length<extent*4.5&&area>extent*extent*.16&&Math.hypot(points[0].x-points.at(-1).x,points[0].y-points.at(-1).y)<extent*.2,controls};
}
function cornerPath(points,softness){
  if(points.length===2)return Array.from({length:25},(_,i)=>({x:points[0].x+(points[1].x-points[0].x)*i/24,y:points[0].y+(points[1].y-points[0].y)*i/24}));
  if(points.length<3)return points;
  const out=[points[0]];
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1],p=points[i],b=points[i+1],s=softness,entry={x:p.x+(a.x-p.x)*s,y:p.y+(a.y-p.y)*s},exit={x:p.x+(b.x-p.x)*s,y:p.y+(b.y-p.y)*s};out.push(entry);
    for(let j=1;j<=5;j++){const t=j/5;out.push({x:(1-t)**2*entry.x+2*(1-t)*t*p.x+t*t*exit.x,y:(1-t)**2*entry.y+2*(1-t)*t*p.y+t*t*exit.y});}
  }out.push(points.at(-1));return out;
}
// Shape is calculated from the path's real corners, aspect, and closure; no symbol presets.
export function buildMotionShape(points,width){
  const profile=motionProfile(points);
  if(profile.extent<.00001)return {contours:[],profile};
  let controls=profile.controls;
  if(profile.closed)controls=[...controls.slice(0,-1),controls[0]];
  const pts=cornerPath(controls,.28-profile.angularity*.2),left=[],right=[];
  const radius=width*(profile.closed?.26:.23+profile.angularity*.33);
  for(let i=0;i<pts.length;i++){
    const a=pts[Math.max(0,i-1)],p=pts[i],b=pts[Math.min(pts.length-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,t=i/(pts.length-1);
    const progress=profile.closed?1:Math.pow(Math.sin(Math.PI*t),.45);
    const u={x:p.x-a.x,y:p.y-a.y},v={x:b.x-p.x,y:b.y-p.y},cross=u.x*v.y-u.y*v.x;
    const flare=1+profile.angularity*.6*(cross<0?1:0),r=radius*progress;
    left.push({x:p.x-dy/len*r*flare,y:p.y+dx/len*r*flare});right.push({x:p.x+dy/len*r*.65,y:p.y-dx/len*r*.65});
  }
  if(profile.closed)return {contours:[left,right.reverse()],profile};
  // Union consistently oriented triangles: crossing movements must not cut checkerboard holes.
  const contours=[];
  for(let i=0;i<left.length-1;i++){
    for(const triangle of [[left[i],left[i+1],right[i]],[left[i+1],right[i+1],right[i]]]){
      const [a,b,c]=triangle;if((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)<0)triangle.reverse();contours.push(triangle);
    }
  }
  return {contours,profile};
}
export function poseSurfaces(arm){
  if(!arm||arm.length!==6)return [];
  const shoulderSpan=Math.hypot(arm[2].x-arm[3].x,arm[2].y-arm[3].y);
  if(shoulderSpan<.005)return [];
  const center={x:(arm[2].x+arm[3].x)/2,y:(arm[2].y+arm[3].y)/2+shoulderSpan*.65};
  return [[arm[0],arm[1],arm[2],center],[center,arm[3],arm[4],arm[5]]].filter(p=>{
    const area=p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.y-b.x*a.y;},0);return Math.abs(area)>.001;
  });
}
function fillContours(ctx,contours){
  ctx.beginPath();for(const c of contours){if(!c.length)continue;ctx.moveTo(c[0].x,c[0].y);for(let i=1;i<c.length;i++)ctx.lineTo(c[i].x,c[i].y);ctx.closePath();}ctx.fill();
}
function illuminate(ctx,contours,{palette=0,alpha=1,width=70}={}){
  const pts=contours.flat();if(!pts.length)return;
  const colors=PALETTES[palette%PALETTES.length],xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),x0=Math.min(...xs),y0=Math.min(...ys),x1=Math.max(...xs),y1=Math.max(...ys);
  const paint=(blur,opacity,stops,offset=0)=>{
    ctx.save();ctx.translate(offset,-offset*.3);ctx.globalAlpha=alpha*opacity;ctx.filter=`blur(${blur}px)`;
    const g=ctx.createLinearGradient(x0,y0,x1+.1,y1+.1);stops.forEach(([at,col])=>g.addColorStop(at,col));ctx.fillStyle=g;fillContours(ctx,contours);ctx.restore();
  };
  // A broad colored halo and a lightly feathered body keep corners and openings legible.
  paint(Math.max(8,width*.24),.75,[[0,colors[2]],[.5,colors[1]],[1,colors[1]]],width*.09);
  paint(Math.max(1.5,width*.026),.95,[[0,colors[2]],[.28,colors[1]],[.7,colors[0]],[1,colors[1]]]);
  paint(Math.max(3,width*.08),.32,[[0,rgba(colors[2],0)],[.45,colors[2]],[1,rgba(colors[1],0)]],width*.12);
}
export function diffusion(ctx,points,{width=100,palette=0,alpha=1}={}){
  const shape=buildMotionShape(points,width);illuminate(ctx,shape.contours,{width,palette,alpha});
}
export function renderRecord(ctx,record,w,h,alpha=1){
  const scale=Math.min(w,h),armIndex=record.armPathIndex??(record.paths.length>=3?record.paths.length-1:-1);
  const arm=armIndex>=0?record.paths[armIndex]:null;
  const planes=poseSurfaces(arm);
  planes.forEach((p,i)=>illuminate(ctx,[p.map(q=>({x:q.x*w,y:q.y*h}))],{width:scale*.08,palette:(record.palette+i)%PALETTES.length,alpha:alpha*.78}));
  record.paths.forEach((path,i)=>{
    if(i===armIndex&&planes.length)return;
    diffusion(ctx,path.map(p=>({x:p.x*w,y:p.y*h})),{width:scale*record.width,palette:(record.palette+(i===1?2:0))%PALETTES.length,alpha:alpha*.94});
  });
}
let atmosphere;
export function ambient(ctx,w,h,t=0){
  if(!atmosphere||atmosphere.width!==Math.round(w)||atmosphere.height!==Math.round(h)){
    atmosphere=document.createElement('canvas');atmosphere.width=Math.round(w);atmosphere.height=Math.round(h);const c=atmosphere.getContext('2d'),s=Math.min(w,h);
    const trails=[{p:[[-.08,.95],[.08,.72],[.14,.4],[.19,.33],[.23,.53]],width:.15,palette:0,seed:1},
      {p:[[.69,-.14],[.77,.06],[.9,.18],[1.05,.1]],width:.14,palette:1,seed:5},
      {p:[[.52,1.12],[.69,.85],[.86,.81],[1.1,.95]],width:.17,palette:4,seed:7},
      {p:[[.98,1.1],[.95,.81],[1.08,.65]],width:.13,palette:3,seed:3}];
    trails.forEach((r,i)=>diffusion(c,r.p.map(([x,y])=>({x:(w<760&&i===0?x*.45-.05:x)*w,y:y*h})),{width:s*r.width,palette:r.palette,seed:r.seed,alpha:.93}));
  }
  const dx=Math.sin(t*.00017)*w*.006,dy=Math.cos(t*.00013)*h*.007;ctx.drawImage(atmosphere,dx,dy,w,h);
}
export function background(ctx,w,h){ctx.fillStyle='#dae2ed';ctx.fillRect(0,0,w,h);const g=ctx.createRadialGradient(w*.48,h*.4,0,w*.5,h*.5,w*.7);g.addColorStop(0,'#edf0f7');g.addColorStop(1,'#cbd8e9');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}


