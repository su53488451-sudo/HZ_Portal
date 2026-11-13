import test from 'node:test';
import assert from 'node:assert/strict';
import {imprintAppearance,renderImprint} from './imprint.mjs';
import {demoFrames} from './motion.mjs';

test('each saved trace retains its random 20–90% size and style after reload',()=>{
  const profiles=Array.from({length:1000},(_,index)=>{
    const record={index,seed:index*.137};
    const profile=imprintAppearance(record);
    assert.deepEqual(profile,imprintAppearance(JSON.parse(JSON.stringify(record))));
    assert.ok(profile.scale>=.2&&profile.scale<=.9);
    return profile;
  });
  assert.ok(profiles.some(p=>p.scale<.25));assert.ok(profiles.some(p=>p.scale>.85));
  const count=style=>profiles.filter(p=>p.style===style).length;
  assert.ok(count('soft')>350&&count('flow')>350);
  assert.ok(count('transparent')>40&&count('transparent')<160);
});

test('rendering retains captured data and supports the smallest legacy trace without a sharp pass',()=>{
  const points=demoFrames()[20].points,previous=demoFrames()[17].points;
  const record={index:14,seed:12.4,frames:[{points}]},before=JSON.stringify(record);
  const filters=[];
  const c=new Proxy({createLinearGradient(){return {addColorStop(){}};}},{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>{if(key==='filter')filters.push(value);target[key]=value;return true;}});
  renderImprint(c,record,points,previous,720,405,1);
  assert.equal(JSON.stringify(record),before);
  assert.ok(filters.length>=3&&filters.every(f=>Number.parseFloat(f.slice(5))>=.8));
});
