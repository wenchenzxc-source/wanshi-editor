import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { drawLayer, imageCropRect } from '../shared/draw';
import { layerSchema, newLayer } from '../shared/model';
import { screenTearBands } from '../shared/screenTear';

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

test('image crop keeps a focal area and survives validation', () => {
  const source = createCanvas(20, 10), sourceContext = source.getContext('2d');
  sourceContext.fillStyle = '#ff0000'; sourceContext.fillRect(0, 0, 10, 10);
  sourceContext.fillStyle = '#0000ff'; sourceContext.fillRect(10, 0, 10, 10);
  const base = newLayer('image', { assetId: crypto.randomUUID(), x: 0, y: 0, width: 10, height: 10 });
  const left = layerSchema.parse({ ...base, cropX: 0, cropY: 0, cropWidth: .5, cropHeight: 1 });
  const right = layerSchema.parse({ ...base, cropX: .5, cropY: 0, cropWidth: .5, cropHeight: 1 });
  assert.deepEqual(imageCropRect(left, source as unknown as CanvasImageSource), { x: 0, y: 0, width: 10, height: 10 });
  assert.deepEqual(imageCropRect(right, source as unknown as CanvasImageSource), { x: 10, y: 0, width: 10, height: 10 });
  const leftOutput = createCanvas(10, 10), rightOutput = createCanvas(10, 10);
  drawLayer(leftOutput.getContext('2d') as unknown as CanvasRenderingContext2D, left, source as unknown as CanvasImageSource);
  drawLayer(rightOutput.getContext('2d') as unknown as CanvasRenderingContext2D, right, source as unknown as CanvasImageSource);
  assert.ok(leftOutput.getContext('2d').getImageData(5, 5, 1, 1).data[0] > 240);
  assert.ok(rightOutput.getContext('2d').getImageData(5, 5, 1, 1).data[2] > 240);
  assert.throws(() => layerSchema.parse({ ...base, cropX: .8, cropWidth: 1.1 }));
});

test('image corner radius survives validation and clips the rendered corners', () => {
  const source = createCanvas(20, 20), sourceContext = source.getContext('2d');
  sourceContext.fillStyle = '#e31b23'; sourceContext.fillRect(0, 0, 20, 20);
  const base = newLayer('image', { assetId: crypto.randomUUID(), x: 0, y: 0, width: 20, height: 20 });
  const rounded = layerSchema.parse({ ...base, cornerRadiusMm: 5 });
  const output = createCanvas(20, 20);
  drawLayer(output.getContext('2d') as unknown as CanvasRenderingContext2D, rounded, source as unknown as CanvasImageSource);
  const corner = output.getContext('2d').getImageData(0, 0, 1, 1).data;
  const center = output.getContext('2d').getImageData(10, 10, 1, 1).data;
  assert.equal(rounded.cornerRadiusMm, 5);
  assert.equal(corner[3], 0);
  assert.ok(center[0] > 220 && center[3] > 240);
  assert.throws(() => layerSchema.parse({ ...base, cornerRadiusMm: -1 }));
});

test('screen tear displaces image bands consistently in preview and production', () => {
  const source = createCanvas(120, 80), sourceContext = source.getContext('2d');
  for (let x = 0; x < 120; x += 6) {
    sourceContext.fillStyle = x % 12 ? '#254f71' : '#f3b983';
    sourceContext.fillRect(x, 0, 6, 80);
  }
  const base = newLayer('image', { assetId: crypto.randomUUID(), width: 120, height: 80 });
  const torn = layerSchema.parse({ ...base, screenTear: 75 });
  const render = (layer: typeof torn, mode: 'preview' | 'production') => {
    const output = createCanvas(120, 80);
    drawLayer(output.getContext('2d') as unknown as CanvasRenderingContext2D, layer, source as unknown as CanvasImageSource, mode);
    return output.toBuffer('image/png');
  };
  assert.ok(screenTearBands(torn.id, 120, 80, 75).length >= 5);
  assert.deepEqual(screenTearBands(torn.id, 120, 80, 75), screenTearBands(torn.id, 120, 80, 75));
  assert.notDeepEqual(render(torn, 'production'), render(base, 'production'));
  assert.deepEqual(render(torn, 'preview'), render(torn, 'production'));
  assert.deepEqual(render(layerSchema.parse(JSON.parse(JSON.stringify(torn))), 'production'), render(torn, 'production'));
  assert.deepEqual(screenTearBands(torn.id, 120, 80, 0), []);
  assert.throws(() => layerSchema.parse({ ...base, screenTear: 101 }));
});

test('screen tear stays inside a cropped image with rounded corners', () => {
  const source = createCanvas(40, 20), sourceContext = source.getContext('2d');
  sourceContext.fillStyle = '#ff0000'; sourceContext.fillRect(0, 0, 20, 20);
  sourceContext.fillStyle = '#0000ff'; sourceContext.fillRect(20, 0, 20, 20);
  const layer = layerSchema.parse({ ...newLayer('image', { assetId: crypto.randomUUID(), width: 40, height: 30 }),
    cropX: .5, cropY: 0, cropWidth: .5, cropHeight: 1, cornerRadiusMm: 8, screenTear: 90 });
  const output = createCanvas(40, 30), ctx = output.getContext('2d');
  drawLayer(ctx as unknown as CanvasRenderingContext2D, layer, source as unknown as CanvasImageSource, 'production');
  assert.equal(ctx.getImageData(0, 0, 1, 1).data[3], 0);
  const blue = ctx.getImageData(20, 1, 1, 1).data;
  assert.ok(blue[2] > 230 && blue[0] < 30);
});
