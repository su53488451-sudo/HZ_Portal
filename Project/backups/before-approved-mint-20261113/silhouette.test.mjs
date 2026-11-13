import test from 'node:test';
import assert from 'node:assert/strict';
import {packSilhouette,validSilhouette,silhouetteAt} from './silhouette.mjs';
import {createMotionRecord,demoFrames,validMotionRecord} from './motion.mjs';
test('mask retains clothing width and holes, and mirrors the actual pixels',()=>{
  const mask=new Float32Array(160*120);
  for(let y=20;y<100;y++)for(let x=20;x<70;x++)mask[y*160+x]=1;
  for(let y=40;y<70;y++)for(let x=35;x<50;x++)mask[y*160+x]=0;
  const shape=packSilhouette(mask,160,120);
  assert.ok(validSilhouette(shape));const restored=new Uint8Array(mask.length);
  for(let i=0;i<shape.runs.length;i+=2)restored.fill(1,shape.runs[i],shape.runs[i]+shape.runs[i+1]);
  for(let y=0;y<120;y++)for(let x=0;x<160;x++)assert.equal(restored[y*160+x],mask[y*160+159-x]);
});
test('blank/invalid masks and malformed saved runs are rejected',()=>{
  assert.equal(packSilhouette(new Float32Array(4),3,3),null);
  assert.equal(packSilhouette(new Float32Array(19200),160,120),null);
  assert.equal(validSilhouette({width:160,height:120,runs:[159,3]}),false);
  assert.equal(validSilhouette({width:160,height:120,runs:[160,5,162,2]}),false);
});
test('full outline sequence survives persistence and does not invent silhouettes across gaps',()=>{
  const mask=new Float32Array(160*120);for(let y=20;y<110;y++)for(let x=50;x<90;x++)mask[y*160+x]=1;
  const shape=packSilhouette(mask,160,120),frames=demoFrames().map(f=>({...f,shape}));
  const record=createMotionRecord(frames,0);assert.equal(record.capture,'silhouette');assert.ok(validMotionRecord(record));
  const saved=JSON.parse(JSON.stringify(record));assert.deepEqual(silhouetteAt(saved,1000),shape);
  frames[0].shape.runs[0]=0;assert.notEqual(record.frames[0].shape.runs[0],0);
  saved.frames=saved.frames.filter(f=>f.t<3000||f.t>6000);assert.equal(silhouetteAt(saved,4000),null);
  saved.frames[0].shape.runs[1]=-1;assert.equal(validMotionRecord(saved),false);
});
