import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';

async function draft(page: Page) { return page.evaluate(async () => (await fetch(`/api/designs/${localStorage.getItem('wanshi:last-design')}`)).json()); }
async function upload(page: Page) {
  const png = await sharp({ create: { width: 640, height: 480, channels: 4, background: '#cb674d' } }).png().toBuffer();
  const webp = await sharp({ create: { width: 300, height: 300, channels: 4, background: '#3a857a' } }).webp().toBuffer();
  await page.getByTestId('file-upload').setInputFiles([{ name: '暖色照片.png', mimeType: 'image/png', buffer: png }, { name: '青色照片.webp', mimeType: 'image/webp', buffer: webp }]);
  await expect(page.getByText('所有變更已儲存')).toBeVisible();
  await expect.poll(async () => (await draft(page)).design.layers.length).toBe(2);
}
test('real canvas transforms, live preview, restore, layers and immutable package', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1500, height: 1100 }); await page.goto('/');
  await expect(page.getByRole('heading', { name: '把靈感，變成實物。' })).toBeVisible(); await upload(page);
  await expect(page.getByRole('button', { name: 'AI 去背未啟用' })).toBeDisabled();
  const before = await draft(page), box = await page.locator('[data-testid="editor-canvas"] canvas').boundingBox();
  const x = box!.x + (12 + 3 + 27 + 20) * 2.6, y = box!.y + (12 + 3 + 32 + 20) * 2.6;
  const initialPreview = await page.getByTestId('product-preview').evaluate((el: HTMLCanvasElement) => el.toDataURL());
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 42, y + 26, { steps: 8 });
  const movingPreview = await page.getByTestId('product-preview').evaluate((el: HTMLCanvasElement) => el.toDataURL()); expect(movingPreview).not.toBe(initialPreview);
  await page.mouse.up(); await expect.poll(async () => (await draft(page)).design.layers[1].x).not.toBe(before.design.layers[1].x);
  // Drag a real Konva corner anchor, then the rotation handle.
  let current = (await draft(page)).design.layers[1];
  const right = box!.x + (15 + current.x + current.width) * 2.6, bottom = box!.y + (15 + current.y + current.height) * 2.6;
  await page.mouse.move(right, bottom); await page.mouse.down(); await page.mouse.move(right + 28, bottom + 28, { steps: 8 }); await page.mouse.up();
  await expect.poll(async () => (await draft(page)).design.layers[1].width).toBeGreaterThan(current.width + 3);
  current = (await draft(page)).design.layers[1];
  const centerX = box!.x + (15 + current.x + current.width / 2) * 2.6, top = box!.y + (15 + current.y) * 2.6;
  await page.mouse.move(centerX, top - 26); await page.mouse.down(); await page.mouse.move(centerX + 55, top + 8, { steps: 8 }); await page.mouse.up();
  await expect.poll(async () => Math.abs((await draft(page)).design.layers[1].rotation)).toBeGreaterThan(5);
  const saved = (await draft(page)).design;
  await page.reload(); await expect(page.getByText('所有變更已儲存')).toBeVisible(); expect((await draft(page)).design).toEqual(saved);
  await page.getByRole('button', { name: '圖層', exact: true }).click();
  await page.getByRole('button', { name: '鎖定 青色照片.webp', exact: true }).click(); await expect.poll(async () => (await draft(page)).design.layers[1].locked).toBe(true);
  await page.getByRole('button', { name: '解鎖 青色照片.webp', exact: true }).click();
  await page.getByRole('button', { name: '隱藏 青色照片.webp', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers[1].visible).toBe(false);
  await page.getByRole('button', { name: '撤銷', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers[1].visible).toBe(true);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers[1].visible).toBe(false);
  await page.getByRole('button', { name: '顯示 青色照片.webp', exact: true }).click();
  await page.locator('.layer-select').filter({ hasText: '青色照片.webp' }).click();
  await page.getByRole('button', { name: '下移一層', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers[0].name).toBe('青色照片.webp');
  await page.getByRole('button', { name: '複製', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers.length).toBe(3);
  await page.getByRole('button', { name: '刪除', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.layers.length).toBe(2);
  await page.getByRole('button', { name: '素材', exact: true }).click(); await page.getByRole('button', { name: /加入 UV 花瓣效果/ }).click();
  await page.getByRole('button', { name: '文字', exact: true }).click(); await page.getByRole('button', { name: '加入標題', exact: true }).click();
  await page.getByLabel('文字內容').fill('春日紀念\n屬於你的美好');
  await page.getByRole('button', { name: /確認與輸出/ }).click(); await page.getByRole('button', { name: '確認並建立製作包' }).click();
  await expect(page.getByRole('link', { name: '下載完整製作包 ↓' })).toBeVisible();
  const version = (await draft(page)).versions[0];
  const snapshot = await (await page.request.get(`/api/versions/${version.id}`)).json();
  await page.getByRole('button', { name: '背景', exact: true }).click(); await page.getByRole('button', { name: '背景 #e1e9df' }).click();
  await expect.poll(async () => (await draft(page)).design.background).toBe('#e1e9df');
  expect(await (await page.request.get(`/api/versions/${version.id}`)).json()).toEqual(snapshot);
  await page.getByRole('button', { name: '版本', exact: true }).click();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('link', { name: '下載完整製作包 ↓' }).click(); const download = await downloadPromise; expect(download.suggestedFilename()).toMatch(/\.zip$/); expect(await download.failure()).toBeNull();
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true }); expect(errors).toEqual([]);
});
test('mobile touch moves a layer and restores it after reload', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }); const page = await context.newPage();
  await page.goto('/'); await expect(page.getByRole('heading', { name: '把靈感，變成實物。' })).toBeVisible(); await upload(page);
  await page.getByRole('button', { name: '符合', exact: true }).click(); await page.getByTestId('editor-canvas').scrollIntoViewIfNeeded();
  const box = await page.locator('[data-testid="editor-canvas"] canvas').boundingBox(); const scale = box!.width / (154 + 24);
  const x = box!.x + (15 + 47) * scale, y = box!.y + (15 + 52) * scale;
  const before = (await draft(page)).design.layers[1].x;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 4, y: y + i * 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await draft(page)).design.layers[1].x).not.toBe(before);
  const saved = (await draft(page)).design; await page.reload(); await expect(page.getByText('所有變更已儲存')).toBeVisible(); expect((await draft(page)).design).toEqual(saved);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true }); await context.close();
});

test('photo preview switches physical frames with orientation and preserves the full artwork', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '床頭櫃', exact: true })).toBeVisible();
  await upload(page);
  const layers = (await draft(page)).design.layers;
  for (const scene of ['床頭櫃', '電腦桌']) {
    await page.getByRole('button', { name: scene, exact: true }).click();
    await expect(page.locator('.photo-scene > img')).toHaveAttribute('src', /photo-v1.webp$/);
    await expect(page.locator('.photo-art-fit canvas')).toBeVisible();
    const original = await page.getByTestId('product-preview').evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await page.getByLabel('商品方向').selectOption('landscape');
    await expect(page.locator('.photo-scene > img')).toHaveAttribute('src', /landscape-v1.webp$/);
    await expect(page.locator('.photo-art-fit canvas')).toBeVisible();
    const coverage = await page.locator('.photo-art-fit').evaluate(e => ({ w: parseFloat((e as HTMLElement).style.width), h: parseFloat((e as HTMLElement).style.height) }));
    expect(coverage.w).toBeGreaterThan(85); expect(coverage.h).toBeGreaterThan(85);
    const ratio = await page.getByTestId('product-preview').evaluate((c: HTMLCanvasElement) => c.width / c.height);
    expect(ratio).toBeCloseTo(210 / 148, 2);
    await expect.poll(async () => (await draft(page)).design.orientation).toBe('landscape');
    expect((await draft(page)).design.layers).toEqual(layers);
    await page.getByRole('button', { name: '⤢ 放大情境預覽', exact: true }).click();
    await expect(page.getByRole('dialog').locator('.photo-scene > img')).toHaveAttribute('src', /landscape-v1.webp$/);
    await expect(page.getByRole('dialog').locator('canvas')).toBeVisible();
    await page.getByRole('dialog').screenshot({ path: `test-results/landscape-${scene}.png` });
    await page.getByRole('button', { name: '關閉', exact: true }).click();
    await page.getByLabel('商品方向').selectOption('portrait');
    await expect(page.locator('.photo-scene > img')).toHaveAttribute('src', /photo-v1.webp$/);
    await expect(page.locator('.photo-art-fit canvas')).toBeVisible();
    expect(await page.getByTestId('product-preview').evaluate((c: HTMLCanvasElement) => c.toDataURL())).toBe(original);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('商品方向').selectOption('landscape');
  await expect(page.locator('.photo-art-fit canvas')).toBeVisible();
  await page.locator('.product-preview-panel').screenshot({ path: 'test-results/landscape-photo-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
