import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test('screen tear can be applied to a photo and survives reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const width = 480, height = 320;
  const raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    raw[i] = x % 32 < 16 ? 235 : 30;
    raw[i + 1] = y % 40 < 20 ? 70 : 180;
    raw[i + 2] = 125;
    raw[i + 3] = 255;
  }
  const png = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
  await page.getByTestId('file-upload').setInputFiles({ name: '撕裂測試.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('button', { name: '調圖', exact: true })).toHaveClass(/active/);
  const slider = page.getByRole('slider', { name: '撕裂畫面強度' });
  await expect(slider).toHaveValue('0');
  const preview = page.getByTestId('product-preview');
  const original = await preview.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.getByRole('button', { name: '明顯' }).click();
  await expect(slider).toHaveValue('55');
  await expect.poll(async () => {
    const id = await page.evaluate(() => localStorage.getItem('wanshi:last-design'));
    const saved = await page.evaluate(async id => (await fetch(`/api/designs/${id}`)).json(), id);
    return saved.design.layers[0]?.screenTear;
  }).toBe(55);
  await expect.poll(async () => preview.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).not.toBe(original);
  await page.locator('.asset-panel').screenshot({ path: 'test-results/screen-tear-panel.png' });
  await page.locator('.dimension-canvas').screenshot({ path: 'test-results/screen-tear-canvas.png' });
  await page.reload();
  await page.locator('.layer-select').filter({ hasText: '撕裂測試.png' }).click();
  await expect(page.getByRole('slider', { name: '撕裂畫面強度' })).toHaveValue('55');
  await page.getByRole('button', { name: '關閉', exact: true }).click();
  await expect(page.getByRole('slider', { name: '撕裂畫面強度' })).toHaveValue('0');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
