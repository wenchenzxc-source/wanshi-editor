import type { DesignLayer } from './model';
export function layerBounds(l: DesignLayer) {
 const a=l.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 const pts=[[0,0],[l.width,0],[0,l.height],[l.width,l.height]].map(([x,y])=>({x:l.x+x*c-y*s,y:l.y+x*s+y*c}));
 const x=Math.min(...pts.map(p=>p.x)),y=Math.min(...pts.map(p=>p.y));
 return {x,y,width:Math.max(...pts.map(p=>p.x))-x,height:Math.max(...pts.map(p=>p.y))-y};
}

export type SelectionPoint={x:number;y:number};
export function cadSelect(layers:DesignLayer[],start:SelectionPoint,end:SelectionPoint){
 const box={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width:Math.abs(end.x-start.x),height:Math.abs(end.y-start.y)};
 const crossing=end.x<start.x;
 return layers.filter(l=>{
  if(!l.visible||l.locked)return false;
  const b=layerBounds(l);
  return crossing
   ? b.x<=box.x+box.width&&b.x+b.width>=box.x&&b.y<=box.y+box.height&&b.y+b.height>=box.y
   : b.x>=box.x&&b.y>=box.y&&b.x+b.width<=box.x+box.width&&b.y+b.height<=box.y+box.height;
 }).map(l=>l.id);
}
