import { expect, test, type Page } from '@playwright/test';

async function draft(page: Page) {
  return page.evaluate(async () => (await fetch(`/api/designs/${localStorage.getItem('wanshi:last-design')}`)).json());
}

test('text color, size, emphasis, alignment and spacing persist and match the live preview', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: '文字', exact: true }).click();
  await page.getByRole('button', { name: '加入標題', exact: true }).click();
  await expect(page.getByRole('button', { name: '調字', exact: true })).toHaveClass(/active/);
  expect(await page.locator('.asset-panel').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const before = await page.getByTestId('product-preview').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());

  await page.getByLabel('文字內容').fill('萬事造物\nText Style');
  await page.getByLabel('文字顏色').fill('#c42852');
  await page.getByRole('button', { name: '20 mm', exact: true }).click();
  await expect(page.getByText(/目前字級、字距或行距可能超出文字框/)).toBeVisible();
  await page.getByRole('button', { name: /自動縮小至/ }).click();
  await expect(page.getByText(/目前字級、字距或行距可能超出文字框/)).toHaveCount(0);
  await page.getByLabel('高 (mm)', { exact: true }).fill('80');
  await page.getByRole('button', { name: '12 mm', exact: true }).click();
  await page.getByRole('button', { name: '粗體', exact: true }).click();
  await page.getByRole('button', { name: '斜體', exact: true }).click();
  await page.getByRole('button', { name: '底線', exact: true }).click();
  await page.getByRole('button', { name: '置中對齊', exact: true }).click();
  await page.getByLabel('字距 (mm)', { exact: true }).fill('1.2');
  await page.getByLabel('文字行距').fill('1.6');
  await expect(page.getByText(/目前字級、字距或行距可能超出文字框/)).toHaveCount(0);

  await expect.poll(async () => {
    const layer = (await draft(page)).design.layers[0];
    return {
      text: layer?.text, fill: layer?.fill, fontSize: layer?.fontSize,
      fontWeight: layer?.fontWeight, fontStyle: layer?.fontStyle, textDecoration: layer?.textDecoration,
      textAlign: layer?.textAlign, letterSpacing: layer?.letterSpacing, lineHeight: layer?.lineHeight,
    };
  }).toEqual({
    text: '萬事造物\nText Style', fill: '#c42852', fontSize: 12,
    fontWeight: 'bold', fontStyle: 'italic', textDecoration: 'underline',
    textAlign: 'center', letterSpacing: 1.2, lineHeight: 1.6,
  });
  const after = await page.getByTestId('product-preview').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  expect(after).not.toBe(before);
  await expect(page.locator('.save-state')).toHaveText('所有變更已儲存');

  await page.reload();
  await page.locator('.layer-select').filter({ hasText: '標題' }).click();
  await expect(page.getByLabel('文字顏色')).toHaveValue('#c42852');
  await expect(page.getByLabel('字級 (mm)', { exact: true })).toHaveValue('12');
  await expect(page.getByRole('button', { name: '粗體', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '斜體', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '底線', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '置中對齊', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.text-style-controls').scrollIntoViewIfNeeded();
  await expect(page.locator('.text-style-controls')).toBeVisible();
  expect(await page.locator('.asset-panel').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/text-style-mobile.png', fullPage: true });
});
