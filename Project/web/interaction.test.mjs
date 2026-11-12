import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandGate} from './interaction.mjs';
const pose=raised=>{const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:.95}));p[15].y=raised?.2:.8;p[16].y=.8;return p;};
test('only a continuous 1.1 second hold starts a ready exhibition',()=>{
 const gate=createHandGate(),up=pose(true);
 assert.equal(gate.update(up,0,false).start,false);
 assert.equal(gate.update(up,2000,true).start,false);
 assert.equal(gate.update(up,3000,true).start,false);
 assert.equal(gate.update(up,3100,true).start,true);
 assert.equal(gate.update(up,9000,true).start,false);
});
test('tracking loss does not rearm; a visible lowered hand does',()=>{
 const gate=createHandGate(),up=pose(true),down=pose(false);
 gate.update(up,0,true);assert.equal(gate.update(up,1100,true).start,true);
 gate.update(null,2000,true);gate.update(up,3000,true);assert.equal(gate.update(up,5000,true).start,false);
 gate.update(down,6000,false);gate.update(down,6500,false);gate.update(up,7000,true);assert.equal(gate.update(up,8100,true).start,true);
});
test('leaving the camera or opening setup resets an unfinished hold',()=>{
 const gate=createHandGate(),up=pose(true);gate.update(up,0,true);gate.update(null,900,true);
 gate.update(up,1000,true);assert.equal(gate.update(up,1200,true).start,false);
 gate.update(up,1900,false);gate.update(up,2000,true);assert.equal(gate.update(up,2100,true).start,false);
});
