import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import type { Design, DesignLayer } from '../../shared/model';

const imageName = '變形測試.png';
type Draft = { design: Design; revision: number };
type Paper = { width: number; height: number; bleed: number };
const a5: Paper = { width: 148, height: 210, bleed: 3 };

async function draft(page: Page): Promise<Draft> {
  return page.evaluate(async () => (await fetch(`/api/designs/${localStorage.getItem('wanshi:last-design')}`)).json());
}

async function imageLayer(page: Page): Promise<DesignLayer> {
  const layer = (await draft(page)).design.layers.find(layer => layer.name === imageName);
  expect(layer).toBeDefined();
  return layer!;
}

async function startImage(page: Page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '讓喜歡的畫面，成為日常。' })).toBeVisible();
  const png = await sharp({ create: { width: 640, height: 480, channels: 4, background: '#cb674d' } }).png().toBuffer();
  await page.getByTestId('file-upload').setInputFiles({ name: imageName, mimeType: 'image/png', buffer: png });
  await expect.poll(async () => (await draft(page)).design.layers.length).toBe(1);
  await expect(page.getByText('所有變更已儲存')).toBeVisible();
  await page.getByRole('button', { name: '收合圖層' }).click();
  await expect(ratioToggle(page)).toHaveAttribute('aria-pressed', 'true');
}

function ratioToggle(page: Page) {
  return page.getByRole('region', { name: '圖片自由變形' }).getByRole('button', { name: '鎖定長寬比例', exact: true });
}

async function selectImage(page: Page) {
  const expand = page.getByRole('button', { name: '展開圖層', exact: true });
  if (await expand.isVisible()) await expand.click();
  await page.locator('.layer-select').filter({ hasText: imageName }).click();
  await page.getByRole('button', { name: '收合圖層', exact: true }).click();
}

// Locate the real Konva handle in page coordinates, including the clipped
// control rectangle used when the selected artwork extends beyond the paper.
async function dragHandle(page: Page, handle: 'bottom-right' | 'middle-right' | 'bottom-center', dx: number, dy: number, shift = false, paper = a5) {
  const before = await imageLayer(page);
  expect(before.rotation).toBe(0);
  const area = page.getByTestId('editor-canvas');
  const canvas = area.locator('canvas').first();
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const fullWidth = paper.width + paper.bleed * 2, fullHeight = paper.height + paper.bleed * 2;
  const scale = box.width / (fullWidth + 24);
  const bounded = await area.getAttribute('data-bounded-controls') === 'true';
  const left = bounded ? Math.max(0, before.x + paper.bleed) : before.x + paper.bleed;
  const top = bounded ? Math.max(0, before.y + paper.bleed) : before.y + paper.bleed;
  const right = bounded ? Math.min(fullWidth, before.x + before.width + paper.bleed) : before.x + before.width + paper.bleed;
  const bottom = bounded ? Math.min(fullHeight, before.y + before.height + paper.bleed) : before.y + before.height + paper.bleed;
  const x = box.x + (12 + (handle === 'bottom-center' ? (left + right) / 2 : right)) * scale;
  const y = box.y + (12 + (handle === 'middle-right' ? (top + bottom) / 2 : bottom)) * scale;
  if (shift) await page.keyboard.down('Shift');
  try {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
  } finally {
    if (shift) await page.keyboard.up('Shift');
  }
  await expect.poll(async () => {
    const after = await imageLayer(page);
    return Math.abs(after.width - before.width) + Math.abs(after.height - before.height);
  }).toBeGreaterThan(0.5);
  await expect(page.getByText('所有變更已儲存')).toBeVisible();
  return { before, after: await imageLayer(page) };
}

test('images resize proportionally by default and Shift only temporarily allows free distortion', async ({ page }) => {
  await startImage(page);
  await expect(page.getByTestId('editor-canvas')).toHaveAttribute('data-bounded-controls', 'false');
  const initial = await imageLayer(page);
  expect(initial.aspectRatioLocked).not.toBe(false);

  const locked = await dragHandle(page, 'bottom-right', 36, 8);
  expect(locked.after.width).toBeGreaterThan(locked.before.width);
  expect(locked.after.width / locked.after.height).toBeCloseTo(initial.width / initial.height, 3);
  await page.screenshot({ path: 'test-results/transform-desktop.png', fullPage: true });

  const free = await dragHandle(page, 'bottom-right', 36, 4, true);
  expect(Math.abs(free.after.width / free.after.height - free.before.width / free.before.height)).toBeGreaterThan(0.08);
  await expect(ratioToggle(page)).toHaveAttribute('aria-pressed', 'true');
  expect(free.after.aspectRatioLocked).not.toBe(false);

  const released = await dragHandle(page, 'bottom-right', 24, 4);
  expect(released.after.width / released.after.height).toBeCloseTo(free.after.width / free.after.height, 3);
  await expect(ratioToggle(page)).toHaveAttribute('aria-pressed', 'true');
});

test('unlocked images support independent corner and side resizing even while Shift is held', async ({ page }) => {
  await startImage(page);
  await ratioToggle(page).click();
  await expect(ratioToggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await imageLayer(page)).aspectRatioLocked).toBe(false);

  const corner = await dragHandle(page, 'bottom-right', 30, 4);
  expect(Math.abs(corner.after.width / corner.after.height - corner.before.width / corner.before.height)).toBeGreaterThan(0.08);

  const horizontal = await dragHandle(page, 'middle-right', 24, 10);
  expect(horizontal.after.width).toBeGreaterThan(horizontal.before.width + 4);
  expect(horizontal.after.height).toBeCloseTo(horizontal.before.height, 3);
  const vertical = await dragHandle(page, 'bottom-center', 10, 24);
  expect(vertical.after.height).toBeGreaterThan(vertical.before.height + 4);
  expect(vertical.after.width).toBeCloseTo(vertical.before.width, 3);

  const shifted = await dragHandle(page, 'bottom-right', 30, 2, true);
  expect(Math.abs(shifted.after.width / shifted.after.height - shifted.before.width / shifted.before.height)).toBeGreaterThan(0.08);
  expect(shifted.after.aspectRatioLocked).toBe(false);
  await expect(ratioToggle(page)).toHaveAttribute('aria-pressed', 'false');
  await page.screenshot({ path: 'test-results/transform-unlocked-desktop.png', fullPage: true });
});

test('numeric dimensions follow the ratio lock and both lock states survive reopening a draft', async ({ page }) => {
  await startImage(page);
  const width = page.getByLabel('寬 (mm)', { exact: true });
  const height = page.getByLabel('高 (mm)', { exact: true });
  await width.fill('80');
  await expect.poll(async () => {
    const layer = await imageLayer(page);
    return [layer.width, layer.height];
  }).toEqual([80, 60]);
  await height.fill('48');
  await expect.poll(async () => {
    const layer = await imageLayer(page);
    return [layer.width, layer.height];
  }).toEqual([64, 48]);

  await ratioToggle(page).click();
  await width.fill('92');
  await expect.poll(async () => {
    const layer = await imageLayer(page);
    return [layer.width, layer.height, layer.aspectRatioLocked];
  }).toEqual([92, 48, false]);
  await page.reload();
  await selectImage(page);
  await expect(ratioToggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(width).toHaveValue('92');
  await expect(height).toHaveValue('48');
  await height.fill('40');
  await expect.poll(async () => {
    const layer = await imageLayer(page);
    return [layer.width, layer.height];
  }).toEqual([92, 40]);

  await ratioToggle(page).click();
  await width.fill('69');
  await expect.poll(async () => {
    const layer = await imageLayer(page);
    return [layer.width, layer.height, layer.aspectRatioLocked];
  }).toEqual([69, 30, true]);
  await page.reload();
  await selectImage(page);
  await expect(ratioToggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(width).toHaveValue('69');
  await expect(height).toHaveValue('30');
  await height.fill('50');
  await expect.poll(async () => {
    const layer = await imageLayer(page);
    return [layer.width, layer.height];
  }).toEqual([115, 50]);
  await page.setViewportSize({ width: 390, height: 844 });
  await ratioToggle(page).scrollIntoViewIfNeeded();
  await expect(ratioToggle(page)).toBeVisible();
  await expect(ratioToggle(page)).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/transform-mobile.png', fullPage: true });
});

test('bounded controls preserve the full image ratio and allow Shift distortion without changing zoom', async ({ page }) => {
  await startImage(page);
  await page.getByRole('button', { name: '壓克力磚 立體透明底材・可選尺寸', exact: true }).click();
  await page.getByLabel('商品尺寸').selectOption('small-block');
  await expect.poll(async () => (await draft(page)).design.sizeId).toBe('small-block');
  const saved = await draft(page);
  // A legacy layer with no explicit lock value must keep its own 2:1 ratio,
  // even though its visible proxy has the paper's much narrower 3:5 ratio.
  const { aspectRatioLocked: _lock, ...original } = saved.design.layers[0];
  const oversized = { ...original, x: -70, y: 0, width: 200, height: 100, rotation: 0 };
  const response = await page.request.put(`/api/designs/${saved.design.id}`, {
    data: { design: { ...saved.design, layers: [oversized] }, baseRevision: saved.revision },
  });
  expect(response.ok()).toBe(true);
  await page.reload();
  await selectImage(page);
  const area = page.getByTestId('editor-canvas');
  await expect(area).toHaveAttribute('data-bounded-controls', 'true');
  await expect(ratioToggle(page)).toHaveAttribute('aria-pressed', 'true');
  const canvasWidth = (await area.locator('canvas').first().boundingBox())!.width;
  const zoom = await page.locator('.zoom').innerText();
  const paper = { width: 60, height: 100, bleed: 0 };

  const locked = await dragHandle(page, 'bottom-right', -24, -8, false, paper);
  expect(locked.after.width).toBeLessThan(locked.before.width);
  expect(locked.after.width / locked.after.height).toBeCloseTo(2, 3);
  await expect(area).toHaveAttribute('data-bounded-controls', 'true');

  const shifted = await dragHandle(page, 'bottom-right', -24, -2, true, paper);
  expect(Math.abs(shifted.after.width / shifted.after.height - 2)).toBeGreaterThan(0.1);
  const released = await dragHandle(page, 'bottom-right', -12, -3, false, paper);
  expect(released.after.width / released.after.height).toBeCloseTo(shifted.after.width / shifted.after.height, 3);
  expect((await draft(page)).design.sizeId).toBe('small-block');
  expect(await page.locator('.zoom').innerText()).toBe(zoom);
  expect((await area.locator('canvas').first().boundingBox())!.width).toBeCloseTo(canvasWidth, 3);
});
