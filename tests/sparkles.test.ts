import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scatterSparkles } from '../shared/sparkles';
import { layerSchema } from '../shared/model';

test('star brush varies size and placement while keeping rotated artwork inside the canvas', () => {
  let seed = 73;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
  const layers = scatterSparkles({ x: 10, y: 10, spreadW: 40, spreadH: 40, size: 5, count: 24,
    pageW: 20, pageH: 20, opacity: .8, assetId: crypto.randomUUID(), name: '星光筆刷', random });
  assert.equal(layers.length, 24);
  assert.ok(new Set(layers.map(layer => layer.width.toFixed(2))).size > 8);
  assert.ok(new Set(layers.map(layer => layer.x.toFixed(2))).size > 8);
  assert.ok(new Set(layers.map(layer => layer.opacity.toFixed(2))).size > 8);
  for (const layer of layers) {
    assert.equal(layerSchema.safeParse(layer).success, true);
    const angle = layer.rotation * Math.PI / 180;
    for (const [dx, dy] of [[0, 0], [layer.width, 0], [0, layer.height], [layer.width, layer.height]]) {
      const x = layer.x + dx * Math.cos(angle) - dy * Math.sin(angle);
      const y = layer.y + dx * Math.sin(angle) + dy * Math.cos(angle);
      assert.ok(x >= -1e-8 && x <= 20 + 1e-8);
      assert.ok(y >= -1e-8 && y <= 20 + 1e-8);
    }
  }
  assert.deepEqual(JSON.parse(JSON.stringify(layers)), layers);
});
