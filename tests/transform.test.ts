import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layerSchema, newLayer } from '../shared/model';
import { clampCoverPosition, remapImagesToCanvas, resizeLayerDimension, scaleLayerAtPoint, validLayerSize } from '../shared/transform';

test('old and new layers resize proportionally unless unlocked or Shift is held', () => {
  const layer = layerSchema.parse(newLayer('shape', { width: 80, height: 40 }));
  assert.deepEqual(resizeLayerDimension(layer, 'width', 120), { width: 120, height: 60 });
  assert.deepEqual(resizeLayerDimension(layer, 'height', 30), { width: 60, height: 30 });
  assert.deepEqual(resizeLayerDimension(layer, 'width', 120, true), { width: 120, height: 40 });
  for (const shift of [false, true]) {
    const unlocked = layerSchema.parse(JSON.parse(JSON.stringify({ ...layer, aspectRatioLocked: false })));
    assert.equal(unlocked.aspectRatioLocked, false);
    assert.deepEqual(resizeLayerDimension(unlocked, 'height', 30, shift), { width: 80, height: 30 });
  }
  const relocked = layerSchema.parse({ ...layer, width: 120, aspectRatioLocked: true });
  assert.deepEqual(resizeLayerDimension(relocked, 'height', 80), { width: 240, height: 80 });
});

test('proportional size edits respect both axes of the saved model', () => {
  const layer = newLayer('shape', { width: 100, height: 1 });
  assert.deepEqual(resizeLayerDimension(layer, 'height', 1000), { width: 1000, height: 10 });
  assert.deepEqual(resizeLayerDimension(layer, 'width', 0.1), { width: 10, height: 0.1 });
  assert.deepEqual(resizeLayerDimension(layer, 'width', NaN), { width: 100, height: 1 });
  for (const [size, value] of [[0.19, 0.1], [0.21, 1000]]) {
    const square = newLayer('shape', { width: size, height: size });
    const resized = resizeLayerDimension(square, 'width', value);
    assert.deepEqual(resized, { width: value, height: value });
    assert.equal(layerSchema.safeParse({ ...square, ...resized }).success, true);
  }
  for (const [width, height] of [[0.1, 1000], [1000, 0.1], [80, 40]]) assert.equal(validLayerSize(width, height), true);
  for (const [width, height] of [[0, 1], [1, 1001], [1001, 1], [NaN, 1], [1, Infinity]]) assert.equal(validLayerSize(width, height), false);
});

test('zooming an image keeps the cursor anchor fixed', () => {
  const image = newLayer('image', { x: 10, y: 20, width: 40, height: 20 });
  const zoomed = scaleLayerAtPoint(image, 2, { x: 30, y: 30 });
  assert.deepEqual(
    { x: zoomed.x, y: zoomed.y, width: zoomed.width, height: zoomed.height },
    { x: -10, y: 10, width: 80, height: 40 },
  );

  const rotated = newLayer('image', { x: 20, y: 15, width: 30, height: 10, rotation: 37 });
  const anchor = { x: 27, y: 24 };
  const result = scaleLayerAtPoint(rotated, 1.6, anchor);
  const toLocal = (layer: typeof rotated) => {
    const radians = layer.rotation * Math.PI / 180, dx = anchor.x - layer.x, dy = anchor.y - layer.y;
    return { x: dx * Math.cos(radians) + dy * Math.sin(radians), y: -dx * Math.sin(radians) + dy * Math.cos(radians) };
  };
  const before = toLocal(rotated), after = toLocal(result);
  assert.ok(Math.abs(after.x - before.x * 1.6) < 1e-9);
  assert.ok(Math.abs(after.y - before.y * 1.6) < 1e-9);
});

test('switching to a smaller product keeps images visible and proportional', () => {
  const image = newLayer('image', { x: 20, y: 30, width: 100, height: 120 });
  const decoration = newLayer('shape', { x: 5, y: 6, width: 7, height: 8 });
  const [mapped, unchanged] = remapImagesToCanvas([image, decoration], { w: 148, h: 210 }, { w: 50, h: 76 }, 1);
  assert.equal(unchanged, decoration);
  assert.ok(mapped.width <= 48 && mapped.height <= 74);
  assert.ok(mapped.x >= 1 && mapped.y >= 1);
  assert.ok(mapped.x + mapped.width <= 49 + 1e-9);
  assert.ok(mapped.y + mapped.height <= 75 + 1e-9);
  assert.ok(Math.abs(mapped.width / mapped.height - image.width / image.height) < 1e-9);
});

test('cover positioning moves freely on both axes without exposing the paper', () => {
  assert.equal(clampCoverPosition(-30, 0, 50, 100), -30);
  assert.equal(clampCoverPosition(-80, 0, 50, 100), -50);
  assert.equal(clampCoverPosition(20, 0, 50, 100), 0);
  assert.equal(clampCoverPosition(0, 10, 76, 100), 0);
  assert.equal(clampCoverPosition(-40, 10, 76, 100), -14);
  assert.equal(clampCoverPosition(40, 10, 76, 100), 10);
});
