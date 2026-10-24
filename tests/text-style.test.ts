import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { drawLayer } from '../shared/draw';
import { layerSchema, newLayer } from '../shared/model';

function render(layer: ReturnType<typeof newLayer>) {
  const canvas = createCanvas(180, 80);
  drawLayer(canvas.getContext('2d') as unknown as CanvasRenderingContext2D, layer);
  return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
}

function inkBounds(data: Uint8ClampedArray, width: number) {
  let left = width, right = -1;
  for (let index = 3; index < data.length; index += 4) if (data[index]) {
    const x = ((index - 3) / 4) % width;
    left = Math.min(left, x); right = Math.max(right, x);
  }
  return { left, right };
}

test('text styles validate and render color, emphasis, spacing, underline and alignment', () => {
  const base = newLayer('text', { text: '萬事 ABC', width: 160, height: 60, fontSize: 18, fill: '#203830' });
  const styled = layerSchema.parse({ ...base, fill: '#bb3150', fontWeight: 'bold', fontStyle: 'italic', textDecoration: 'underline', textAlign: 'right', letterSpacing: 2, lineHeight: 1.6 });
  assert.deepEqual({
    fontWeight: styled.fontWeight, fontStyle: styled.fontStyle, textDecoration: styled.textDecoration,
    textAlign: styled.textAlign, letterSpacing: styled.letterSpacing, lineHeight: styled.lineHeight,
  }, { fontWeight: 'bold', fontStyle: 'italic', textDecoration: 'underline', textAlign: 'right', letterSpacing: 2, lineHeight: 1.6 });
  assert.notDeepEqual(render(base), render(styled));
  const left = inkBounds(render({ ...base, textAlign: 'left' }), 180);
  const right = inkBounds(render({ ...base, textAlign: 'right' }), 180);
  assert.ok(right.left > left.left + 30);
  assert.ok(right.right > left.right + 30);
  assert.throws(() => layerSchema.parse({ ...base, fontSize: 201 }));
});
