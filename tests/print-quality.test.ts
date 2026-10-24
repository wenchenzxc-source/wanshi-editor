import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDesign, newLayer, templates, type Asset } from '../shared/model';
import { effectiveImagePpi, imageQualityIssues, MIN_IMAGE_PPI, PRINT_OUTPUT_PPI, TARGET_PRINTER_DPI } from '../shared/print-quality';

const asset: Asset = {
  id: 'asset-1', designId: 'design-1', originalName: 'photo.png', mime: 'image/png',
  width: 1200, height: 1200, sha256: 'hash', variant: 'original',
};

test('print quality constants distinguish artwork PPI from printer DPI', () => {
  assert.equal(PRINT_OUTPUT_PPI, 600);
  assert.equal(MIN_IMAGE_PPI, 300);
  assert.equal(TARGET_PRINTER_DPI, 1440);
  assert.ok(templates.every(template => template.dpi === PRINT_OUTPUT_PPI));
});

test('effective image PPI accounts for physical size and crop', () => {
  const layer = newLayer('image', { assetId: asset.id, width: 50.8, height: 50.8 });
  assert.equal(effectiveImagePpi(layer, asset), 600);
  assert.equal(effectiveImagePpi({ ...layer, cropWidth: 0.5, cropHeight: 0.5 }, asset), 300);
});

test('preflight blocks below 300 PPI and ignores hidden images', () => {
  const design = emptyDesign();
  design.id = asset.designId;
  const passing = newLayer('image', { assetId: asset.id, name: '剛好通過', width: 101.6, height: 101.6 });
  const failing = newLayer('image', { assetId: asset.id, name: '解析度不足', width: 101.7, height: 101.7 });
  design.layers = [passing, failing, { ...failing, id: 'hidden', name: '已隱藏', visible: false }];
  assert.equal(effectiveImagePpi(passing, asset), 300);
  assert.equal(effectiveImagePpi(failing, asset), 299);
  assert.deepEqual(imageQualityIssues(design, [asset]), [{ layerId: failing.id, name: '解析度不足', ppi: 299 }]);
});
