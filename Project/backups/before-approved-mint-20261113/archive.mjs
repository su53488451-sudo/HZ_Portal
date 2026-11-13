import {renderBody,loopOpacity,playbackTime} from './motion.mjs';
// All participants enter every phase, including older ones. Fixed display cost.
export class MovingArchive{
  constructor(edition){this.edition=edition;this.layers=[];this.generation=0;this.count=60;this.blend=document.createElement('canvas');}
  clear(){this.generation++;this.layers=[];this.recordCount=0;}
  async build(records,w,h){
    const width=Math.min(720,Math.round(w)),height=Math.round(h/w*width);
    const incremental=this.layers.length===this.count&&this.recordCount===records.length-1&&this.layers[0].width===width&&this.layers[0].height===height;
    const previous=incremental?this.layers:null;
    const token=++this.generation;
    if(!incremental)this.layers=[];
    const pending=incremental?records.slice(-1):records.slice();
    const layers=Array.from({length:this.count},()=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;});
    for(let phase=0;phase<this.count;phase++){
      if(token!==this.generation)return false;
      const c=layers[phase].getContext('2d'),t=phase/this.count*10000;
      if(previous)c.drawImage(previous[phase],0,0);
      for(let j=0;j<pending.length;j++){
        const r=pending[j],time=playbackTime(r,t+(r.index||0)*997);
        renderBody(c,r,width,height,time,loopOpacity(time),this.edition);
        if(j%100===99){await new Promise(r=>setTimeout(r,0));if(token!==this.generation)return false;}
      }
      if(phase%3===2)await new Promise(r=>setTimeout(r,0));
    }
    if(token!==this.generation)return false;
    this.layers=layers;this.recordCount=records.length;return true;
  }
  draw(c,w,h,elapsed){
    if(!this.layers.length)return;
    const p=((elapsed%10000)+10000)%10000/10000*this.count,i=Math.floor(p),mix=p-i;
    const a=this.layers[i],b=this.layers[(i+1)%this.count];
    if(this.blend.width!==a.width||this.blend.height!==a.height){this.blend.width=a.width;this.blend.height=a.height;}
    const blend=this.blend.getContext('2d');blend.clearRect(0,0,a.width,a.height);
    blend.globalCompositeOperation='source-over';blend.globalAlpha=1-mix;blend.drawImage(a,0,0);
    blend.globalCompositeOperation='lighter';blend.globalAlpha=mix;blend.drawImage(b,0,0);
    c.drawImage(this.blend,0,0,w,h);
  }
}
