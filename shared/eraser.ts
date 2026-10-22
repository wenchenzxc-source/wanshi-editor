import type { DesignLayer } from './model';

function pointInsideHole(x: number, y: number, hole: NonNullable<DesignLayer['erasures']>[number], l: DesignLayer, margin: number) {
 const rx=hole.rx*l.width-margin,ry=hole.ry*l.height-margin;
 if(rx<=0||ry<=0)return false;
 const dx=x-hole.x*l.width,dy=y-hole.y*l.height;
 return dx*dx/(rx*rx)+dy*dy/(ry*ry)<=1;
}

/** True only when every visible part of a brush stroke is covered by an eraser hole. */
export function isStrokeFullyErased(l: DesignLayer) {
 if(l.kind!=='stroke'||!l.points?.length||!l.erasures?.length)return false;
 const width=(l.brushRatio||.01)*Math.min(l.width,l.height),step=Math.max(.1,width/2);
 for(let i=0;i<l.points.length;i+=2){
  const x=l.points[i]*l.width,y=l.points[i+1]*l.height;
  const px=i?l.points[i-2]*l.width:x,py=i?l.points[i-1]*l.height:y;
  const count=Math.max(1,Math.ceil(Math.hypot(x-px,y-py)/step));
  for(let n=0;n<=count;n++){
   const sx=px+(x-px)*n/count,sy=py+(y-py)*n/count;
   if(!l.erasures.some(h=>pointInsideHole(sx,sy,h,l,width/2)))return false;
  }
 }
 return true;
}

export function removeEmptyStrokes(layers: DesignLayer[]) {
 return layers.filter(l=>!isStrokeFullyErased(l));
}
/** Store normalized, layer-local holes so resizing/rotation preserve the erased areas. */
export function eraseLayers(layers: DesignLayer[], path: number[], diameter: number): DesignLayer[] {
 const radius=diameter/2;
 const samples: number[][]=[];
 for(let i=0;i<path.length;i+=2){
  const x=path[i],y=path[i+1],px=i?path[i-2]:x,py=i?path[i-1]:y;
  const n=Math.max(1,Math.ceil(Math.hypot(x-px,y-py)/Math.max(.2,radius/2)));
  for(let j=1;j<=n;j++) samples.push([px+(x-px)*j/n,py+(y-py)*j/n]);
 }
 return layers.map(l=>{
  if(l.locked || !l.visible) return l;
  const a=-l.rotation*Math.PI/180, holes=[...(l.erasures||[])];
  for(const [x,y] of samples){
   const dx=x-l.x,dy=y-l.y,lx=dx*Math.cos(a)-dy*Math.sin(a),ly=dx*Math.sin(a)+dy*Math.cos(a);
   if(lx+radius<0 || ly+radius<0 || lx-radius>l.width || ly-radius>l.height)continue;
   if(holes.length>=6000) break;
   holes.push({x:lx/l.width,y:ly/l.height,rx:radius/l.width,ry:radius/l.height});
  }
  return holes.length===(l.erasures?.length||0)?l:{...l,erasures:holes};
 });
}
