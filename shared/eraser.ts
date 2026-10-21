import type { DesignLayer } from './model';
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
