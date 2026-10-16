import { dimensions, type Design, type DesignLayer, type Template } from './model';
export type RenderMode = 'preview' | 'production' | 'mask';
export const FONT = 'Wanshi Sans';
export function drawLayer(ctx: CanvasRenderingContext2D, l: DesignLayer, image?: CanvasImageSource, mode: RenderMode = 'preview') {
  if (!l.visible || (mode === 'mask' && l.kind !== 'uv') || (mode === 'production' && l.kind === 'uv')) return;
  ctx.save();
  ctx.globalAlpha = l.opacity;
  ctx.fillStyle = mode === 'mask' ? '#ffffff' : l.fill;
  if (l.kind === 'image' && image) ctx.drawImage(image, 0, 0, l.width, l.height);
  else if (l.kind === 'text') {
    const size = l.fontSize || 10;
    ctx.font = `${size}px "${FONT}"`; ctx.textBaseline = 'top';
    ctx.beginPath(); ctx.rect(0, 0, l.width, l.height); ctx.clip();
    let y = 0;
    for (const paragraph of (l.text || '').split('\n')) {
      let line = '';
      for (const char of Array.from(paragraph)) {
        if (line && ctx.measureText(line + char).width > l.width) { ctx.fillText(line, 0, y); y += size * 1.3; line = ''; }
        line += char;
      }
      ctx.fillText(line, 0, y); y += size * 1.3;
    }
  } else if (l.kind !== 'image') {
    ctx.scale(l.width, l.height); ctx.beginPath();
    if (l.shape === 'circle') ctx.ellipse(0.5, 0.5, 0.5, 0.5, 0, 0, Math.PI * 2);
    else if (l.shape === 'rect') ctx.rect(0, 0, 1, 1);
    else if (l.shape === 'star') {
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.22 : 0.5; const x = 0.5 + Math.cos(a) * r, y = 0.5 + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath();
    } else { ctx.moveTo(0.5, 0); ctx.bezierCurveTo(1.2, 0.35, 1, 0.85, 0.5, 1); ctx.bezierCurveTo(0, 0.85, -0.2, 0.35, 0.5, 0); ctx.closePath(); }
    ctx.fill();
    if (l.kind === 'uv' && mode === 'preview') { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.018; ctx.stroke(); }
  }
  ctx.restore();
}
export function drawDesign(ctx: CanvasRenderingContext2D, d: Design, t: Template, images: Map<string, CanvasImageSource>, mode: RenderMode, scale: number, bleed = true) {
  const { w, h, fullW, fullH } = dimensions(d, t), b = bleed ? t.bleedMm : 0;
  ctx.save(); ctx.scale(scale, scale);
  if (mode === 'mask') { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, bleed ? fullW : w, bleed ? fullH : h); }
  else { ctx.globalAlpha = d.backgroundOpacity; ctx.fillStyle = d.background; ctx.fillRect(0, 0, bleed ? fullW : w, bleed ? fullH : h); ctx.globalAlpha = 1; }
  ctx.translate(b, b);
  for (const l of d.layers) { ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rotation * Math.PI / 180); drawLayer(ctx, l, images.get(l.assetId || ''), mode); ctx.restore(); }
  ctx.restore();
}
