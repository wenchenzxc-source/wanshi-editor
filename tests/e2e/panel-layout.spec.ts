import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const panel = await page.locator('.asset-panel').evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test('editing panels fit desktop and mobile widths without clipped controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1150, height: 900 });
  await page.goto('/');

  for (const name of ['上傳', '文字', '素材', '筆刷']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expectNoHorizontalOverflow(page);
  }

  await page.getByRole('button', { name: '文字', exact: true }).click();
  await page.getByRole('button', { name: '加入標題', exact: true }).click();
  await expect(page.getByRole('button', { name: '調字', exact: true })).toHaveClass(/active/);
  await expectNoHorizontalOverflow(page);

  const desktopPreview = await page.locator('.right-panel .product-preview-panel').boundingBox();
  const desktopInspector = await page.locator('.right-panel > .inspector').boundingBox();
  expect(desktopPreview).not.toBeNull();
  expect(desktopInspector).not.toBeNull();
  expect(desktopPreview!.y).toBeLessThan(desktopInspector!.y);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  const mobilePreview = await page.locator('.right-panel .product-preview-panel').boundingBox();
  const mobileInspector = await page.locator('.right-panel > .inspector').boundingBox();
  expect(mobilePreview).not.toBeNull();
  expect(mobileInspector).not.toBeNull();
  expect(mobilePreview!.y).toBeLessThan(mobileInspector!.y);
  expect(errors).toEqual([]);
});
