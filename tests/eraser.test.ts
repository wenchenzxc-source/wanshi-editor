import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { eraseLayers, isStrokeFullyErased, removeEmptyStrokes } from '../shared/eraser';
import { drawLayer } from '../shared/draw';
import { newLayer, layerSchema } from '../shared/model';
test('eraser cuts local holes, respects locks and preserves saved production output',()=>{
 const original=newLayer('shape',{shape:'rect',width:20,height:20,x:0,y:0,fill:'#ff0000'});
 const locked={...original,locked:true};assert.equal(eraseLayers([locked],[10,10],4)[0],locked);
 const erased=layerSchema.parse(JSON.parse(JSON.stringify(eraseLayers([original],[10,10],4)[0])));
 assert.equal(original.erasures,undefined);
 const c=createCanvas(20,20),ctx=c.getContext('2d');drawLayer(ctx as unknown as CanvasRenderingContext2D,erased,undefined,'production');
 assert.equal(ctx.getImageData(10,10,1,1).data[3],0);assert.equal(ctx.getImageData(2,2,1,1).data[3],255);
 const rotated={...original,rotation:90,x:20};assert.ok(eraseLayers([rotated],[10,10],4)[0].erasures?.length);
});
test('fully erased brush strokes are removed instead of leaving empty selection boxes',()=>{
 const stroke=newLayer('stroke',{name:'自由筆畫',x:0,y:0,width:20,height:4,fill:'#222222',brushRatio:.5,points:[.1,.5,.9,.5]});
 const partly=eraseLayers([stroke],[10,2],2);assert.equal(partly.length,1);assert.equal(isStrokeFullyErased(partly[0]),false);
 const erased=eraseLayers([stroke],[2,2,18,2],8);assert.equal(isStrokeFullyErased(erased[0]),true);assert.deepEqual(removeEmptyStrokes(erased),[]);
 const legacy={...stroke,erasures:[{x:.5,y:.5,rx:1,ry:5}]};assert.equal(isStrokeFullyErased(legacy),true);assert.deepEqual(removeEmptyStrokes([legacy]),[]);
});
