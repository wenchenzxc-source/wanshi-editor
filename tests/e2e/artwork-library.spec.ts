import { expect, test, type Page } from '@playwright/test';

async function draft(page: Page) {
  return page.evaluate(async () => (await fetch(`/api/designs/${localStorage.getItem('wanshi:last-design')}`)).json());
}

test('original hand-painted botanical and stationery categories load and remain editable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '素材', exact: true }).click();

  const categories = page.getByRole('group', { name: '素材分類' });
  await categories.getByRole('button', { name: '植物花草', exact: true }).click();
  for (const name of ['霧青尤加利', '淡粉波斯菊', '薰衣草小束', '暖秋銀杏']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect.poll(async () => page.locator('.art-grid img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.getByRole('button', { name: '霧青尤加利', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers.at(-1)?.name).toBe('霧青尤加利');

  await page.getByRole('button', { name: '素材', exact: true }).click();
  await categories.getByRole('button', { name: '手繪小物', exact: true }).click();
  await expect(page.getByRole('button', { name: '霧藍布緞結', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '乾燥花小信封', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '乾燥花小信封', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers.at(-1)?.name).toBe('乾燥花小信封');

  await page.getByRole('button', { name: '素材', exact: true }).click();
  await categories.getByRole('button', { name: '節慶', exact: true }).click();
  for (const name of ['聖誕・冬日松果枝', '新年・紅梅宮燈', '情人節・玫瑰蠟封信', '中秋・桂花滿月']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect.poll(async () => page.locator('.art-grid img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.getByRole('button', { name: '聖誕・冬日松果枝', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers.at(-1)?.name).toBe('聖誕・冬日松果枝');
  expect(errors).toEqual([]);
});

test('holiday frames load as fitted locked artwork and preserve their corner proportions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: '素材', exact: true }).click();
  const categories = page.getByRole('group', { name: '素材分類' });
  await categories.getByRole('button', { name: '圖框', exact: true }).click();
  for (const name of ['聖誕・松果枝邊框', '新年・紅梅宮燈邊框', '情人節・霧粉玫瑰邊框', '中秋・桂花月影邊框']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
  await expect.poll(async () => page.locator('.art-grid img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.getByRole('button', { name: /聖誕・松果枝邊框/ }).click();
  await expect.poll(async () => (await draft(page)).design.layers.find((layer: any) => layer.kind === 'frame')?.frameId).toBe('christmas-pine-frame');
  let frame = (await draft(page)).design.layers.find((layer: any) => layer.kind === 'frame');
  expect(frame).toMatchObject({ x: 5, y: 5, width: 138, height: 200, locked: true, rotation: 0 });
  expect(frame.assetId).toBeTruthy();
  await page.getByRole('button', { name: '切換為橫式', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers.find((layer: any) => layer.kind === 'frame')?.width).toBe(200);
  frame = (await draft(page)).design.layers.find((layer: any) => layer.kind === 'frame');
  expect(frame).toMatchObject({ x: 5, y: 5, width: 200, height: 138, locked: true, rotation: 0 });
});
