export function cameraMessage(error){
  const name=error?.name;
  if(name==='NotAllowedError'||name==='SecurityError')return '주소창의 카메라 권한을 허용한 뒤 ‘카메라·소리 연결’을 눌러 주세요.';
  if(name==='NotFoundError')return '연결된 웹캠을 찾지 못했어요. USB 연결을 확인한 뒤 다시 연결해 주세요.';
  if(name==='NotReadableError')return '다른 앱에서 카메라를 사용 중일 수 있어요. 해당 앱을 닫고 다시 연결해 주세요.';
  if(name==='TimeoutError')return '카메라 준비가 오래 걸리고 있어요. 권한 창과 USB 연결을 확인한 뒤 다시 시도해 주세요.';
  return '카메라를 준비하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.';
}
export function withTimeout(promise,ms,onLate=()=>{}){
  let expired=false,timer;
  return Promise.race([
    Promise.resolve(promise).then(value=>{if(expired){onLate(value);return;}return value;}),
    new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;const error=new Error('작업 시간 초과');error.name='TimeoutError';reject(error);},ms);})
  ]).finally(()=>clearTimeout(timer));
}
