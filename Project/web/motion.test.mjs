import test from 'node:test';
import assert from 'node:assert/strict';
import {captureFrame,createMotionRecord,poseAt,playbackTime,loopOpacity,demoFrames} from './motion.mjs';
test('stores the full 10 second sequence, preserving early and late movement after serialization',()=>{
 const r=createMotionRecord(demoFrames(),0),saved=structuredClone(r);
 assert.equal(r.version,5);assert.equal(r.duration,10000);assert.equal(r.frames.length,126);
 assert.notDeepEqual(poseAt(saved,1000),poseAt(saved,7000));assert.equal(playbackTime(saved,11000),1000);
 assert.deepEqual(poseAt(saved,playbackTime(saved,11000)),poseAt(r,1000));
});
test('interpolates timestamps, never mutating saved frames',()=>{
 const r=createMotionRecord(demoFrames(),0),before=JSON.stringify(r);
 const p=poseAt(r,40),a=r.frames[0].points[0],b=r.frames[1].points[0];
 assert.ok(Math.abs(p[0].x-(a.x+b.x)/2)<1e-10);assert.equal(JSON.stringify(r),before);
});
test('tracking gaps do not invent motion or hold the last pose indefinitely',()=>{
 const r=createMotionRecord(demoFrames().filter(f=>f.t<2000||f.t>5000),0);
 assert.equal(poseAt(r,3500),null);assert.equal(poseAt(r,10001),null);
 assert.equal(createMotionRecord(demoFrames().slice(0,15),0),null);
 assert.equal(createMotionRecord([demoFrames()[0],demoFrames().at(-1)],0),null);
 assert.equal(loopOpacity(0),0);assert.equal(loopOpacity(10000),0);
});
test('capture rejects missing elbows and copies mirrored coordinates with timestamp',()=>{
 const p=Array.from({length:33},()=>({x:.3,y:.4,visibility:1}));const f=captureFrame(p,1234.5);
 assert.equal(f.t,1235);assert.equal(f.points[0].x,.7);p[15].x=.8;assert.equal(f.points[0].x,.7);
 p[13].visibility=.1;assert.equal(captureFrame(p,0),null);
});
