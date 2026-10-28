import { expect, test, type Page } from '@playwright/test';

async function draft(page: Page) {
  return page.evaluate(async () => (await fetch(`/api/designs/${localStorage.getItem('wanshi:last-design')}`)).json());
}

test('selected controls stay near the canvas and off-canvas artwork can be recovered after switching products', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('/');

  await page.getByRole('button', { name: '文字', exact: true }).click();
  await page.getByRole('button', { name: '加入標題', exact: true }).click();
  await expect(page.getByLabel('文字內容')).toBeVisible();

  const inspector = await page.locator('.right-panel > .inspector').boundingBox();
  const preview = await page.locator('.right-panel .product-preview-panel').boundingBox();
  expect(inspector).not.toBeNull();
  expect(preview).not.toBeNull();
  expect(preview!.y).toBeLessThan(inspector!.y);

  await page.getByRole('button', { name: '壓克力磚 立體透明底材・可選尺寸', exact: true }).click();
  const warning = page.locator('.off-canvas-warning');
  await expect(warning).toContainText('有 1 個圖層在目前商品畫布外');
  await expect(warning).toContainText('內容仍完整保留');

  await page.getByRole('button', { name: '縮放並移回畫布', exact: true }).click();
  await expect(warning).toHaveCount(0);
  await expect.poll(async () => {
    const layer = (await draft(page)).design.layers[0];
    if (!layer) return null;
    return {
      left: layer.x >= 0,
      top: layer.y >= 0,
      right: layer.x + layer.width <= 20,
      bottom: layer.y + layer.height <= 30,
    };
  }).toEqual({ left: true, top: true, right: true, bottom: true });
  await expect(page.locator('.save-state')).toHaveText('所有變更已儲存');
  expect(errors).toEqual([]);
});
