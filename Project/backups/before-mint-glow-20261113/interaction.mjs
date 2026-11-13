import {raisedHand,usablePose,clamp} from './art.mjs';

// A visible lowered hand rearms the next session. Losing tracking does not.
export function createHandGate(){
  let heldAt=null,loweredAt=null,armed=true;
  return {
    update(p,now,eligible){
      if(!usablePose(p)){heldAt=null;loweredAt=null;return {progress:0,start:false};}
      if(!raisedHand(p)){
        heldAt=null;loweredAt??=now;if(now-loweredAt>=450)armed=true;
        return {progress:0,start:false};
      }
      loweredAt=null;
      if(!eligible||!armed){heldAt=null;return {progress:0,start:false};}
      heldAt??=now;const progress=clamp((now-heldAt)/1100);
      if(progress===1){armed=false;heldAt=null;return {progress:1,start:true};}
      return {progress,start:false};
    }
  };
}
