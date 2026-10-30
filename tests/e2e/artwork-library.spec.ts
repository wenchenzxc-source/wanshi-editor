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

  const categories = page.getByRole('combobox', { name: '素材分類' });
  await categories.selectOption('植物花草');
  for (const name of ['霧青尤加利', '淡粉波斯菊', '薰衣草小束', '暖秋銀杏']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect.poll(async () => page.locator('.art-grid img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.getByRole('button', { name: '霧青尤加利', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers.at(-1)?.name).toBe('霧青尤加利');

  await page.getByRole('button', { name: '素材', exact: true }).click();
  await categories.selectOption('手繪小物');
  await expect(page.getByRole('button', { name: '霧藍布緞結', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '乾燥花小信封', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '紙膠帶小片', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '手繪迴紋針', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '乾燥花小信封', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers.at(-1)?.name).toBe('乾燥花小信封');

  await page.getByRole('button', { name: '素材', exact: true }).click();
  await categories.selectOption('節慶');
  for (const name of ['聖誕・冬日松果枝', '新年・紅梅宮燈', '情人節・玫瑰蠟封信', '中秋・桂花滿月']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect.poll(async () => page.locator('.art-grid img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.getByRole('button', { name: '聖誕・冬日松果枝', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers.at(-1)?.name).toBe('聖誕・冬日松果枝');
  expect(errors).toEqual([]);
});

test('motifs, animals and expressions are searchable and can be placed on the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '素材', exact: true }).click();
  const categories = page.getByRole('combobox', { name: '素材分類' });
  for (const [category, name] of [['圖騰紋樣', '手繪水波紋'], ['圖騰紋樣', '葉枝分隔線'], ['小動物', '打盹小貓'], ['表情符號', '溫柔微笑'], ['生活小物', '晨光咖啡杯']]) {
    await categories.selectOption(category);
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    await expect.poll(async () => page.locator('.art-grid img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  }
  const search = page.getByRole('searchbox', { name: '搜尋素材' });
  await search.fill('小貓');
  await expect(page.getByRole('button', { name: '打盹小貓', exact: true })).toBeVisible();
  await expect(page.locator('.art-grid > button')).toHaveCount(1);
  await page.getByRole('button', { name: '打盹小貓', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers.at(-1)?.name).toBe('打盹小貓');
  await page.getByRole('button', { name: '素材', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: '搜尋素材' })).toHaveValue('小貓');
  await search.fill('不存在的圖案');
  await expect(page.getByText('找不到符合的素材。可換個關鍵字或選「全部」。')).toBeVisible();
});

test('motif types filter distinct artwork and keep each design usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '素材', exact: true }).click();
  const category = page.getByRole('combobox', { name: '素材分類' });
  for (const [type, name] of [['幾何線條', '細線菱格'], ['植物花紋', '蕨葉疏影'], ['星月天象', '星圖連線'], ['手繪織紋', '手縫人字紋']]) {
    await category.selectOption(type);
    await expect(page.locator('.art-grid > button')).toHaveCount(3);
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    await expect.poll(async () => page.locator('.art-grid img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  }
  await category.selectOption('圖騰紋樣');
  await expect(page.locator('.art-grid > button')).toHaveCount(19);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '細線菱格', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers.at(-1)?.name).toBe('細線菱格');
});

test('each holiday has five usable decorations in the compact category menu', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '素材', exact: true }).click();
  const category = page.getByRole('combobox', { name: '素材分類' });
  await expect(page.locator('.art-categories')).toHaveCount(0);
  for (const holiday of ['聖誕節', '農曆新年', '情人節', '中秋節', '萬聖節']) {
    await category.selectOption(holiday);
    await expect(page.locator('.art-grid > button')).toHaveCount(5);
    await expect.poll(async () => page.locator('.art-grid img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  }
  await category.selectOption('節慶');
  await expect(page.locator('.art-grid > button')).toHaveCount(25);
  await category.selectOption('萬聖節');
  await page.getByRole('button', { name: '萬聖節・小幽靈', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers.at(-1)?.name).toBe('萬聖節・小幽靈');
});

test('four corners can choose separate artwork and sizes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: '四角', exact: true }).click();
  await expect(page.getByRole('region', { name: '四角圖框設定' })).toBeVisible();
  await page.getByRole('combobox', { name: '四角同款樣式' }).selectOption('christmas-pine-frame');
  await page.getByRole('button', { name: '套用四角' }).click();
  await expect.poll(async () => (await draft(page)).design.layers.filter((layer: any) => layer.cornerPosition).length).toBe(4);
  let corners = (await draft(page)).design.layers.filter((layer: any) => layer.cornerPosition);
  expect(corners.map((layer: any) => layer.cornerPosition).sort()).toEqual(['bottom-left', 'bottom-right', 'top-left', 'top-right']);
  expect(corners.every((layer: any) => layer.kind === 'image' && layer.locked && layer.cropWidth === .42 && layer.width === layer.height)).toBe(true);
  await page.locator('.corner-card').first().locator('summary').click();
  await page.getByRole('button', { name: '左上角新年・紅梅宮燈邊框' }).click();
  await page.getByRole('slider', { name: '左上角大小' }).fill('22');
  await expect.poll(async () => (await draft(page)).design.layers.find((layer: any) => layer.cornerPosition === 'top-left')?.width).toBe(22);
  corners = (await draft(page)).design.layers.filter((layer: any) => layer.cornerPosition);
  expect(corners.find((layer: any) => layer.cornerPosition === 'top-left')).toMatchObject({ cornerArtworkId: 'lunar-plum-frame', x: 5, y: 5, width: 22, height: 22 });
  expect(corners.filter((layer: any) => layer.cornerArtworkId === 'christmas-pine-frame')).toHaveLength(3);
  await page.reload();
  expect((await draft(page)).design.layers.filter((layer: any) => layer.cornerPosition)).toHaveLength(4);
});
