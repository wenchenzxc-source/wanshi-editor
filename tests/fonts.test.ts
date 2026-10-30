import test from 'node:test';
import assert from 'node:assert/strict';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { GlobalFonts } from '@napi-rs/canvas';
import { fontIds, fonts } from '../shared/fonts';

test('every selectable font includes a readable file and license for production output', async () => {
  assert.equal(new Set(fontIds).size, fontIds.length);
  assert.equal(fonts.length, fontIds.length);
  for (const font of fonts) {
    const file = path.resolve('public/fonts', font.file);
    await access(file);
    await access(path.resolve('public/fonts', font.license));
    assert.ok((await stat(file)).size > 100_000, `${font.file} is incomplete`);
    assert.ok(GlobalFonts.registerFromPath(file, font.family), `${font.file} cannot be loaded for production`);
  }
});
