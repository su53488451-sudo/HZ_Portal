export const PALETTES = [
  ['#080f25','#244eff','#f86b9c'], // blue + red/pink
  ['#081b23','#f25563','#25ce97'], // red + green
  ['#071023','#2755ff','#ffc344'], // blue + yellow
  ['#071923','#10ce8e','#ffce3e'], // green + yellow
  ['#151227','#fd7859','#9560f5'], // the approved coral + violet glow
  ['#0a1a2a','#42bfd5','#e680ce']
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
  // Offset optical color and shadow passes: dense core, soft light bleeding at the edges.
  // No mesh lines or anatomical outlines are painted.
  const spectrum=[[0,colors[2]],[.22,colors[2]],[.42,colors[1]],[.78,colors[1]],[1,colors[2]]];
  paint(Math.max(12,width*.28),.78,spectrum,-width*.14);
  paint(Math.max(4,width*.075),1,spectrum,-width*.07);
  paint(Math.max(4,width*.065),.98,[[0,colors[0]],[.72,colors[0]],[1,rgba(colors[0],.7)]],width*.32);
  paint(Math.max(10,width*.2),.28,[[0,rgba(colors[2],0)],[.25,colors[2]],[.5,rgba(colors[2],0)],[1,rgba(colors[1],0)]],-width*.25);
}
export function diffusion(ctx,points,{width=100,palette=0,alpha=1}={}){
  const shape=buildMotionShape(points,width*1.8);illuminate(ctx,shape.contours,{width,palette,alpha});
}
export function renderRecord(ctx,record,w,h,alpha=1){
  const scale=Math.min(w,h),armIndex=record.armPathIndex??(record.paths.length>=3?record.paths.length-1:-1);
  const arm=armIndex>=0?record.paths[armIndex]:null;
  const planes=poseSurfaces(arm);
  planes.forEach(p=>illuminate(ctx,[p.map(q=>({x:q.x*w,y:q.y*h}))],{width:scale*.12,palette:record.palette,alpha:alpha*.78}));
  record.paths.forEach((path,i)=>{
    if(i===armIndex&&planes.length)return;
    diffusion(ctx,path.map(p=>({x:p.x*w,y:p.y*h})),{width:scale*record.width,palette:record.palette,alpha:alpha*.94});
  });
}
let atmosphere,atmosphereGlow,posterImage,lightLayer,noiseTile;
export async function loadPoster(){
  const image=new Image();image.src=new URL('./assets/afterimage-poster-v1.png',import.meta.url).href;
  await image.decode();posterImage=image;atmosphere=null;
}
function smoothContour(points){
  const out=[],n=points.length;
  for(let i=0;i<n;i++){
    const a=points[(i+n-1)%n],b=points[i],c=points[(i+1)%n],d=points[(i+2)%n];
    for(let j=0;j<12;j++){const t=j/12,t2=t*t,t3=t2*t;out.push({
      x:.5*((2*b.x)+(-a.x+c.x)*t+(2*a.x-5*b.x+4*c.x-d.x)*t2+(-a.x+3*b.x-3*c.x+d.x)*t3),
      y:.5*((2*b.y)+(-a.y+c.y)*t+(2*a.y-5*b.y+4*c.y-d.y)*t2+(-a.y+3*b.y-3*c.y+d.y)*t3)
    });}
  }return out;
}
// Move a very broad light band through the cached artwork, not through the UI.
// The mask uses the artwork's alpha; empty parts of the poster never flash.
export function livingLight(ctx,source,w,h,t=0,lightSource=source){
  ctx.drawImage(source,0,0,w,h);
  if(!t)return;
  if(!lightLayer||lightLayer.width!==Math.round(w*.65)||lightLayer.height!==Math.round(h*.65)){
    lightLayer=document.createElement('canvas');lightLayer.width=Math.round(w*.65);lightLayer.height=Math.round(h*.65);
  }
  const c=lightLayer.getContext('2d'),sw=lightLayer.width,sh=lightLayer.height;
  c.clearRect(0,0,sw,sh);c.drawImage(lightSource,0,0,sw,sh);
  c.globalCompositeOperation='destination-in';
  const center=(.5+.72*Math.sin(t*.00012))*sw,span=sw*.52;
  const g=c.createLinearGradient(center-span,0,center+span,sh*.25);
  g.addColorStop(0,'#fff0');g.addColorStop(.3,'#ffffff38');g.addColorStop(.5,'#fff');g.addColorStop(.7,'#ffffff38');g.addColorStop(1,'#fff0');
  c.fillStyle=g;c.fillRect(0,0,sw,sh);c.globalCompositeOperation='source-over';
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.2+.035*Math.sin(t*.0002);ctx.drawImage(lightLayer,0,0,w,h);ctx.restore();
}
export function ambient(ctx,w,h,t=0){
  if(!atmosphere||atmosphere.width!==Math.round(w)||atmosphere.height!==Math.round(h)){
    atmosphere=document.createElement('canvas');atmosphere.width=Math.round(w);atmosphere.height=Math.round(h);const c=atmosphere.getContext('2d'),s=Math.min(w,h);
    if(posterImage){
      const factor=Math.max(w/posterImage.width,h/posterImage.height),iw=posterImage.width*factor,ih=posterImage.height*factor;
      c.drawImage(posterImage,(w-iw)/2,(h-ih)/2,iw,ih);
    }else{
    const imprints=[
      {p:[[-.1,.96],[.01,.63],[.08,.49],[.06,.67],[.12,.83],[.04,1.09]],width:.14,palette:1},
      {p:[[.07,1.06],[.1,.72],[.15,.48],[.23,.3],[.24,.34],[.2,.56],[.27,.64],[.26,.76],[.31,.94],[.24,1.1]],width:.19,palette:0},
      {p:[[.25,1.06],[.3,.79],[.35,.7],[.41,.76],[.52,.79],[.63,.91],[.62,1.04],[.48,.93],[.37,.9],[.34,1.09]],width:.17,palette:2},
      {p:[[.62,1.05],[.66,.8],[.75,.74],[.81,.57],[.86,.53],[.83,.72],[.92,.6],[1.08,.51],[.98,.72],[.88,.83],[.85,1.09]],width:.18,palette:4},
      {p:[[.84,1.08],[.87,.82],[.94,.72],[1.06,.62],[1.01,.84],[.95,1.09]],width:.14,palette:3}
    ];
    for(const r of imprints){const pts=r.p.map(([x,y])=>({x:x*w,y:y*h}));illuminate(c,[smoothContour(pts)],{width:s*r.width,palette:r.palette});}
    }
    // Cache a chroma mask once: animated light only touches the colored afterimages.
    atmosphereGlow=document.createElement('canvas');atmosphereGlow.width=atmosphere.width;atmosphereGlow.height=atmosphere.height;
    const pixels=c.getImageData(0,0,atmosphere.width,atmosphere.height),data=pixels.data;
    for(let i=0;i<data.length;i+=4){const max=Math.max(data[i],data[i+1],data[i+2]),min=Math.min(data[i],data[i+1],data[i+2]);data[i+3]*=clamp((max-min-18)/70);}
    atmosphereGlow.getContext('2d').putImageData(pixels,0,0);
  }
  livingLight(ctx,atmosphere,w,h,t,atmosphereGlow);
}
export function background(ctx,w,h){
  const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#081324');g.addColorStop(.5,'#0c1026');g.addColorStop(1,'#071724');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
}
export function grain(ctx,w,h,opacity=.065){
  if(!noiseTile){
    noiseTile=document.createElement('canvas');noiseTile.width=noiseTile.height=192;const c=noiseTile.getContext('2d'),im=c.createImageData(192,192);let seed=4831;
    for(let i=0;i<im.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=seed>>>24;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;}c.putImageData(im,0,0);
  }
  ctx.save();ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=opacity;ctx.fillStyle=ctx.createPattern(noiseTile,'repeat');ctx.fillRect(0,0,w,h);ctx.restore();
}


