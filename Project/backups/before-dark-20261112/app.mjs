import {ambient,background,renderRecord,createRecord,usablePose,clamp,simplify} from './art.mjs';
import {createHandGate} from './interaction.mjs';
const $=id=>document.getElementById(id),canvas=$('art'),ctx=canvas.getContext('2d');
const plate=document.createElement('canvas'),pc=plate.getContext('2d');
const live=document.createElement('canvas'),lc=live.getContext('2d');
const newLayer=document.createElement('canvas'),nc=newLayer.getContext('2d');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const params=new URLSearchParams(location.search),previewMode=params.has('preview'),testMode=params.has('test');
const gate=createHandGate();
let w=innerWidth,h=innerHeight,dpr=1,records=[],db,storageReady=false,state='idle',landmarker,stream,loading=false;
let pose=null,lastPoseAt=0,traces=[[],[]],capturedPose=null,startAt=0,lastSample=0,lastCount=11,lastVideo=-1,lastInfer=0;
let audio,sound=false,returnTimer,latest=null,revealAt=0,lastLivePaint=0,lastPaint=0;
function showNotice(message){$('notice').textContent=message;$('notice').hidden=false;clearTimeout(showNotice.timer);showNotice.timer=setTimeout(()=>$('notice').hidden=true,6000);}
function status(message,type=''){$('status-text').textContent=message;$('status').className=`status ${type}`;$('status').hidden=type==='ready';}
function ready(){return !!landmarker&&!!stream&&sound&&audio?.state==='running'&&storageReady;}
function updateReady(){
  const active=ready();$('ready-dot').className=active?'ready':'';$('ready-label').textContent=active?'체험 준비 완료':'준비 전';
  $('operator-status').textContent=`카메라 ${landmarker?'연결됨':'미연결'} · 소리 ${sound&&audio?.state==='running'?'켜짐':'연결 필요'} · 기록 ${storageReady?'준비됨':'미연결'}`;
  if(state==='idle')status(active?'화면 앞에 서서, 두 손과 상체를 보여 주세요.':'전시를 준비하고 있습니다',active?'ready':'');
}
function setState(next){state=next;document.body.dataset.state=next;$('intro').hidden=next!=='idle';$('recording').hidden=next!=='recording';$('result').hidden=next!=='result';$('gesture-progress').hidden=true;}
function updateCount(){$('total').textContent=String(records.length);}
function resizeLayer(c){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);c.getContext('2d').setTransform(dpr,0,0,dpr,0,0);}
function rebuild(){pc.clearRect(0,0,w,h);for(const r of records)if(r!==latest)renderRecord(pc,r,w,h);}
function resize(){w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,1.5);[canvas,plate,live,newLayer].forEach(resizeLayer);rebuild();if(latest)renderRecord(nc,latest,w,h);lastLivePaint=0;}
async function storage(){
  try{
    db=await new Promise((resolve,reject)=>{const r=indexedDB.open(testMode?'forms-of-presence-qa':'forms-of-presence-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('forms',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
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
  if(!ready()||state!=='idle'||!$('operator-panel').hidden)return;
  clearTimeout(returnTimer);traces=[[],[]];capturedPose=null;lastSample=0;lastLivePaint=0;lc.clearRect(0,0,w,h);startAt=performance.now();lastCount=11;
  $('record-hint').textContent='천천히, 크게. 당신만의 빛을 남겨 주세요.';setState('recording');
}
async function finish(){
  if(state!=='recording')return;
  if(performance.now()-lastPoseAt>1200)capturedPose=null;
  const record=createRecord(traces,capturedPose,records.length);
  if(!record){setState('idle');status('움직임을 읽지 못했습니다. 두 손과 상체를 보여 주세요.','error');return;}
  setState('saving');
  try{
    await persist(record);records.push(record);updateCount();latest=record;revealAt=performance.now();nc.clearRect(0,0,w,h);renderRecord(nc,record,w,h);
    setState('result');$('result-copy').textContent=`${records.length}번째 몸짓이 우리의 풍경에 더해졌습니다.`;tone(523,.6);tone(659,.7,.12);tone(784,.9,.24);returnTimer=setTimeout(reset,10000);
  }catch(e){console.error(e);setState('idle');showNotice('기록을 저장하지 못했습니다. 운영자 확인이 필요합니다.');}
}
function mergeLatest(){if(latest){pc.drawImage(newLayer,0,0,w,h);latest=null;}}
function reset(){clearTimeout(returnTimer);mergeLatest();setState('idle');updateReady();}
function samplePose(p,now){
  pose=p;const valid=usablePose(p);
  if(valid){lastPoseAt=now;$('camera-label').textContent=state==='recording'?'움직임을 기록하고 있어요':'두 손과 상체 인식 중';
    if(state==='recording'&&now-lastSample>75){[15,16].forEach((n,i)=>traces[i].push({x:1-p[n].x,y:p[n].y}));capturedPose=p.map(q=>({...q}));lastSample=now;}
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
    const elapsed=(now-startAt)/1000,count=Math.max(0,Math.ceil(10-elapsed));
    if(count!==lastCount){lastCount=count;$('countdown').textContent=String(count).padStart(2,'0');if(count>0)tone(count<=3?660:392,.12);}
    $('time-fill').style.transform=`scaleX(${clamp(1-elapsed/10)})`;
    if(now-lastLivePaint>220){
      lastLivePaint=now;lc.clearRect(0,0,w,h);const paths=traces.filter(p=>p.length>2).map(p=>simplify(p,36));
      const armPathIndex=capturedPose?paths.length:-1;
      if(capturedPose)paths.push([15,13,11,12,14,16].map(i=>({x:1-capturedPose[i].x,y:capturedPose[i].y})));
      if(paths.length)renderRecord(lc,{paths,armPathIndex,width:.095,palette:records.length%6,seed:1},w,h,.88);
    }
    if(elapsed>=10)finish();
  }
  if(now-lastPaint<40)return;lastPaint=now;background(ctx,w,h);
  if(state==='idle'){
    if(records.length){ctx.save();ctx.globalAlpha=.8;ctx.drawImage(plate,0,0,w,h);ctx.restore();}else ambient(ctx,w,h,reduce?0:now);
    const g=ctx.createRadialGradient(w*.5,h*.43,w*.11,w*.5,h*.43,w*.34);g.addColorStop(0,'rgba(237,240,247,.96)');g.addColorStop(.35,'rgba(237,240,247,.85)');g.addColorStop(1,'rgba(237,240,247,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  }else{
    ctx.drawImage(plate,0,0,w,h);
    if(state==='recording'||state==='saving')ctx.drawImage(live,0,0,w,h);
    if(latest){const progress=reduce?1:clamp((now-revealAt)/2300),eased=1-Math.pow(1-progress,3);ctx.save();ctx.globalAlpha=eased;ctx.translate(w*.5,h*.5);ctx.scale(.96+.04*eased,.96+.04*eased);ctx.drawImage(newLayer,-w*.5,-h*.5,w,h);ctx.restore();if(progress===1)mergeLatest();}
  }
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
window.addEventListener('keydown',async e=>{
  if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||previewMode)return;
  if(e.key.toLowerCase()==='o'){setOperator($('operator-panel').hidden);updateReady();}
  if(e.key==='Escape')setOperator(false);
  if(e.key==='Enter'){
    if(e.target instanceof HTMLButtonElement)return;
    e.preventDefault();await prepareExhibition();
  }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='recording')reset();});
window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(t=>t.stop());landmarker?.close();});
window.addEventListener('resize',resize);resize();await storage();
if(testMode)showNotice('동작 검증 모드 · 전시 기록과 분리해 저장합니다.');
if(previewMode){
  const gestures=[
    [[.06,.75],[.1,.35],[.25,.18],[.36,.4],[.3,.7],[.14,.85],[.06,.75]],
    [[.24,.28],[.39,.12],[.44,.42],[.62,.2],[.69,.43]],
    [[.69,.87],[.75,.65],[.81,.36],[.89,.1]],
    [[.14,.55],[.29,.6],[.41,.56],[.49,.54],[.62,.39],[.68,.16]],
    [[.24,.95],[.29,.73],[.38,.83],[.47,.64],[.59,.91]],
    [[.68,.51],[.77,.43],[.89,.49],[.94,.67],[.85,.82],[.74,.74],[.76,.6],[.86,.59]]
  ];
  records=gestures.map((p,i)=>({id:`preview-${i}`,paths:[p.map(([x,y])=>({x,y}))],armPathIndex:i===3?0:-1,palette:i,seed:i*1.7,width:.1}));updateCount();rebuild();setState('poster');showNotice('표현 미리보기 · 예시 움직임이며 참여 기록에 저장되지 않습니다.');
}else{
  // Always offer a visible mouse-operated setup on load; no hidden keyboard prerequisite.
  setOperator(true);
}
requestAnimationFrame(frame);
