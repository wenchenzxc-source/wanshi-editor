import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { eraseLayers } from '../shared/eraser';
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
