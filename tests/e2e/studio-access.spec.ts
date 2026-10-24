import { expect, test } from '@playwright/test';

test('customers cannot download production files while studio staff can use the protected backend', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.goto('/');
  await page.getByRole('button', { name: '文字', exact: true }).click();
  await page.getByRole('button', { name: '加入標題', exact: true }).click();
  await page.getByLabel('文字內容').fill('僅供工作室製作');
  await page.getByRole('button', { name: /確認設計與加入購物車/ }).click();
  await page.getByRole('button', { name: '確認並加入購物車', exact: true }).click();
  const draft = await page.evaluate(async () => (await fetch(`/api/designs/${localStorage.getItem('wanshi:last-design')}`)).json());
  const versionId = draft.versions[0].id;
  expect((await page.request.get(`/api/versions/${versionId}/package.zip`)).status()).toBe(401);
  await expect(page.getByText('製作檔已安全送至工作室', { exact: false })).toBeVisible();

  await page.goto('/studio');
  await expect(page.getByRole('heading', { name: '工作室製作後台' })).toBeVisible();
  await page.getByLabel('工作室密碼').fill('e2e-studio-token');
  await page.getByRole('button', { name: '安全登入' }).click();
  await expect(page.getByText('僅供工作室製作', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '下載 600 PPI 製作包', exact: true }).first()).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: '下載 600 PPI 製作包', exact: true }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^wanshi-.*\.zip$/);
  expect(await download.failure()).toBeNull();
});
