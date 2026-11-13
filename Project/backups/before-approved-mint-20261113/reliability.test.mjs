import test from 'node:test';
import assert from 'node:assert/strict';
import {withTimeout,cameraMessage} from './reliability.mjs';
import {captureFrame,createMotionRecord,validMotionRecord,demoFrames} from './motion.mjs';
import {imprintContour,imprintPlacement} from './imprint.mjs';
test('permission denial, missing camera and busy camera have actionable distinct recovery',()=>{
  const messages=['NotAllowedError','NotFoundError','NotReadableError','TimeoutError'].map(name=>cameraMessage({name}));
  assert.equal(new Set(messages).size,4);assert.match(messages[0],/권한/);assert.match(messages[1],/USB/);assert.match(messages[2],/다른 앱/);
});
test('timeout rejects but disposes a camera that resolves after the deadline',async()=>{
 let dispose=false,resolve;const permission=new Promise(r=>resolve=r);
 await assert.rejects(withTimeout(permission,5,()=>dispose=true),{name:'TimeoutError'});
 resolve({stream:true});await new Promise(r=>setTimeout(r,0));assert.equal(dispose,true);
 assert.equal(await withTimeout(Promise.resolve('ready'),50),'ready');
});
test('partial or non-finite tracking cannot become a ten-second poster',()=>{
 assert.equal(createMotionRecord(demoFrames().slice(0,65),0),null);
 assert.equal(createMotionRecord(demoFrames().slice(30),0),null);
 const p=Array.from({length:33},()=>({x:.4,y:.4,visibility:1}));p[15].x=NaN;assert.equal(captureFrame(p,0),null);
 const r=createMotionRecord(demoFrames(),0);assert.equal(validMotionRecord(r),true);r.frames[5].points[0].x=Infinity;assert.equal(validMotionRecord(r),false);
});
test('saved corrupt timelines are rejected without feeding the renderer',()=>{
 assert.equal(validMotionRecord({}),false);const r=createMotionRecord(demoFrames(),0);r.frames[4].t=0;assert.equal(validMotionRecord(r),false);
 assert.doesNotThrow(()=>createMotionRecord([null,...demoFrames(),{t:5000,points:null}],0));
});
test('organic contour responds to actual motion, remains finite, and stays inside the composition',()=>{
 const frames=demoFrames();const a=imprintContour(frames[10].points),b=imprintContour(frames[75].points);
 assert.notDeepEqual(a.curve,b.curve);assert.equal(a.curve.length,6);assert.ok(a.curve.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));assert.ok(a.head.y<0);assert.ok(a.hips.every(p=>p.y>0));
 for(let i=0;i<16000;i++){const p=imprintPlacement(i);assert.ok(p.x>=.15&&p.x<=.84&&p.y>=.18&&p.y<=.8);}
});
