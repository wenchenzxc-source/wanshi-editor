import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { scatterPetals } from '../shared/petals';
import { layerSchema } from '../shared/model';
import { drawLayer } from '../shared/draw';
test('all petal poses render deterministically after JSON restore', () => {
 for(const flower of ['sakura','rose'] as const) for(const pose of ['open','tilted','edge','curled'] as const){
  const l=layerSchema.parse({...scatterPetals(50,50,100,100,12,1,flower,.8)[0],petalPose:pose});
  const render=(layer: typeof l)=>{const c=createCanvas(160,160),ctx=c.getContext('2d');ctx.scale(10,10);drawLayer(ctx as unknown as CanvasRenderingContext2D,layer,undefined,'production');return c.toBuffer('image/png');};
  const a=render(l);assert.ok(a.length>400);assert.deepEqual(a,render(JSON.parse(JSON.stringify(l))));
 }
});
