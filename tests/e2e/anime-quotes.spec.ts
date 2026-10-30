import { expect, test, type Page } from '@playwright/test';

async function draft(page: Page) {
  return page.evaluate(async () => (await fetch(`/api/designs/${localStorage.getItem('wanshi:last-design')}`)).json());
}

test('anime quote presets insert editable text frames and remain editable after reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: '素材', exact: true }).click();
  await page.getByRole('combobox', { name: '素材分類' }).selectOption('動漫用語');
  await expect(page.locator('.art-grid > button')).toHaveCount(12);
  await expect.poll(async () => page.locator('.quote-thumb canvas').evaluateAll(canvases => canvases.every(canvas => {
    const element = canvas as HTMLCanvasElement;
    const pixels = element.getContext('2d')?.getImageData(0, 0, element.width, element.height).data;
    return !!pixels && pixels.some((value, index) => index % 4 === 3 && value > 0);
  }))).toBe(true);

  await page.getByRole('button', { name: '這是我推', exact: true }).click();
  await expect(page.getByRole('button', { name: '調字', exact: true })).toHaveClass(/active/);
  await expect(page.getByLabel('文字內容')).toHaveValue('這是我推');
  await expect(page.getByRole('combobox', { name: '文字框樣式' })).toHaveValue('banner');
  await expect.poll(async () => (await draft(page)).design.layers[0]?.quoteStyle).toBe('banner');
  const before = await page.getByTestId('product-preview').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.getByLabel('文字內容').fill('我的推最閃亮');
  await page.getByRole('combobox', { name: '文字框樣式' }).selectOption('quote');
  await expect.poll(async () => {
    const layer = (await draft(page)).design.layers[0];
    return { text: layer?.text, style: layer?.quoteStyle, kind: layer?.kind };
  }).toEqual({ text: '我的推最閃亮', style: 'quote', kind: 'text' });
  const after = await page.getByTestId('product-preview').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  expect(after).not.toBe(before);
  await page.locator('.dimension-canvas').screenshot({ path: 'test-results/anime-quote-canvas.png' });
  await page.reload();
  await page.locator('.layer-select').filter({ hasText: '這是我推' }).click();
  await expect(page.getByLabel('文字內容')).toHaveValue('我的推最閃亮');
  await expect(page.getByRole('combobox', { name: '文字框樣式' })).toHaveValue('quote');

  await page.getByRole('button', { name: '素材', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜尋素材' }).fill('前方高能');
  await expect(page.getByRole('button', { name: '前方高能', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '前方高能', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers.at(-1)?.quoteStyle).toBe('impact');
  await expect(page.getByRole('combobox', { name: '文字字體' })).toHaveValue('mono');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
