import { expect, test } from '@playwright/test';

test('an outdated server is explained before editing starts', async ({ page }) => {
  await page.route('**/api/config', async route => {
    const response = await route.fetch();
    const config = await response.json();
    delete config.fontIds;
    await route.fulfill({ response, json: config });
  });
  await page.goto('/');
  await expect(page.getByText(/網站已更新，但本機伺服器仍是舊版/)).toBeVisible();
  await expect(page.getByRole('button', { name: '重新連線' })).toBeVisible();
  await expect(page.getByRole('button', { name: '加入標題' })).toHaveCount(0);
});
