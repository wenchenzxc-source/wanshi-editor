import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawDesign, FONT, type RenderMode } from '../shared/draw';
import { dimensions, type Design, type Template, type Asset } from '../shared/model';
import type { StoreLike } from './store';
import { fonts } from '../shared/fonts';
export const fontPath = fileURLToPath(new URL('../public/fonts/NotoSansTC.ttf', import.meta.url));
export function registerFont() { for (const font of fonts) { const file = path.join(path.dirname(fontPath), font.file); if (!GlobalFonts.registerFromPath(file, font.family)) throw new Error('Missing bundled font: ' + font.file); } }
export async function render(d: Design, t: Template, assets: Asset[], store: StoreLike, mode: RenderMode, bleed = true) {
  const { w, h, fullW, fullH } = dimensions(d, t), outputPpi = mode === 'preview' ? Math.min(t.dpi, 300) : t.dpi, scale = outputPpi / 25.4;
  const width = Math.round((bleed ? fullW : w) * scale), height = Math.round((bleed ? fullH : h) * scale);
  const canvas = createCanvas(width, height), images = new Map();
  for (const l of d.layers) if (l.assetId && !images.has(l.assetId)) {
    if (!assets.some(a => a.id === l.assetId)) throw new Error('Missing asset');
    // Decode/auto-orient a working copy. The uploaded bytes are never changed.
    const bytes = await sharp(await store.readBlob('files', l.assetId, 'bin')).rotate().png().toBuffer();
    images.set(l.assetId, await loadImage(bytes));
  }
  drawDesign(canvas.getContext('2d') as unknown as CanvasRenderingContext2D, d, t, images, mode, scale, bleed);
  return sharp(await canvas.encode('png')).withMetadata({ density: outputPpi }).png().toBuffer();
}

/** Customer-facing proof only: deliberately small and permanently watermarked. */
export async function customerPreview(bytes: Buffer) {
  const low = await sharp(bytes).resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  const metadata = await sharp(low).metadata(), width = metadata.width!, height = metadata.height!;
  const watermark = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><pattern id="p" width="330" height="160" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><text x="18" y="82" font-family="Arial,sans-serif" font-size="26" font-weight="600" letter-spacing="3" fill="#ffffff" fill-opacity=".20" stroke="#183d39" stroke-opacity=".12" stroke-width="1">WANSHI PREVIEW</text></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`);
  return sharp(low).composite([{ input: watermark, blend: 'atop' }]).withMetadata({ density: 96 }).png().toBuffer();
}
