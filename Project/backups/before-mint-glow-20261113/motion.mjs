import {clamp,createRecord,usablePose} from './art.mjs';

export const DURATION=10000, SAMPLE_MS=80;
const JOINTS=[15,13,11,12,14,16];
export function captureFrame(p,t){
  if(!usablePose(p)||!JOINTS.every(i=>p[i]?.visibility>.5))return null;
  const points=JOINTS.map(i=>({x:Math.round(clamp(1-p[i].x)*10000)/10000,y:Math.round(clamp(p[i].y)*10000)/10000}));
  const mid={x:(points[2].x+points[3].x)/2,y:(points[2].y+points[3].y)/2};
  const span=Math.max(.08,Math.abs(points[2].x-points[3].x));
  // Upper-body framing is supported; unseen hips are only a silhouette scaffold.
  for(const [i,fallback] of [[0,{x:mid.x,y:mid.y-span*.7}],[23,{x:points[2].x,y:mid.y+span*1.6}],[24,{x:points[3].x,y:mid.y+span*1.6}]])points.push(p[i]?.visibility>.5?{x:clamp(1-p[i].x),y:clamp(p[i].y)}:fallback);
  return {t:Math.round(clamp(t,0,DURATION)),points};
}
export function createMotionRecord(frames,index){
  const clean=frames.filter((f,i)=>f&&(!i||f.t>frames[i-1].t)&&f.t<=DURATION);
  // Require meaningful coverage, not a lone final pose or a brief detection.
  let coverage=0;for(let i=1;i<clean.length;i++){const dt=clean[i].t-clean[i-1].t;if(dt<=350)coverage+=dt;}
  if(clean.length<20||coverage<2500)return null;
  const record=createRecord([clean.map(f=>f.points[0]),clean.map(f=>f.points[5])],null,index);
  return {...record,version:6,index,duration:DURATION,coverage,frames:clean.map(f=>({t:f.t,points:f.points.map(p=>({...p}))}))};
}
// Interpolate only across short tracking gaps. Never invent a path across lost tracking.
export function poseAt(record,time){
  const fs=record.frames;if(!fs?.length)return null;
  if(time<fs[0].t||time>fs.at(-1).t)return null;
  let lo=0,hi=fs.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(fs[mid].t<=time)lo=mid;else hi=mid-1;}
  const a=fs[lo],b=fs[Math.min(lo+1,fs.length-1)];
  if(b.t-a.t>350&&time>a.t)return null;
  const k=b.t===a.t?0:(time-a.t)/(b.t-a.t);
  return a.points.map((p,i)=>({x:p.x+(b.points[i].x-p.x)*k,y:p.y+(b.points[i].y-p.y)*k}));
}
export function playbackTime(record,elapsed){return ((elapsed%record.duration)+record.duration)%record.duration;}
export function loopOpacity(time,duration=DURATION){return Math.min(1,time/250,(duration-time)/250);}

const COLORS=[['#153f60','#46c0db','#aab4ef'],['#193f41','#3db49d','#ce7b83'],['#253e73','#6c9cd7','#d3bb64'],['#164f49','#75b89c','#c5be76'],['#4d365a','#b787bb','#71a4ca'],['#24485a','#64bbca','#ce90b0']];
function contour(c,p,w,h){
  const q=p.map(v=>({x:v.x*w,y:v.y*h}));
  c.beginPath();c.moveTo(q[0].x,q[0].y);
  for(let i=1;i<q.length;i++){const n=q[(i+1)%q.length];c.quadraticCurveTo(q[i].x,q[i].y,(q[i].x+n.x)/2,(q[i].y+n.y)/2);}
  c.quadraticCurveTo(q[0].x,q[0].y,q[0].x,q[0].y);c.closePath();
}
export function renderMotion(c,record,w,h,time,alpha=1){
  const points=poseAt(record,time);if(!points)return;
  const col=COLORS[record.palette%COLORS.length],s=Math.min(w,h);
  // Optical surfaces use the entire evolving arm span. No face/head or stick skeleton.
  const center={x:(points[2].x+points[3].x)/2,y:(points[2].y+points[3].y)/2+.2};
  const previous=poseAt(record,Math.max(0,time-280));
  const surfaces=[previous&&[previous[0],previous[1],previous[2],center,previous[4],previous[5]],
    [points[0],points[1],points[2],center,points[4],points[5]]].filter(Boolean);
  c.save();
  surfaces.forEach((p,i)=>{
    const g=c.createLinearGradient(w*.15,h*.2,w*.9,h*.85);g.addColorStop(0,col[2]);g.addColorStop(.35,col[1]);g.addColorStop(.65,col[0]);g.addColorStop(1,col[1]);
    c.globalAlpha=alpha*(i===surfaces.length-1?.8:.22);c.fillStyle=g;c.filter=`blur(${s*.021}px)`;contour(c,p,w,h);c.fill();
    c.globalAlpha=alpha*(i===surfaces.length-1?.7:.12);c.filter=`blur(${s*.005}px)`;contour(c,p,w,h);c.fill();
  });c.restore();
}

// Soft volumes follow the measured head, shoulders, elbows, wrists and hips.
export function renderBody(c,r,w,h,time,alpha=1,edition='2'){
  const p=poseAt(r,time);if(!p)return;
  const index=r.index||0,span=Math.max(.08,Math.hypot(p[2].x-p[3].x,p[2].y-p[3].y));
  const mid={x:(p[2].x+p[3].x)/2,y:(p[2].y+p[3].y)/2};
  const head=p[6]||{x:mid.x,y:mid.y-span*.72};
  const hips=[p[7]||{x:p[2].x,y:mid.y+span*1.6},p[8]||{x:p[3].x,y:mid.y+span*1.6}];
  const scale=.66+(index%3)*.08,cx=index===0?.5:.18+((index*.61803398875)%1)*.64,cy=.45+(index%3)*.065;
  const s=Math.min(w,h*1.6)*scale*.22/span,q=v=>({x:(v.x-mid.x)*s+cx*w,y:(v.y-mid.y)*s+cy*h});
  const pts=p.map(q),hd=q(head),hp=hips.map(q),radius=span*s;
  const palettes=[['#1639bd','#f8c840'],['#df417f','#62c4cf'],['#087f64','#ef674e'],['#563c93','#83bfdf'],['#f06b4c','#51b88a'],['#254cbe','#ed738d']];
  const col=palettes[index%palettes.length];
  function body(){
    c.beginPath();c.ellipse(hd.x,hd.y,radius*.3,radius*.39,-.12,0,Math.PI*2);c.fill();
    c.beginPath();c.moveTo(pts[2].x,pts[2].y);c.quadraticCurveTo(hd.x,hd.y+radius*.15,pts[3].x,pts[3].y);
    c.lineTo(hp[1].x+radius*.12,hp[1].y);c.quadraticCurveTo((hp[0].x+hp[1].x)/2,hp[0].y+radius*.45,hp[0].x-radius*.12,hp[0].y);c.closePath();c.fill();
    c.lineCap='round';c.lineJoin='round';
    for(const ids of [[2,1,0],[3,4,5]]){c.lineWidth=radius*.32;c.beginPath();c.moveTo(pts[ids[0]].x,pts[ids[0]].y);c.quadraticCurveTo(pts[ids[1]].x,pts[ids[1]].y,pts[ids[2]].x,pts[ids[2]].y);c.stroke();}
  }
  c.save();
  for(const [blur,opacity,offset] of [[radius*.25,.6,radius*.2],[radius*.1,.85,0]]){
    c.save();c.translate(offset,0);c.filter=`blur(${blur}px)`;c.globalAlpha=alpha*opacity;
    const g=c.createLinearGradient(cx*w-radius,cy*h-radius,cx*w+radius,cy*h+radius*1.7);
    g.addColorStop(0,col[0]);g.addColorStop(.48,edition==='2'?'#193b37':col[0]);g.addColorStop(1,col[1]);c.fillStyle=g;c.strokeStyle=g;body();c.restore();
  }
  c.globalAlpha=alpha*(edition==='2'?.65:.36);c.filter=`blur(${radius*.075}px)`;c.fillStyle='#14212a';c.strokeStyle='#14212a';body();c.restore();
}

// Synthetic movement is confined to operator rehearsal and automated tests.
export function demoFrames(){return Array.from({length:126},(_,i)=>{const t=i*80,a=t/10000*Math.PI*2;return {t,points:[
  {x:.22+.14*Math.sin(a),y:.4-.2*Math.cos(a)}, {x:.34+.06*Math.sin(a),y:.48-.1*Math.cos(a)},
  {x:.44,y:.43},{x:.56,y:.43},{x:.66+.07*Math.sin(a+1),y:.5+.12*Math.cos(a)},
  {x:.78+.12*Math.sin(a+1),y:.4+.24*Math.cos(a+1)}]};});}
