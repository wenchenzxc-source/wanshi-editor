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
  const { w, h, fullW, fullH } = dimensions(d, t), scale = t.dpi / 25.4;
  const width = Math.round((bleed ? fullW : w) * scale), height = Math.round((bleed ? fullH : h) * scale);
  const canvas = createCanvas(width, height), images = new Map();
  for (const l of d.layers) if (l.assetId && !images.has(l.assetId)) {
    if (!assets.some(a => a.id === l.assetId)) throw new Error('Missing asset');
    // Decode/auto-orient a working copy. The uploaded bytes are never changed.
    const bytes = await sharp(await store.readBlob('files', l.assetId, 'bin')).rotate().png().toBuffer();
    images.set(l.assetId, await loadImage(bytes));
  }
  drawDesign(canvas.getContext('2d') as unknown as CanvasRenderingContext2D, d, t, images, mode, scale, bleed);
  return sharp(await canvas.encode('png')).withMetadata({ density: t.dpi }).png().toBuffer();
}
