import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { drawLayer } from '../shared/draw';
import { layerSchema, newLayer } from '../shared/model';

test('image adjustments survive validation and affect rendered pixels', () => {
  const source = createCanvas(12, 12), sourceContext = source.getContext('2d');
  sourceContext.fillStyle = 'rgb(70, 80, 90)'; sourceContext.fillRect(0, 0, 12, 12);

  const plain = createCanvas(12, 12), adjusted = createCanvas(12, 12);
  const base = newLayer('image', { assetId: crypto.randomUUID(), x: 0, y: 0, width: 12, height: 12 });
  const layer = layerSchema.parse({ ...base, brightness: 1.8, contrast: 1.15, saturation: 0.5, blurMm: 0.4 });
  drawLayer(plain.getContext('2d') as unknown as CanvasRenderingContext2D, base, source as unknown as CanvasImageSource, 'production', 1);
  drawLayer(adjusted.getContext('2d') as unknown as CanvasRenderingContext2D, layer, source as unknown as CanvasImageSource, 'production', 1);

  const original = plain.getContext('2d').getImageData(6, 6, 1, 1).data;
  const changed = adjusted.getContext('2d').getImageData(6, 6, 1, 1).data;
  assert.ok(changed[0] > original[0]);
  assert.notDeepEqual([...changed], [...original]);
  assert.throws(() => layerSchema.parse({ ...base, blurMm: 10.1 }));
});
