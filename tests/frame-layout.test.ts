import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { drawFrameImage } from '../shared/frame';
import { layerSchema, newLayer } from '../shared/model';

test('raster frames keep four corners square while only straight edge length changes', () => {
  const source = createCanvas(100, 100), sourceCtx = source.getContext('2d');
  sourceCtx.clearRect(0, 0, 100, 100);
  sourceCtx.fillStyle = '#aa8800'; sourceCtx.fillRect(0, 8, 100, 2);
  sourceCtx.fillStyle = '#008888'; sourceCtx.fillRect(0, 90, 100, 2);
  sourceCtx.fillStyle = '#884488'; sourceCtx.fillRect(8, 0, 2, 100);
  sourceCtx.fillStyle = '#448844'; sourceCtx.fillRect(90, 0, 2, 100);
  sourceCtx.fillStyle = '#ff0000'; sourceCtx.fillRect(0, 0, 30, 30);
  sourceCtx.fillStyle = '#00ff00'; sourceCtx.fillRect(70, 0, 30, 30);
  sourceCtx.fillStyle = '#0000ff'; sourceCtx.fillRect(70, 70, 30, 30);
  sourceCtx.fillStyle = '#ff00ff'; sourceCtx.fillRect(0, 70, 30, 30);

  const output = createCanvas(200, 300), layer = newLayer('frame', {
    frameId: 'christmas-pine-frame', width: 200, height: 300,
    frameTopLeftScale: .5, frameTopRightScale: 1,
    frameBottomRightScale: 1.5, frameBottomLeftScale: .75,
  });
  drawFrameImage(output.getContext('2d') as unknown as CanvasRenderingContext2D, layer, source as unknown as CanvasImageSource);
  const pixel = (x: number, y: number) => Array.from(output.getContext('2d').getImageData(x, y, 1, 1).data);
  assert.deepEqual(pixel(1, 1), [255, 0, 0, 255]);
  assert.deepEqual(pixel(199, 1), [0, 255, 0, 255]);
  assert.deepEqual(pixel(199, 299), [0, 0, 255, 255]);
  assert.deepEqual(pixel(1, 299), [255, 0, 255, 255]);
  assert.deepEqual(pixel(100, 14), [170, 136, 0, 255]);
  assert.equal(pixel(100, 18)[3], 0);
  assert.equal(pixel(100, 150)[3], 0);
});

test('straight edge weight stays fixed when only the long side changes', () => {
  const source = createCanvas(100, 100), sourceCtx = source.getContext('2d');
  sourceCtx.clearRect(0, 0, 100, 100);
  sourceCtx.fillStyle = '#aa8800'; sourceCtx.fillRect(0, 8, 100, 2);
  sourceCtx.fillStyle = '#ff0000'; sourceCtx.fillRect(47, 3, 6, 12);
  const thickness = (width: number, height: number) => {
    const output = createCanvas(width, height);
    drawFrameImage(output.getContext('2d') as unknown as CanvasRenderingContext2D, newLayer('frame', { frameId: 'christmas-pine-frame', width, height }), source as unknown as CanvasImageSource);
    let count = 0;
    for (let y = 0; y < 40; y++) if (output.getContext('2d').getImageData(Math.floor(width / 2), y, 1, 1).data[3]) count++;
    return count;
  };
  assert.equal(thickness(200, 300), thickness(400, 200));
  const ornamentWidth = (width: number, height: number) => {
    const output = createCanvas(width, height), ctx = output.getContext('2d');
    drawFrameImage(ctx as unknown as CanvasRenderingContext2D, newLayer('frame', { frameId: 'christmas-pine-frame', width, height }), source as unknown as CanvasImageSource);
    let count = 0;
    for (let x = 0; x < width; x++) { const p = ctx.getImageData(x, 6, 1, 1).data; if (p[0] > 200 && p[1] < 40) count++; }
    return count;
  };
  assert.equal(ornamentWidth(200, 300), ornamentWidth(400, 200));
});

test('frame corner controls validate independent 45–150 percent scales', () => {
  const frame = newLayer('frame', { frameId: 'christmas-pine-frame', frameTopLeftScale: .45, frameBottomRightScale: 1.5 });
  assert.equal(layerSchema.parse(frame).frameTopLeftScale, .45);
  assert.throws(() => layerSchema.parse({ ...frame, frameTopLeftScale: .4 }));
  assert.throws(() => layerSchema.parse({ ...frame, frameBottomRightScale: 1.55 }));
});
