import {usablePose,clamp,grain} from './art.mjs';
import {DURATION,SAMPLE_MS,captureFrame,createMotionRecord,playbackTime,loopOpacity,renderBody,demoFrames} from './motion.mjs';
import {scene,loadScene} from './scene.mjs';
import {MovingArchive} from './archive.mjs';
import {createHandGate} from './interaction.mjs';
const $=id=>document.getElementById(id),canvas=$('art'),ctx=canvas.getContext('2d');
const edition=document.body.dataset.design||'2',archive=new MovingArchive(edition);
let epoch=0,resetting=false,posterEpoch=performance.now();
const motionLayer=document.createElement('canvas'),mc=motionLayer.getContext('2d');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const params=new URLSearchParams(location.search),previewMode=params.has('preview'),testMode=params.has('test');
let gate=createHandGate();
let w=innerWidth,h=innerHeight,dpr=1,records=[],db,storageReady=false,state='idle',landmarker,stream,loading=false;
let pose=null,lastPoseAt=0,frames=[],startAt=0,lastSample=-Infinity,lastCount=11,lastVideo=-1,lastInfer=0;
let audio,sound=false,returnTimer,latest=null,revealAt=0,lastPaint=0,brightness=0,rehearsal=false,qaFixture=false;

function showNotice(message){$('notice').textContent=message;$('notice').hidden=false;clearTimeout(showNotice.timer);showNotice.timer=setTimeout(()=>$('notice').hidden=true,6000);}
function status(message,type=''){$('status-text').textContent=message;$('status').className=`status ${type}`;$('status').hidden=type==='ready';}
function ready(){return !!landmarker&&!!stream&&sound&&audio?.state==='running'&&storageReady;}
function updateReady(){
  const active=ready();$('ready-dot').className=active?'ready':'';$('ready-label').textContent=active?'체험 준비 완료':'준비 전';
  $('operator-status').textContent=`카메라 ${landmarker?'연결됨':'미연결'} · 소리 ${sound&&audio?.state==='running'?'켜짐':'연결 필요'} · 기록 ${storageReady?'준비됨':'미연결'}`;
  if(state==='idle')status(active?'화면 앞에 서서, 두 손과 상체를 보여 주세요.':'전시를 준비하고 있습니다',active?'ready':'');
}
function setState(next){state=next;document.body.dataset.state=next;$('intro').hidden=next!=='idle';$('recording').hidden=next!=='recording';$('result').hidden=!['result','poster'].includes(next);$('gesture-progress').hidden=true;}
function updateCount(){$('total').textContent=String(records.length).padStart(4,'0');$('total').parentElement.setAttribute('aria-label',`누적 참여 인원 ${records.length}명`);}
function resizeLayer(c){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);c.getContext('2d').setTransform(dpr,0,0,dpr,0,0);}
function rebuild(){return archive.build(records,w,h);}
function resize(){w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,1.5);[canvas].forEach(resizeLayer);motionLayer.width=Math.min(1000,Math.round(w));motionLayer.height=Math.round(h/w*motionLayer.width);rebuild();}
async function storage(){
  try{
    // A new edition starts at zero once; refreshing must retain new participants.
    // The previous forms-of-presence-v1 archive remains untouched.
    db=await new Promise((resolve,reject)=>{const r=indexedDB.open(`what-remains-edition-${edition}-${testMode?'qa':'live'}-v2`,1);r.onupgradeneeded=()=>r.result.createObjectStore('forms',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    records=await new Promise((resolve,reject)=>{const r=db.transaction('forms').objectStore('forms').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    records.sort((a,b)=>a.created-b.created);storageReady=true;
  }catch(e){console.error(e);showNotice('기록 저장 공간을 사용할 수 없습니다. 운영자 확인이 필요합니다.');}
  updateCount();rebuild();updateReady();
}
function persist(record){return new Promise((resolve,reject)=>{if(!db)return reject(new Error('저장 공간 연결 실패'));const tx=db.transaction('forms','readwrite');tx.objectStore('forms').add(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
async function unlockSound(){
  try{audio??=new AudioContext();await audio.resume();sound=audio.state==='running';audio.onstatechange=()=>{sound=audio.state==='running';updateReady();};return sound;}
  catch(e){console.error(e);sound=false;return false;}
  finally{updateReady();}
}
function tone(f=440,length=.12,delay=0){if(!sound||!audio||audio.state!=='running')return;const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+delay;o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.085,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+length);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+length+.02);}
async function camera(){
  if(landmarker&&stream)return true;if(loading)return false;loading=true;
  status('움직임을 만날 준비를 하고 있습니다…');$('operator-status').textContent='카메라와 움직임 인식을 준비하고 있습니다…';
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'},audio:false});
    $('webcam').srcObject=stream;await $('webcam').play();$('camera-preview').hidden=false;
    const {FilesetResolver,PoseLandmarker}=await import('./assets/vision_bundle.mjs');
    const vision=await FilesetResolver.forVisionTasks('./assets/wasm');
    const config={baseOptions:{modelAssetPath:'./assets/pose_landmarker_lite.task',delegate:'GPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.55,minTrackingConfidence:.55};
    try{landmarker=await PoseLandmarker.createFromOptions(vision,config);}catch{config.baseOptions.delegate='CPU';landmarker=await PoseLandmarker.createFromOptions(vision,config);}
    lastVideo=-1;stream.getVideoTracks()[0].addEventListener('ended',()=>cameraFailed('카메라 연결이 끊겼습니다. Enter 키로 다시 연결해 주세요.'));
    updateReady();if(ready())setOperator(false);return true;
  }catch(e){console.error(e);cameraFailed(e.name==='NotAllowedError'?'카메라 권한을 허용한 뒤 Enter 키를 눌러 주세요.':'카메라 연결에 실패했습니다. Enter 키로 다시 시도해 주세요.');return false;}
  finally{loading=false;}
}
function cameraFailed(message){landmarker?.close();landmarker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;pose=null;$('camera-preview').hidden=true;if(state==='recording')reset();updateReady();$('operator-status').textContent=message;status('카메라를 준비 중입니다. 잠시만 기다려 주세요.','error');}
function begin(){
  if(!ready()||state!=='idle'||resetting||!$('operator-panel').hidden)return;
  startCapture(false);
}
function startCapture(isRehearsal){
  if(resetting||state==='saving'||state==='recording')return;
  clearTimeout(returnTimer);rehearsal=isRehearsal;document.body.dataset.rehearsal=String(rehearsal);
  frames=[];lastSample=-Infinity;startAt=performance.now();lastCount=11;latest=null;
  $('record-hint').textContent='천천히, 크게. 당신만의 움직임을 남겨 주세요.';setState('recording');
}
async function finish(){
  if(state!=='recording')return;
  const token=epoch;
  const record=createMotionRecord(frames,records.length);
  if(!record){reset();showNotice('움직임을 충분히 읽지 못했어요. 두 손과 상체가 보이게 다시 시작해 주세요.');return;}
  setState('saving');
  try{
    if(!rehearsal){await persist(record);if(token!==epoch)return;records.push(record);updateCount();await rebuild();}
    if(token!==epoch)return;posterEpoch=performance.now()+(record.index||0)*997;
    latest=record;revealAt=performance.now();setState('result');
    $('result-copy').textContent=rehearsal?'리허설: 예시 움직임을 재생합니다.':`${records.length}번째 몸짓의 10초를 무빙 포스터로 재생합니다.`;
    tone(523,.6);tone(659,.7,.12);tone(784,.9,.24);returnTimer=setTimeout(reset,22000);
  }catch(e){console.error(e);reset();showNotice('기록을 저장하지 못했습니다. 운영자 확인이 필요합니다.');}
}
async function clearArchive(){
  if(resetting||!db)return;
  resetting=true;epoch++;reset();gate=createHandGate();archive.clear();
  try{
    await new Promise((resolve,reject)=>{const tx=db.transaction('forms','readwrite');tx.objectStore('forms').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
    records=[];updateCount();showNotice('이 버전의 참여 기록을 초기화했습니다 · 0명');
  }catch(e){console.error(e);await storage();showNotice('초기화하지 못했습니다. 저장 공간을 확인해 주세요.');}
  finally{resetting=false;}
}
function reset(){clearTimeout(returnTimer);latest=null;frames=[];rehearsal=false;qaFixture=false;document.body.dataset.rehearsal='false';setState('idle');updateReady();}
function samplePose(p,now){
  pose=p;const valid=usablePose(p);
  if(valid){lastPoseAt=now;$('camera-label').textContent=state==='recording'?'움직임을 기록하고 있어요':'두 손과 상체 인식 중';
    if(state==='recording'&&!rehearsal&&now-lastSample>=SAMPLE_MS){const f=captureFrame(p,now-startAt);if(f){frames.push(f);lastSample=now;}}
  }else $('camera-label').textContent='두 손과 상체가 보이게 서 주세요';
  const eligible=state==='idle'&&ready()&&$('operator-panel').hidden;
  const gesture=gate.update(p,now,eligible);
  $('gesture-progress').hidden=gesture.progress===0||!eligible;$('gesture-progress').firstElementChild.style.width=`${gesture.progress*100}%`;
  if(eligible)status(valid?'좋아요. 한 손을 머리 위로 들어 주세요.':'화면 앞에 서서, 두 손과 상체를 보여 주세요.','ready');
  if(gesture.start)begin();
  if(!$('operator-panel').hidden)drawPose(p);
}
function drawPose(p){
  const c=$('pose-preview');if(c.width!==320){c.width=320;c.height=240;}const cctx=c.getContext('2d');cctx.clearRect(0,0,320,240);if(!p)return;
  cctx.strokeStyle='#a9c8ee';cctx.lineWidth=1.5;cctx.fillStyle='#edb2d4';
  for(const [a,b] of [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24]])if(p[a]?.visibility>.5&&p[b]?.visibility>.5){cctx.beginPath();cctx.moveTo(p[a].x*320,p[a].y*240);cctx.lineTo(p[b].x*320,p[b].y*240);cctx.stroke();}
  for(const n of [11,12,13,14,15,16])if(p[n]?.visibility>.5){cctx.beginPath();cctx.arc(p[n].x*320,p[n].y*240,2.5,0,Math.PI*2);cctx.fill();}
}
function frame(now){
  requestAnimationFrame(frame);if(document.hidden)return;
  if(landmarker&&$('webcam').readyState>=2&&now-lastInfer>65&&$('webcam').currentTime!==lastVideo){
    lastVideo=$('webcam').currentTime;lastInfer=now;
    try{samplePose(landmarker.detectForVideo($('webcam'),now).landmarks[0]||null,now);}catch(e){console.error(e);cameraFailed('움직임 인식이 중단됐습니다. Enter 키로 다시 준비해 주세요.');}
  }
  if(state==='recording'){
    const elapsed=now-startAt,count=Math.max(0,Math.ceil((DURATION-elapsed)/1000));
    if(rehearsal||qaFixture)frames=demoFrames().filter(f=>f.t<=Math.min(elapsed,DURATION));
    if(count!==lastCount){lastCount=count;$('countdown').textContent=String(count).padStart(2,'0');if(count>0)tone(count<=3?660:392,.12);}
    $('time-fill').style.transform='scaleX('+clamp(1-elapsed/DURATION)+')';
    if(!rehearsal)$('record-hint').textContent=now-lastPoseAt>600?'두 손과 상체가 보이게 움직여 주세요.':'천천히, 크게. 당신만의 움직임을 남겨 주세요.';
    if(elapsed>=DURATION)finish();
  }
  if(now-lastPaint<50)return;
  const dt=Math.min(100,now-lastPaint);lastPaint=now;
  const target=['result','poster'].includes(state)?1:0;
  brightness=reduce?target:brightness+(target-brightness)*(1-Math.exp(-dt/550));
  scene(ctx,w,h,reduce?0:now,brightness,edition);
  ctx.save();ctx.globalAlpha=state==='idle'?.55:1;
  archive.draw(ctx,w,h,reduce?5000:now-posterEpoch);ctx.restore();
  mc.clearRect(0,0,motionLayer.width,motionLayer.height);
  if(rehearsal&&latest){const t=reduce?5000:playbackTime(latest,now-revealAt);renderBody(mc,latest,motionLayer.width,motionLayer.height,t,loopOpacity(t),edition);}
  if(state==='recording'&&frames.length){const draft={frames,index:records.length};renderBody(mc,draft,motionLayer.width,motionLayer.height,frames.at(-1).t,.8,edition);}
  ctx.drawImage(motionLayer,0,0,w,h);
  grain(ctx,w,h,.2);

}
// Pointer controls belong to the operator; visitors still start only with a raised hand.
function setOperator(open){
  if(open&&state==='recording')reset();
  $('operator-panel').hidden=!open;$('operator-open').setAttribute('aria-expanded',String(open));
}
async function prepareExhibition(){
  if(previewMode||state==='recording'||$('operator-connect').disabled)return;
  $('operator-connect').disabled=true;$('operator-connect').textContent='연결 중…';
  try{
    const audible=await unlockSound();if(loading)return;
    const connected=await camera();updateReady();
    if(audible&&connected&&storageReady){setOperator(false);tone(523,.25);}else setOperator(true);
  }finally{$('operator-connect').disabled=false;$('operator-connect').textContent=ready()?'카메라·소리 다시 연결':'카메라·소리 연결';}
}
$('operator-open').onclick=()=>{setOperator(true);updateReady();};
$('operator-close').onclick=()=>setOperator(false);
$('operator-connect').onclick=prepareExhibition;
$('operator-reset').onclick=clearArchive;
$('operator-rehearse').onclick=async()=>{await unlockSound();setOperator(false);startCapture(true);};
window.addEventListener('keydown',async e=>{
  if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||previewMode)return;
  if(e.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName))return;
  if(e.key.toLowerCase()==='r'){e.preventDefault();await clearArchive();return;}
  if(e.key.toLowerCase()==='o'){setOperator($('operator-panel').hidden);updateReady();}
  if(e.key==='Escape')setOperator(false);
  if(e.key==='Enter'){
    if(e.target instanceof HTMLButtonElement)return;
    e.preventDefault();await prepareExhibition();
  }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='recording')reset();});
window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(t=>t.stop());landmarker?.close();});
window.addEventListener('resize',resize);resize();await Promise.all([storage(),loadScene().catch(e=>console.warn('기본 배경 대신 단색 배경으로 표시합니다.',e))]);
if(testMode)showNotice('동작 검증 모드 · 전시 기록과 분리해 저장합니다.');
if(previewMode){
  const count=clamp(Number(params.get('preview'))||1,1,8),demo=demoFrames();
  const examples=Array.from({length:count},(_,i)=>createMotionRecord(demo.map((f,j)=>({t:f.t,points:demo[(j+i*19)%demo.length].points})),i));
  latest=null;rehearsal=true;await archive.build(examples,w,h);posterEpoch=performance.now();
  document.body.dataset.rehearsal='true';setState('poster');setOperator(false);
}else setOperator(!params.has('review'));
if(testMode)window.motionQA={
  clear:clearArchive,
  edition,
  start:()=>{setOperator(false);startCapture(true);},
  startFixture:()=>{setOperator(false);qaFixture=true;startCapture(false);},
  snapshot:()=>({state,edition,cachedPhases:archive.layers.length,count:records.length,frames:frames.length,latest:latest&&{version:latest.version,duration:latest.duration,frames:latest.frames.length},rehearsal}),
  readSaved:()=>new Promise((resolve,reject)=>{const r=db.transaction('forms').objectStore('forms').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);})
};
requestAnimationFrame(frame);
