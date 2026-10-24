import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test('low-resolution photos are explained and blocked until resized above 300 PPI', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('/');
  const png = await sharp({ create: { width: 120, height: 120, channels: 4, background: '#986dba' } }).png().toBuffer();
  await page.getByTestId('file-upload').setInputFiles({ name: '低解析照片.png', mimeType: 'image/png', buffer: png });

  await expect(page.getByText(/目前有效解析度：約 \d+ PPI.*低於 300 PPI 最低標準/)).toBeVisible();
  await page.getByRole('button', { name: /確認設計與加入購物車/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: '圖片解析度不足' })).toContainText('低解析照片.png');
  await expect(page.getByRole('button', { name: '確認並加入購物車', exact: true })).toBeDisabled();

  await page.getByRole('button', { name: '繼續編輯', exact: true }).click();
  const width = page.getByLabel('寬 (mm)', { exact: true });
  await width.fill('10');
  await width.blur();
  await expect(page.getByText('目前有效解析度：約 304 PPI （符合印前標準）')).toBeVisible();
  await page.getByRole('button', { name: /確認設計與加入購物車/ }).click();
  await expect(page.getByText('印前解析度檢查通過')).toBeVisible();
  await expect(page.getByText(/600 PPI.*最高 1440 DPI/)).toBeVisible();
  await expect(page.getByRole('button', { name: '確認並加入購物車', exact: true })).toBeEnabled();
});
