import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layerSchema, newLayer } from '../shared/model';
import { resizeLayerDimension, validLayerSize } from '../shared/transform';

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
