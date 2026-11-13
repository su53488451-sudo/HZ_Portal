import test from 'node:test';
import assert from 'node:assert/strict';
import {imprintAppearance,imprintTransform,APPROVED_TRACE_URL} from './imprint.mjs';
import {demoFrames,DURATION,replayElapsed} from './motion.mjs';

test('random size is 30–90% and survives reload without changing',()=>{
 const sizes=Array.from({length:1000},(_,index)=>{
  const r={index,seed:index*.137},a=imprintAppearance(r);
  assert.deepEqual(a,imprintAppearance(JSON.parse(JSON.stringify(r))));
  assert.ok(a.scale>=.3&&a.scale<=.9);assert.ok(a.opacity>=.7&&a.opacity<=1);assert.ok(a.palette>=0&&a.palette<5);return a.scale;
 });
 assert.ok(Math.min(...sizes)<.35&&Math.max(...sizes)>.85);
});
test('placement follows recorded motion without changing the assigned size',()=>{
 const frames=demoFrames(),record={index:0,seed:.4,frames},before=JSON.stringify(record);
 const a=imprintTransform(record,frames[0].points,1672,941),b=imprintTransform(record,frames[40].points,1672,941);
 assert.ok(Math.hypot(b.x-a.x,b.y-a.y)>10);
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);
 assert.ok(Math.abs(a.width/a.height-1672/941)<1e-10);
 assert.ok(APPROVED_TRACE_URL.endsWith('/approved-afterimages/05.png'));
 assert.equal(JSON.stringify(record),before);
});
test('recording remains ten seconds and replay is 65% speed',()=>{
 assert.equal(DURATION,10000);assert.equal(replayElapsed(10000),6500);
 assert.ok(Math.abs(replayElapsed(10000/.65)-10000)<1e-8);
});
