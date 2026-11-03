import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { artCatalog } from '../shared/artwork';
import { badgeAccessories } from '../shared/model';

test('all listed artwork, accessories and scene pictures are readable', async () => {
  assert.equal(new Set(artCatalog.map(art => art.id)).size, artCatalog.length);
  for (const art of artCatalog) {
    assert.ok(art.file || art.svg, `${art.id} has no picture`);
    if (art.file) await access(path.resolve('public/artwork', art.file));
  }
  for (const accessory of badgeAccessories) if (accessory.image) await access(path.resolve('public/accessories', accessory.image));
  for (const folder of ['artwork', 'accessories', 'scenes']) {
    const files = (await readdir(path.resolve('public', folder))).filter(name => /\.(png|webp|jpe?g)$/i.test(name));
    assert.ok(files.length > 0, `${folder} has no pictures`);
    for (const file of files) {
      const metadata = await sharp(path.resolve('public', folder, file)).metadata();
      assert.ok(metadata.width && metadata.height, `${folder}/${file} is unreadable`);
    }
  }
});
