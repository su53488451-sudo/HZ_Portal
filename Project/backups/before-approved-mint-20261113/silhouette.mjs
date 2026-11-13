// Compact, mirrored person outlines. No camera RGB pixels are retained.
export function packSilhouette(mask,width,height,aspect=4/3){
  if(!mask||mask.length!==width*height||width<1||height<1)return null;
  const w=160,h=Math.max(40,Math.min(240,Math.round(w/aspect))),runs=[];
  let occupied=0;
  for(let y=0;y<h;y++){
    const sy=Math.min(height-1,Math.floor((y+.5)/h*height));let start=-1;
    for(let x=0;x<=w;x++){
      const sx=Math.min(width-1,Math.floor((1-(x+.5)/w)*width));
      const inside=x<w&&mask[sy*width+sx]>=.48;
      if(inside&&start<0)start=x;
      if(!inside&&start>=0){runs.push(y*w+start,x-start);occupied+=x-start;start=-1;}
    }
  }
  if(occupied<30||occupied>w*h*.94)return null;
  return {width:w,height:h,runs};
}
export function validSilhouette(s){
  if(!s||s.width!==160||!Number.isInteger(s.height)||s.height<40||s.height>240||!Array.isArray(s.runs)||s.runs.length<2||s.runs.length>12000||s.runs.length%2)return false;
  let end=-1;
  for(let i=0;i<s.runs.length;i+=2){const start=s.runs[i],length=s.runs[i+1];if(!Number.isInteger(start)||!Number.isInteger(length)||start<0||length<1||start<=end||start+length>s.width*s.height||start%s.width+length>s.width)return false;end=start+length-1;}
  return true;
}
export function silhouetteAt(record,time){
  const frames=record.frames;if(!frames?.length||time<frames[0].t||time>frames.at(-1).t)return null;
  let lo=0,hi=frames.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid].t<=time)lo=mid;else hi=mid-1;}
  const a=frames[lo],b=frames[lo+1];if(b&&b.t-a.t>350&&time>a.t)return null;
  const nearest=b&&b.t-time<time-a.t?b:a;
  return Math.abs(nearest.t-time)<=180?nearest.shape||null:null;
}
export function silhouettePath(c,shape,g,size){
  const scale=size/g.span,aspect=shape.height/shape.width;
  const bottom=(g.hips[0].y+g.hips[1].y)/2+.35;
  c.beginPath();
  for(let i=0;i<shape.runs.length;i+=2){const offset=shape.runs[i],length=shape.runs[i+1];
    if((Math.floor(offset/shape.width)/shape.height-g.mid.y)/g.span>bottom)continue;
    c.rect((offset%shape.width/shape.width-g.mid.x)*scale,(Math.floor(offset/shape.width)/shape.height-g.mid.y)*scale*aspect,length/shape.width*scale,scale/shape.width+.05);
  }
  c.fill();
}
