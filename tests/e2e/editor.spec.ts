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
  await page.getByRole('button', { name: '收合圖層' }).click();
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
  await page.getByRole('button', { name: '上移 暖色照片.png', exact: true }).click();
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
  await page.getByRole('button', { name: '底材', exact: true }).click(); await page.getByRole('button', { name: '金', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.material).toBe('gold');
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
  await page.locator('.floating-layers').scrollIntoViewIfNeeded();
  const dock = await page.locator('.floating-layers').boundingBox(), canvas = await page.getByTestId('editor-canvas').boundingBox();
  expect(dock!.y).toBeGreaterThanOrEqual(canvas!.y + canvas!.height);
  const grip = await page.getByRole('button', { name: '拖曳排序 青色照片.webp' }).boundingBox(), target = await page.getByRole('button', { name: '拖曳排序 暖色照片.png' }).boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: grip!.x + 12, y: grip!.y + 12 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: target!.x + 12, y: target!.y + 12 }] });
  await expect(page.locator('.layer-row.dragging')).toHaveCSS('transition-duration', '0s');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await draft(page)).design.layers[0].name).toBe('青色照片.webp');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true }); await context.close();
});

test('photo preview switches physical frames with orientation and preserves the full artwork', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '床頭櫃', exact: true })).toBeVisible();
  await upload(page);
  const layers = (await draft(page)).design.layers;
  for (const scene of ['床頭櫃', '電腦桌', '溫暖桌面', '居家牆面', '生活層架', '藝廊展台', '模型櫃', '娃娃牆']) {
    await page.getByRole('button', { name: scene, exact: true }).click();
    await expect(page.locator('.photo-scene > img')).toHaveAttribute('src', /photo-v1.webp$/);
    await expect(page.locator('.photo-art-fit canvas')).toBeVisible();
    const original = await page.getByTestId('product-preview').evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await page.getByRole('button', { name: '切換為橫式' }).click();
    await expect(page.locator('.photo-scene > img')).toHaveAttribute('src', /landscape-v1.webp$/);
    for (const thumbnail of await page.locator('.scene-photo-thumbnail img').all()) await expect(thumbnail).toHaveAttribute('src', /landscape-v1.webp$/);
    await page.locator('.scene-buttons').screenshot({ path: 'test-results/scene-thumbnails-landscape.png' });
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
    await page.getByRole('button', { name: '切換為直式' }).click();
    await expect(page.locator('.photo-scene > img')).toHaveAttribute('src', /photo-v1.webp$/);
    await expect(page.locator('.photo-art-fit canvas')).toBeVisible();
    expect(await page.getByTestId('product-preview').evaluate((c: HTMLCanvasElement) => c.toDataURL())).toBe(original);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '切換為橫式' }).click();
  await expect(page.locator('.photo-art-fit canvas')).toBeVisible();
  await page.locator('.product-preview-panel').screenshot({ path: 'test-results/landscape-photo-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('ink stack uses one artwork and restricts double-sided materials', async ({ page }) => {
  await page.goto('/'); await upload(page);
  const original = (await draft(page)).design.layers;
  await page.getByRole('button', { name: '底材', exact: true }).click();
  await page.getByRole('button', { name: '透明壓克力', exact: true }).click();
  for (const stack of ['cmyk-white', 'white-cmyk', 'cmyk-white-cmyk']) {
    await page.getByRole('button', { name: ({ 'cmyk-white': 'CMYK → 白', 'white-cmyk': '白 → CMYK', 'cmyk-white-cmyk': 'CMYK → 白 → CMYK' } as Record<string,string>)[stack], exact: true }).click();
    await expect.poll(async () => (await draft(page)).design.printStack).toBe(stack);
    expect((await draft(page)).design.layers).toEqual(original);
    await expect(page.getByRole('group', { name: '編輯面' })).toHaveCount(0);
    await expect(page.locator('.floating-layers .layer-row')).toHaveCount(2);
  }
  await page.reload(); await expect(page.getByText('所有變更已儲存')).toBeVisible();
  await page.getByRole('button', { name: '底材', exact: true }).click();
  await expect(page.getByRole('button', { name: 'CMYK → 白 → CMYK', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '金', exact: true }).click();
  await expect(page.getByRole('button', { name: '白 → CMYK', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'CMYK → 白 → CMYK', exact: true })).toBeDisabled();
  await page.screenshot({ path: 'test-results/ink-stack.png', fullPage: true });
});

test('bundled font selection changes live text and survives reload', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: '文字', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '文字', exact: true }).click();
  await page.getByLabel('新增文字字體').selectOption('wenkai'); await page.getByRole('button', { name: '加入標題', exact: true }).click();
  await expect(page.getByLabel('文字字體', { exact: true })).toHaveValue('wenkai');
  const pixels = new Set<string>();
  for (const id of ['sans', 'serif', 'wenkai', 'wenkai-light', 'wenkai-bold']) {
    await page.getByLabel('文字字體', { exact: true }).selectOption(id);
    await expect.poll(async () => (await draft(page)).design.layers[0]?.fontId).toBe(id);
    pixels.add(await page.getByTestId('product-preview').evaluate((c: HTMLCanvasElement) => c.toDataURL()));
  }
  expect(pixels.size).toBe(5);
  await page.reload(); await expect(page.getByText('所有變更已儲存')).toBeVisible();
  await page.locator('.layer-select').filter({ hasText: '標題' }).click();
  await expect(page.getByLabel('文字字體', { exact: true })).toHaveValue('wenkai-bold');
  await page.getByRole('button', { name: '文字', exact: true }).click();
  await page.screenshot({ path: 'test-results/fonts.png', fullPage: true });
});




test('print-order illustration explains hover and mobile help without changing selection', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '底材', exact: true }).click();
  const choice = page.getByRole('button', { name: 'CMYK → 白', exact: true });
  await choice.hover();
  await expect(page.locator('#stack-effect-guide')).toContainText('從底材側觀看');
  await expect(page.locator('#stack-effect-guide svg')).toBeVisible();
  await expect(page.getByRole('button', { name: '白 → CMYK', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await choice.focus(); await expect(page.locator('#stack-effect-guide')).toContainText('未套用');
  await choice.click(); await expect.poll(async () => (await draft(page)).design.printStack).toBe('cmyk-white');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'CMYK → 白 → CMYK 效果說明', exact: true }).click();
  await expect(page.locator('#stack-effect-guide')).toContainText('兩側皆可觀看');
  await expect(choice).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'CMYK → 白 → CMYK', exact: true })).toBeDisabled();
  await page.locator('#stack-effect-guide').scrollIntoViewIfNeeded();
  await expect(page.locator('.material-panel')).toHaveCSS('max-height', 'none');
  await page.locator('#stack-effect-guide').screenshot({ path: 'test-results/print-order-guide-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('acrylic block product and size selection stay synchronized', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '壓克力磚 立體透明底材・可選尺寸', exact: true }).click();
  await expect(page.getByLabel('商品尺寸')).toHaveValue('mini-friend');
  await page.getByRole('button', { name: '底材', exact: true }).click();
  await expect(page.locator('.material-grid button')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '透明壓克力', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('商品尺寸').selectOption('friend');
  await expect.poll(async () => (await draft(page)).design.sizeId).toBe('friend');
  await page.getByRole('button', { name: '切換為橫式', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.orientation).toBe('landscape');
  const ratio = await page.getByTestId('product-preview').evaluate((c: HTMLCanvasElement) => c.width / c.height);
  expect(ratio).toBeCloseTo(50 / 30, 2);
  await page.reload(); await expect(page.getByLabel('商品尺寸')).toHaveValue('friend');
  await expect(page.getByLabel('透明壓克力磚預覽')).toBeVisible();
  await page.screenshot({ path: 'test-results/acrylic-block.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('商品尺寸').selectOption('small-block');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('custom acrylic dimensions and quotation notice survive reload', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '壓克力磚 立體透明底材・可選尺寸', exact: true }).click();
  await page.getByLabel('商品尺寸').selectOption('custom');
  await page.getByLabel('高 (mm)', { exact: true }).fill('80');
  await page.getByLabel('長 (mm)', { exact: true }).fill('55');
  await page.getByLabel('厚 (mm)', { exact: true }).fill('15');
  await expect.poll(async () => (await draft(page)).design.customSize).toEqual({ heightMm: 80, widthMm: 55, thicknessMm: 15 });
  await expect(page.getByText('其他尺寸需另外報價', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByLabel('商品尺寸')).toHaveValue('custom');
  await expect(page.getByLabel('厚 (mm)', { exact: true })).toHaveValue('15');
  await page.getByRole('button', { name: /確認與輸出/ }).click();
  await expect(page.getByRole('dialog')).toContainText('需另外報價');
  await page.getByRole('button', { name: '繼續編輯' }).click();
  await page.screenshot({ path: 'test-results/custom-acrylic.png', fullPage: true });
});

test('block workspace fits small sizes and preview compares a fixed reference', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '壓克力磚 立體透明底材・可選尺寸', exact: true }).click();
  await expect(page.getByLabel('商品尺寸').locator('option')).toHaveCount(4);
  await expect(page.getByLabel('商品尺寸')).not.toContainText('舊規格');
  const area = page.getByTestId('editor-canvas');
  await expect(area).toHaveCSS('height', '460px');
  const initial = await area.locator('canvas').first().boundingBox();
  expect(initial!.height).toBeGreaterThan(350);
  const reference = await page.getByLabel('信用卡大小參照物，8.56 × 5.4 公分').boundingBox();
  const product = await page.locator('.acrylic-block-object').boundingBox();
  expect(product!.width / reference!.width).toBeCloseTo(20 / 85.6, 2);
  await page.getByRole('button', { name: '放大工作區' }).click();
  expect((await area.locator('canvas').first().boundingBox())!.height).toBeGreaterThan(initial!.height);
  await page.getByRole('button', { name: '符合', exact: true }).click();
  await page.getByLabel('商品尺寸').selectOption('small-block');
  await expect(area).toHaveCSS('height', '460px');
  const larger = await page.locator('.acrylic-block-object').boundingBox();
  const ref2 = await page.getByLabel('信用卡大小參照物，8.56 × 5.4 公分').boundingBox();
  expect(larger!.width / ref2!.width).toBeCloseTo(60 / 85.6, 2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('商品尺寸').selectOption('mini-friend');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/block-reference-mobile.png', fullPage: true });
});

test('retired block sizes are no longer presets and existing artwork keeps its dimensions', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '壓克力磚 立體透明底材・可選尺寸', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.templateId).toBe('acrylic-block-v1');
  const saved = await draft(page);
  const response = await page.request.put(`/api/designs/${saved.design.id}`, { data: { design: { ...saved.design, sizeId: '100x100' }, baseRevision: saved.revision } });
  expect(response.ok()).toBe(true);
  await page.reload();
  await expect(page.getByLabel('商品尺寸')).toHaveValue('100x100');
  await expect(page.getByLabel('商品尺寸').locator('option:checked')).toHaveText('其他尺寸（100 × 100 mm・另外報價）');
  await expect(page.getByLabel('商品尺寸')).not.toContainText('舊規格');
  await expect(page.locator('.canvas-heading')).toContainText('100 × 100 mm');
  expect((await draft(page)).design.layers).toEqual(saved.design.layers);
  await page.getByLabel('商品尺寸').selectOption('mini-friend');
  await expect(page.getByLabel('商品尺寸').locator('option[value="100x100"]')).toHaveCount(0);
});

test('oversized selection keeps corner handles reachable and resizes without changing product', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '壓克力磚 立體透明底材・可選尺寸', exact: true }).click();
  await page.getByLabel('商品尺寸').selectOption('small-block');
  await expect.poll(async () => (await draft(page)).design.sizeId).toBe('small-block');
  const saved = await draft(page);
  const layer = { id: 'f1ecc2fc-c29e-4e06-8da8-70c6f24b3e1e', kind: 'shape', name: '超出邊界測試', shape: 'rect', x: -70, y: 0, width: 200, height: 100, rotation: 0, opacity: 1, visible: true, locked: false, fill: '#4b8270' };
  expect((await page.request.put(`/api/designs/${saved.design.id}`, { data: { design: { ...saved.design, layers: [layer] }, baseRevision: saved.revision } })).ok()).toBe(true);
  await page.reload(); await page.locator('.layer-select').filter({ hasText: layer.name }).click();
  const area = page.getByTestId('editor-canvas');
  await expect(area).toHaveAttribute('data-bounded-controls', 'true');
  const box = (await area.locator('canvas').first().boundingBox())!;
  const scale = box.width / 84;
  const x = box.x + 72 * scale, y = box.y + 112 * scale;
  const zoomBefore = await page.locator('.zoom').innerText();
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 25, y - 12.5, { steps: 8 }); await page.mouse.up();
  await expect.poll(async () => (await draft(page)).design.layers[0].width).toBeLessThan(195);
  expect((await draft(page)).design.sizeId).toBe('small-block');
  expect(await page.locator('.zoom').innerText()).toBe(zoomBefore);
  expect((await area.locator('canvas').first().boundingBox())!.width).toBeCloseTo(box.width);
  await page.setViewportSize({ width: 390, height: 844 });
  await area.scrollIntoViewIfNeeded();
  await expect(area).toHaveAttribute('data-bounded-controls', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/oversized-selection-mobile.png', fullPage: true });
});

test('custom dimension inputs swap with orientation and edit the displayed axis', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '壓克力磚 立體透明底材・可選尺寸', exact: true }).click();
  await page.getByLabel('商品尺寸').selectOption('custom');
  await page.getByLabel('高 (mm)', { exact: true }).fill('90');
  await page.getByLabel('長 (mm)', { exact: true }).fill('50');
  await page.getByLabel('厚 (mm)', { exact: true }).fill('5');
  await page.getByRole('button', { name: '切換為橫式', exact: true }).click();
  await expect(page.getByLabel('高 (mm)', { exact: true })).toHaveValue('50');
  await expect(page.getByLabel('長 (mm)', { exact: true })).toHaveValue('90');
  await expect(page.getByLabel('厚 (mm)', { exact: true })).toHaveValue('5');
  await expect(page.locator('.canvas-heading')).toContainText('90 × 50 mm');
  await page.getByLabel('長 (mm)', { exact: true }).fill('100');
  await expect(page.locator('.canvas-heading')).toContainText('100 × 50 mm');
  await expect.poll(async () => (await draft(page)).design.customSize).toEqual({ widthMm: 50, heightMm: 100, thicknessMm: 5 });
  await page.reload();
  await expect(page.getByLabel('長 (mm)', { exact: true })).toHaveValue('100');
  await page.getByRole('button', { name: '切換為直式', exact: true }).click();
  await expect(page.getByLabel('高 (mm)', { exact: true })).toHaveValue('100');
  await expect(page.getByLabel('長 (mm)', { exact: true })).toHaveValue('50');
  await expect(page.locator('.canvas-heading')).toContainText('50 × 100 mm');
  const top = await page.getByLabel('長 (mm)', { exact: true }).boundingBox();
  const side = await page.getByLabel('高 (mm)', { exact: true }).boundingBox();
  const canvas = await page.getByTestId('editor-canvas').boundingBox();
  expect(top!.y).toBeLessThan(canvas!.y);
  expect(side!.x).toBeGreaterThanOrEqual(canvas!.x + canvas!.width);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/dimension-controls-mobile.png', fullPage: true });
});

test('dimension sliders synchronize inputs and thickness sits below the canvas', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '壓克力磚 立體透明底材・可選尺寸', exact: true }).click();
  await page.getByLabel('商品尺寸').selectOption('custom');
  await page.getByLabel('長 (mm)', { exact: true }).fill('60');
  await expect(page.getByRole('slider', { name: '長滑桿', exact: true })).toHaveValue('60');
  await page.getByRole('slider', { name: '長滑桿', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('長 (mm)', { exact: true })).toHaveValue('65');
  await page.getByRole('slider', { name: '高滑桿', exact: true }).focus(); await page.keyboard.press('ArrowUp');
  await expect(page.getByLabel('高 (mm)', { exact: true })).toHaveValue('35');
  await page.getByRole('slider', { name: '厚滑桿', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('厚 (mm)', { exact: true })).toHaveValue('10');
  await expect.poll(async () => (await draft(page)).design.customSize).toEqual({ widthMm: 65, heightMm: 35, thicknessMm: 10 });
  const canvas = (await page.getByTestId('editor-canvas').boundingBox())!;
  const thickness = (await page.locator('.dimension-thickness').boundingBox())!;
  expect(thickness.y).toBeGreaterThanOrEqual(canvas.y + canvas.height);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('slider', { name: '長滑桿', exact: true }).scrollIntoViewIfNeeded();
  const rail = (await page.getByRole('slider', { name: '長滑桿', exact: true }).boundingBox())!;
  await page.mouse.click(rail.x + rail.width / 2, rail.y + rail.height / 2);
  await expect.poll(async () => Number(await page.getByLabel('長 (mm)', { exact: true }).inputValue())).toBeGreaterThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('長 (mm)', { exact: true }).fill('60');
  await page.screenshot({ path: 'test-results/dimension-sliders-mobile.png', fullPage: true });
});

test('custom dimension inputs snap to five mm and enforce upper limits', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '壓克力磚 立體透明底材・可選尺寸', exact: true }).click();
  await page.getByLabel('商品尺寸').selectOption('custom');
  const length = page.getByLabel('長 (mm)', { exact: true });
  await length.fill('63'); await length.blur(); await expect(length).toHaveValue('65');
  await length.fill('300'); await length.blur(); await expect(length).toHaveValue('250');
  const height = page.getByLabel('高 (mm)', { exact: true });
  await height.fill('260'); await height.blur(); await expect(height).toHaveValue('250');
  const thickness = page.getByLabel('厚 (mm)', { exact: true });
  await thickness.fill('55'); await thickness.blur(); await expect(thickness).toHaveValue('50');
  await expect.poll(async () => (await draft(page)).design.customSize).toEqual({ widthMm: 250, heightMm: 250, thicknessMm: 50 });
  await page.reload(); await expect(thickness).toHaveValue('50');
  await expect(page.getByRole('slider', { name: '長滑桿' })).toHaveAttribute('max', '250');
  await expect(page.getByRole('slider', { name: '厚滑桿' })).toHaveAttribute('max', '50');
  await length.fill('5'); await length.blur(); await expect(length).toHaveValue('20');
  await height.fill('15'); await height.blur(); await expect(height).toHaveValue('20');
  await thickness.fill('1'); await thickness.blur(); await expect(thickness).toHaveValue('5');
  await expect.poll(async () => (await draft(page)).design.customSize).toEqual({ widthMm: 20, heightMm: 20, thicknessMm: 5 });
  await page.reload(); await expect(length).toHaveValue('20'); await expect(height).toHaveValue('20');

});

test('thickness follows the shorter custom edge and remains valid after orientation changes', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '壓克力磚 立體透明底材・可選尺寸', exact: true }).click();
  await page.getByLabel('商品尺寸').selectOption('custom');
  const length = page.getByLabel('長 (mm)', { exact: true }), height = page.getByLabel('高 (mm)', { exact: true }), thickness = page.getByLabel('厚 (mm)', { exact: true });
  await length.fill('80'); await height.fill('60'); await thickness.fill('50');
  await length.fill('30'); await expect(thickness).toHaveValue('30');
  await expect(page.getByRole('slider', { name: '厚滑桿' })).toHaveAttribute('max', '30');
  await height.fill('20'); await expect(thickness).toHaveValue('20');
  await thickness.fill('50'); await thickness.blur(); await expect(thickness).toHaveValue('20');
  await expect.poll(async () => (await draft(page)).design.customSize).toEqual({ widthMm: 30, heightMm: 20, thicknessMm: 20 });
  await page.getByRole('button', { name: '切換為橫式', exact: true }).click();
  await expect(page.getByRole('slider', { name: '厚滑桿' })).toHaveAttribute('max', '20');
  await page.reload(); await expect(thickness).toHaveValue('20');
});

test('top product choices switch to editable badge sizes and preserve the draft', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: '商品種類' });
  await expect(nav.getByRole('button')).toHaveCount(3);
  await expect(page.getByLabel('商品模板')).toHaveCount(0);
  const badge = nav.getByRole('button', { name: '壓克力識別牌 名片與平牌・三種尺寸', exact: true });
  await badge.click(); await expect(badge).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('商品尺寸')).toHaveValue('50x90');
  await page.getByLabel('商品尺寸').selectOption('60x90');
  await page.getByRole('button', { name: '切換為橫式', exact: true }).click();
  await expect(page.locator('.canvas-heading')).toContainText('90 × 60 mm');
  await expect(page.getByLabel('商品尺寸').locator('option:checked')).toHaveText('加寬型 · 90 × 60 mm');
  await upload(page);
  await expect.poll(async () => (await draft(page)).design.sizeId).toBe('60x90');
  await page.reload(); await expect(badge).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('壓克力識別牌預覽')).toBeVisible();
  await expect(page.locator('.dimension-thickness')).toContainText('3 mm');
  await page.getByLabel('商品尺寸').selectOption('80x80');
  await expect(page.locator('.canvas-heading')).toContainText('80 × 80 mm');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/badge-mobile.png', fullPage: true });
});

test('badge lifestyle scenes and editable slot survive orientation and reload', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '壓克力識別牌 名片與平牌・三種尺寸', exact: true }).click();
  await page.getByRole('button', { name: '自訂長槽', exact: true }).click();
  await page.getByLabel('開槽', { exact: true }).check();
  await page.getByLabel('槽長 (mm)', { exact: true }).fill('18');
  await page.getByLabel('槽寬 (mm)', { exact: true }).fill('4');
  await expect.poll(async () => (await draft(page)).design.slot).toEqual({ enabled: true, widthMm: 18, heightMm: 4, shape: 'slot' });
  await upload(page);
  for (const scene of ['背包吊牌', '識別證配戴']) {
    await page.getByRole('button', { name: scene, exact: true }).click();
    await expect(page.getByLabel(scene + '照片融合預覽')).toBeVisible();
    await expect.poll(async () => page.locator('.badge-lifestyle>img').first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  await page.getByRole('button', { name: '切換為橫式', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.orientation).toBe('landscape');
  await page.reload(); await expect(page.getByLabel('槽長 (mm)', { exact: true })).toHaveValue('18');
  await expect(page.locator('.dimension-thickness')).toContainText('3 mm');
  await expect(page.locator('.badge-lifestyle')).toHaveAttribute('data-orientation', 'landscape');
  await page.screenshot({ path: 'test-results/badge-lanyard-landscape.png', fullPage: true });
  await page.getByRole('button', { name: '放大情境預覽', exact: false }).click();
  await expect(page.getByRole('dialog', { name: '放大識別牌預覽' })).toBeVisible();
  await page.getByRole('button', { name: '關閉', exact: true }).click();
  await page.getByRole('button', { name: '背包吊牌', exact: true }).click();
  await page.getByRole('button', { name: '切換為直式', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/badge-backpack-mobile.png', fullPage: true });
});


test('sidebar accessories apply exact holes and persist rounded corners', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '壓克力識別牌 名片與平牌・三種尺寸', exact: true }).click();
  const panel = page.getByRole('region', { name: '識別牌配件與孔槽' });
  for (const [name, id, width, height, shape] of [['織帶扣', 'webbing', 34, 4, 'slot'], ['珠鍊', 'ball-chain', 3, 3, 'circle'], ['鑰匙圈', 'keyring', 3, 3, 'circle'], ['識別證掛繩', 'lanyard', 15, 3, 'slot'], ['皮繩掛扣', 'leather', 5, 5, 'circle'], ['原款掛扣', 'original', 5, 5, 'circle']] as const) {
    await panel.getByRole('button', { name: new RegExp(name) }).click();
    await expect.poll(async () => (await draft(page)).design.slot).toEqual({ enabled: true, widthMm: width, heightMm: height, shape, ...(shape === 'circle' ? { position: 'center' } : {}) });
    await expect.poll(async () => (await draft(page)).design.badgeAccessory).toBe(id);
  }
  await page.getByRole('button', { name: 'R4 mm', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.badgeCornerRadiusMm).toBe(4);
  await page.getByRole('button', { name: '切換為橫式', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.orientation).toBe('landscape');
  await page.reload(); await expect(panel.getByRole('button', { name: /原款掛扣/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'R4 mm', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel.getByRole('button', { name: /織帶扣/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/badge-accessories-mobile.png', fullPage: true });
});

test('round-hole position moves the attachment without drifting off the scene', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '壓克力識別牌 名片與平牌・三種尺寸', exact: true }).click();
  await page.getByRole('button', { name: /原款掛扣/ }).click();
  await page.getByRole('button', { name: '底材', exact: true }).click();
  await page.getByRole('button', { name: '透明壓克力', exact: true }).click();
  const positions = page.getByRole('group', { name: '圓孔位置' });
  const leftOffsets = [];
  for (const [label, position] of [['左', 'left'], ['中', 'center'], ['右', 'right']] as const) {
    await positions.getByRole('button', { name: label, exact: true }).click();
    await expect.poll(async () => (await draft(page)).design.slot?.position).toBe(position);
    leftOffsets.push(await page.locator('.badge-live-art').evaluate(el => parseFloat((el as HTMLElement).style.left)));
  }
  expect(leftOffsets[0]).toBeGreaterThan(leftOffsets[1]); expect(leftOffsets[1]).toBeGreaterThan(leftOffsets[2]);
  await page.getByRole('button', { name: '切換為橫式', exact: true }).click();
  await expect.poll(async () => (await draft(page)).design.orientation).toBe('landscape');
  await page.reload(); await expect(positions.getByRole('button', { name: '右', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/clear-badge-right-hole.png', fullPage: true });
  await page.getByRole('button', { name: /織帶扣/ }).click(); await expect(positions).toHaveCount(0);
});
