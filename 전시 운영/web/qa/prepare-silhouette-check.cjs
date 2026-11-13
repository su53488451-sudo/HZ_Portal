const fs=require('node:fs'),path=require('node:path');
const photo=fs.readFileSync(path.join(__dirname,'pose.jpg')).toString('base64');
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><title>실제 사람 외곽 검사</title>
<style>body{margin:24px;background:#e4f6ef;color:#183e30;font:15px system-ui}h1{font-size:20px}img{width:200px}canvas{width:900px;height:506px;display:block;background:#e4f6ef}li{margin:8px}</style>
<h1>공개 테스트 사진 → 실제 몸 외곽 → 10초 기록 → 잔상 렌더링</h1><p>Google MediaPipe 공개 테스트 사진입니다. 실제 관객 기록에는 저장되지 않습니다.</p>
<img id="source" src="data:image/jpeg;base64,${photo}"><ol id="results"></ol><canvas id="poster" width="1200" height="675"></canvas>
<script type="module">
import {loadImprint} from '../imprint.mjs';
import {FilesetResolver,PoseLandmarker} from '../assets/vision_bundle.mjs';
import {packSilhouette,validSilhouette,silhouetteAt} from '../silhouette.mjs';
import {captureFrame,createMotionRecord,renderBody,validMotionRecord} from '../motion.mjs';
const report=(ok,message)=>{const li=document.createElement('li');li.textContent=(ok?'PASS — ':'FAIL — ')+message;document.querySelector('#results').append(li);if(!ok)throw Error(message);};
let model;
try{
 await loadImprint();
 const source=document.querySelector('#source');await source.decode();
 const files=await FilesetResolver.forVisionTasks('../assets/wasm');
 model=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'../assets/pose_landmarker_lite.task',delegate:'GPU'},runningMode:'IMAGE',numPoses:1,outputSegmentationMasks:true});
 const result=model.detect(source),mask=result.segmentationMasks?.[0];report(!!mask&&!!result.landmarks[0],'실제 MediaPipe 모델이 사람과 전경 마스크를 반환함');
 const shape=packSilhouette(mask.getAsFloat32Array(),mask.width,mask.height,source.naturalWidth/source.naturalHeight);
 report(validSilhouette(shape),'머리·옷·팔의 실제 픽셀 외곽을 압축함');
 const frames=Array.from({length:126},(_,i)=>({...captureFrame(result.landmarks[0],i*80),shape}));result.close();
 const record=createMotionRecord(frames,0);report(record?.capture==='silhouette'&&validMotionRecord(record),'10초 전체 외곽 기록이 새 포맷으로 저장 가능함');
 const saved=JSON.parse(JSON.stringify(record));report(JSON.stringify(silhouetteAt(saved,5000))===JSON.stringify(shape),'저장/복원 후 실제 외곽 유지');
 const c=document.querySelector('#poster'),ctx=c.getContext('2d');
 for(let i=0;i<6;i++)renderBody(ctx,{...saved,index:i},1200,675,5000,1,'2');
 const data=ctx.getImageData(0,0,1200,675).data;let colored=0;for(let i=3;i<data.length;i+=4)if(data[i]>40)colored++;
 report(colored>20000,'실제 사람 외곽이 다색 잔상으로 렌더링됨');
 document.title='PASS — 실제 몸 외곽 검사';
}catch(e){report(false,e.message);}finally{model?.close();}
</script></html>`;
fs.writeFileSync(path.join(__dirname,'silhouette-check.html'),html);
