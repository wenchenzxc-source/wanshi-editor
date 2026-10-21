import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { drawLayer } from '../shared/draw';
import { newLayer, layerSchema } from '../shared/model';
test('normalized brush geometry survives JSON and renders production ink, not UV', () => {
 const layer = layerSchema.parse(JSON.parse(JSON.stringify(newLayer('stroke', {width:20,height:10,points:[.1,.5,.9,.5],brushRatio:.2,fill:'#ff0000',opacity:.5}))));
 const canvas=createCanvas(40,20),ctx=canvas.getContext('2d');
 ctx.scale(2,2); drawLayer(ctx as unknown as CanvasRenderingContext2D,layer,undefined,'production');
 const pixel=ctx.getImageData(20,10,1,1).data; assert.equal(pixel[0],255); assert.ok(pixel[3]>=126 && pixel[3]<=129);
 assert.equal(ctx.getImageData(20,0,1,1).data[3],0);
 ctx.clearRect(0,0,20,10); drawLayer(ctx as unknown as CanvasRenderingContext2D,layer,undefined,'mask');
 assert.equal(ctx.getImageData(20,10,1,1).data[3],0);
 assert.equal(layerSchema.safeParse({...layer,points:[0,.5,.9]}).success,false);
});
