import {clamp,createRecord,usablePose} from './art.mjs';

export const DURATION=10000, SAMPLE_MS=80;
const JOINTS=[15,13,11,12,14,16];
export function captureFrame(p,t){
  if(!usablePose(p)||!JOINTS.every(i=>p[i]?.visibility>.5))return null;
  return {t:Math.round(clamp(t,0,DURATION)),points:JOINTS.map(i=>({x:Math.round(clamp(1-p[i].x)*10000)/10000,y:Math.round(clamp(p[i].y)*10000)/10000}))};
}
export function createMotionRecord(frames,index){
  const clean=frames.filter((f,i)=>f&&(!i||f.t>frames[i-1].t)&&f.t<=DURATION);
  // Require meaningful coverage, not a lone final pose or a brief detection.
  let coverage=0;for(let i=1;i<clean.length;i++){const dt=clean[i].t-clean[i-1].t;if(dt<=350)coverage+=dt;}
  if(clean.length<20||coverage<2500)return null;
  const record=createRecord([clean.map(f=>f.points[0]),clean.map(f=>f.points[5])],null,index);
  return {...record,version:5,duration:DURATION,coverage,frames:clean.map(f=>({t:f.t,points:f.points.map(p=>({...p}))}))};
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

// Synthetic movement is confined to operator rehearsal and automated tests.
export function demoFrames(){return Array.from({length:126},(_,i)=>{const t=i*80,a=t/10000*Math.PI*2;return {t,points:[
  {x:.22+.14*Math.sin(a),y:.4-.2*Math.cos(a)}, {x:.34+.06*Math.sin(a),y:.48-.1*Math.cos(a)},
  {x:.44,y:.43},{x:.56,y:.43},{x:.66+.07*Math.sin(a+1),y:.5+.12*Math.cos(a)},
  {x:.78+.12*Math.sin(a+1),y:.4+.24*Math.cos(a+1)}]};});}
