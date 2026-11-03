import { expect, test } from '@playwright/test';

test('a brief server failure retries saving and clears the error after recovery', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '文字', exact: true }).click();
  let failedOnce = false;
  await page.route('**/api/designs/*', route => {
    if (route.request().method() === 'PUT' && !failedOnce) {
      failedOnce = true;
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '暫時無法儲存' }) });
    }
    return route.continue();
  });
  await page.getByRole('button', { name: '加入標題', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '暫時無法儲存' })).toBeVisible();
  await expect(page.locator('.save-state')).toHaveText('所有變更已儲存');
  await expect(page.getByRole('alert').filter({ hasText: '暫時無法儲存' })).toHaveCount(0);
  expect(failedOnce).toBe(true);
  await page.reload();
  await expect(page.locator('.layer-select').filter({ hasText: '標題' })).toBeVisible();
});

test('a legacy validation response is shown as a readable save error', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '文字', exact: true }).click();
  const legacyError = JSON.stringify([{ code: 'invalid_value', path: ['design', 'layers', 0, 'fontId'], message: 'Invalid option' }], null, 2);
  await page.route('**/api/designs/*', route => route.request().method() === 'PUT'
    ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: legacyError }) })
    : route.continue());
  await page.getByRole('button', { name: '加入標題', exact: true }).click();
  const alert = page.getByRole('alert').filter({ hasText: '字體與目前伺服器版本不相容' });
  await expect(alert).toBeVisible();
  await expect(alert).not.toContainText('invalid_value');
  await expect(page.getByRole('button', { name: '重試儲存' })).toBeVisible();
});
