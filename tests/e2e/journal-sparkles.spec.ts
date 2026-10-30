import { expect, test, type Page } from '@playwright/test';

async function draft(page: Page) {
  return page.evaluate(async () => (await fetch(`/api/designs/${localStorage.getItem('wanshi:last-design')}`)).json());
}

test('journal stickers and sparkle brushes can be placed, scattered, undone and restored', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.goto('/');
  await page.getByRole('button', { name: '素材', exact: true }).click();
  await page.getByRole('combobox', { name: '素材分類' }).selectOption('手帳貼紙');
  await expect(page.locator('.art-grid > button')).toHaveCount(8);
  await expect.poll(async () => page.locator('.art-grid img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.getByRole('button', { name: '黃銅圓頭圖釘', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers.at(-1)?.name).toBe('黃銅圓頭圖釘');
  expect((await draft(page)).design.layers[0].width).toBeLessThanOrEqual(16);

  await page.getByRole('button', { name: '筆刷', exact: true }).click();
  await page.getByRole('button', { name: '星光灑落', exact: true }).click();
  await expect(page.getByRole('button', { name: '星光灑落', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '灑滿目前畫布', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers.length).toBe(25);
  const scattered = (await draft(page)).design.layers.slice(1);
  expect(scattered.every((layer: any) => layer.kind === 'image' && layer.name === '星光筆刷')).toBe(true);
  expect(new Set(scattered.map((layer: any) => layer.width.toFixed(2))).size).toBeGreaterThan(10);
  expect(new Set(scattered.map((layer: any) => layer.x.toFixed(2))).size).toBeGreaterThan(10);
  await page.locator('.dimension-canvas').screenshot({ path: 'test-results/sparkle-canvas.png' });
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await draft(page)).design.layers.length).toBe(1);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(async () => (await draft(page)).design.layers.length).toBe(25);

  const area = page.getByLabel('繪畫區');
  const box = (await area.boundingBox())!;
  await page.mouse.move(box.x + 110, box.y + 170);
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + 300, { steps: 15 });
  await page.mouse.up();
  await expect.poll(async () => (await draft(page)).design.layers.length).toBeGreaterThan(25);
  const afterStroke = (await draft(page)).design.layers;
  expect(afterStroke.length).toBeLessThanOrEqual(61);
  await page.reload();
  expect((await draft(page)).design.layers).toEqual(afterStroke);
  await page.getByRole('button', { name: '筆刷', exact: true }).click();
  await page.getByRole('button', { name: '柔光光點', exact: true }).click();
  await page.getByLabel('繪畫區').click({ position: { x: 170, y: 210 } });
  await expect.poll(async () => (await draft(page)).design.layers.at(-1)?.name).toBe('柔光光點筆刷');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.sprinkle-tools').screenshot({ path: 'test-results/sparkle-tools-mobile.png' });
  expect(errors).toEqual([]);
});
