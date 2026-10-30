import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { drawLayer } from '../shared/draw';
import { layerSchema, newLayer } from '../shared/model';
import { quoteStyleIds, quoteStyles } from '../shared/quotes';

test('editable quote frames render consistently in production and survive JSON restore', () => {
  for (const quoteStyle of quoteStyleIds) {
    const style = quoteStyles[quoteStyle];
    const layer = layerSchema.parse(newLayer('text', { quoteStyle, text: '這是我推', width: style.width,
      height: style.height, fontSize: style.fontSize, fill: style.textColor, textAlign: 'center' }));
    const render = (value: typeof layer) => {
      const canvas = createCanvas(Math.ceil(style.width * 4), Math.ceil(style.height * 4));
      const ctx = canvas.getContext('2d'); ctx.scale(4, 4);
      drawLayer(ctx as unknown as CanvasRenderingContext2D, value, undefined, 'production');
      return canvas.toBuffer('image/png');
    };
    const image = render(layer);
    assert.ok(image.length > 1000, quoteStyle);
    assert.deepEqual(image, render(layerSchema.parse(JSON.parse(JSON.stringify(layer)))));
    assert.notDeepEqual(image, render({ ...layer, text: '改成自己的台詞' }));
  }
});
