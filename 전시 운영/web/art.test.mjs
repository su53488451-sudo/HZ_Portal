import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecord,raisedHand,usablePose,buildMotionShape,motionProfile,poseSurfaces} from './art.mjs';
const pose=()=>Array.from({length:33},()=>({x:.5,y:.5,visibility:.95}));
test('different observed movements produce different geometry with the same color',()=>{
 const a=createRecord([[{x:.1,y:.2},{x:.3,y:.5},{x:.6,y:.8}]],null,0),b=createRecord([[{x:.8,y:.2},{x:.5,y:.6},{x:.1,y:.4}]],null,0);
 assert.equal(a.palette,b.palette);assert.notDeepEqual(buildMotionShape(a.paths[0],.1).contours,buildMotionShape(b.paths[0],.1).contours);
});
test('empty recordings are not saved; final pose retains its own path index',()=>{
 assert.equal(createRecord([[],[]],null,0),null);const p=pose();p[15].x=.2;
 const a=createRecord([[],[]],p,0);assert.equal(a.paths[0][0].x,.8);assert.equal(a.armPathIndex,0);assert.equal(a.version,4);
});
test('hand raise requires visible wrist above a visible head',()=>{
 const p=pose();assert.equal(raisedHand(p),false);p[15].y=.2;assert.equal(raisedHand(p),true);p[15].visibility=.1;assert.equal(raisedHand(p),false);assert.equal(usablePose(p),false);assert.equal(raisedHand(null),false);
});
test('closed movements retain an opening while straight reaches have real width',()=>{
 const loop=Array.from({length:33},(_,i)=>({x:.5+.3*Math.cos(i*Math.PI/16),y:.5+.3*Math.sin(i*Math.PI/16)}));
 const closed=buildMotionShape(loop,.1),line=buildMotionShape([{x:.1,y:.5},{x:.9,y:.5}],.1);
 assert.equal(closed.profile.closed,true);assert.equal(closed.contours.length,2);assert.ok(line.contours.length>0);
 const ys=line.contours.flat().map(p=>p.y);assert.ok(Math.max(...ys)-Math.min(...ys)>.02);
});
test('direction changes preserve angular features instead of rounding all gestures',()=>{
 const zigzag=[{x:.1,y:.2},{x:.3,y:.8},{x:.5,y:.2},{x:.7,y:.8},{x:.9,y:.2}];
 const straight=[{x:.1,y:.2},{x:.5,y:.201},{x:.9,y:.2}];
 assert.ok(motionProfile(zigzag).angularity>.7);assert.equal(motionProfile(straight).angularity,0);
});
test('stationary or duplicate positions do not create invalid surfaces',()=>{
 const a={x:.5,y:.5};assert.deepEqual(buildMotionShape([a,a,a],.1).contours,[]);
 const path=buildMotionShape([a,a,{x:.9,y:.6},{x:.9,y:.6}],.1);assert.ok(path.contours.flat().every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('arm spread and bent poses generate different polygonal surfaces',()=>{
 const wide=[{x:.1,y:.4},{x:.25,y:.4},{x:.4,y:.45},{x:.6,y:.45},{x:.75,y:.4},{x:.9,y:.4}];
 const folded=wide.map(p=>({...p}));folded[0]={x:.55,y:.7};folded[1]={x:.25,y:.7};folded[5]={x:.45,y:.7};folded[4]={x:.75,y:.7};
 assert.equal(poseSurfaces(wide).length,2);assert.notDeepEqual(poseSurfaces(wide),poseSurfaces(folded));
});
test('noisy tracking is bounded and crossing triangles have consistent winding',()=>{
 const points=Array.from({length:150},(_,i)=>({x:.1+i*.005,y:.5+Math.sin(i*2)*.008}));
 const s=buildMotionShape(points,.1);assert.ok(s.profile.controls.length<=16);
 for(const [a,b,c] of s.contours)assert.ok((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)>=-1e-10);
});
