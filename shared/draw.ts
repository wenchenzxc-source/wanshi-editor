import { dimensions, materials, slotGeometry, badgeRadius, type Design, type DesignLayer, type Template } from './model';
export function drawSubstrate(ctx: CanvasRenderingContext2D, d: Design, w: number, h: number, clearOpacity = 0.16) {
  ctx.save();
  if (!d.material) { ctx.globalAlpha = d.backgroundOpacity; ctx.fillStyle = d.background; }
  else if (d.material === 'clear') { ctx.fillStyle = `rgba(215,235,240,${clearOpacity})`; }
  else if (d.material === 'white' || d.material === 'black') ctx.fillStyle = materials[d.material].color;
  else {
    const g = ctx.createLinearGradient(0, 0, w, h);
    const colors = d.material === 'iridescent' ? ['#b8dfeaaa','#f2c7ebaa','#e8e9b6aa','#b9e5d9aa'] : [materials[d.material].color, '#fff5e3', materials[d.material].color, '#777b80'];
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c)); ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, w, h); ctx.restore();
}
export type RenderMode = 'preview' | 'production' | 'mask';
import { getFont } from './fonts';
export const FONT = 'Wanshi Sans';
export function drawLayer(ctx: CanvasRenderingContext2D, l: DesignLayer, image?: CanvasImageSource, mode: RenderMode = 'preview') {
  if (!l.visible || (mode === 'mask' && l.kind !== 'uv') || (mode === 'production' && l.kind === 'uv')) return;
  ctx.save();
  ctx.globalAlpha = l.opacity;
  ctx.fillStyle = mode === 'mask' ? '#ffffff' : l.fill;
  if (l.kind === 'image' && image) ctx.drawImage(image, 0, 0, l.width, l.height);
  else if (l.kind === 'text') {
    const size = l.fontSize || 10;
    ctx.font = `${size}px "${getFont(l.fontId).family}", "${FONT}"`; ctx.textBaseline = 'top';
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
  const radius = badgeRadius(d, t);
  if (radius) { ctx.beginPath(); ctx.roundRect(b, b, w, h, radius); ctx.clip(); }
  if (mode !== 'mask' && (mode === 'preview' || !d.material)) drawSubstrate(ctx, d, bleed ? fullW : w, bleed ? fullH : h, t.presentation === 'acrylic-badge' ? 0.035 : 0.16);
  ctx.translate(b, b);
  for (const l of d.layers.filter(l => (l.face || 'front') === (!d.printStack && d.duplex ? d.activeFace || 'front' : 'front'))) { ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rotation * Math.PI / 180); drawLayer(ctx, l, images.get(l.assetId || ''), mode); ctx.restore(); }
  if (mode === 'preview' && d.printView === 'acrylic') {
    const gloss = ctx.createLinearGradient(0, 0, w, h); gloss.addColorStop(0, '#ffffff55'); gloss.addColorStop(.45, '#ffffff08'); gloss.addColorStop(.5, '#ffffff35'); gloss.addColorStop(1, '#ffffff00'); ctx.fillStyle = gloss; ctx.fillRect(0, 0, w, h);
  }
  if (mode === 'preview' && t.presentation === 'acrylic-badge' && d.material === 'clear') {
    ctx.save();
    const edge = ctx.createLinearGradient(0, 0, w, h);
    edge.addColorStop(0, '#ffffffd9'); edge.addColorStop(.35, '#cbe3e54d'); edge.addColorStop(.65, '#ffffffb3'); edge.addColorStop(1, '#8daeb166');
    ctx.strokeStyle = edge; ctx.lineWidth = .35; ctx.beginPath(); ctx.roundRect(.2, .2, w - .4, h - .4, Math.max(0, radius - .2)); ctx.stroke();
    const reflection = ctx.createLinearGradient(0, 0, w, h);
    reflection.addColorStop(0, '#ffffff18'); reflection.addColorStop(.4, '#ffffff00'); reflection.addColorStop(.43, '#ffffff24'); reflection.addColorStop(.48, '#ffffff00'); reflection.addColorStop(1, '#ffffff05');
    ctx.fillStyle = reflection; ctx.fillRect(0, 0, w, h); ctx.restore();
  }
  const slot = slotGeometry(d, t);
  if (slot) {
    ctx.save(); ctx.globalAlpha = 1;
    if (mode !== 'mask') ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.roundRect(slot.x, slot.y, slot.width, slot.height, slot.radius); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}
