import { drawFloatingPetal } from './petals';
import { screenTearBands } from './screenTear';
import { dimensions, materials, slotGeometry, badgeRadius, photoImageArea, type Design, type DesignLayer, type Template } from './model';
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
export function imageCropRect(l: DesignLayer, image: CanvasImageSource) {
  if (l.cropWidth === undefined || l.cropHeight === undefined) return null;
  const source = image as CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number; width?: number; height?: number };
  const sourceWidth = Number(source.naturalWidth || source.videoWidth || source.width || 0);
  const sourceHeight = Number(source.naturalHeight || source.videoHeight || source.height || 0);
  if (!sourceWidth || !sourceHeight || !l.width || !l.height) return null;
  const width = Math.min(1 - (l.cropX ?? 0), l.cropWidth) * sourceWidth;
  const height = Math.min(1 - (l.cropY ?? 0), l.cropHeight) * sourceHeight;
  return { x: (l.cropX ?? 0) * sourceWidth, y: (l.cropY ?? 0) * sourceHeight, width, height };
}
function drawCornerImage(ctx: CanvasRenderingContext2D, image: CanvasImageSource, crop: NonNullable<ReturnType<typeof imageCropRect>>, layer: DesignLayer) {
  const position = layer.cornerPosition!;
  const segments = (fadeAtStart: boolean) => {
    const fade = .3, steps = 8;
    const parts: { from: number; to: number; opacity: number }[] = [];
    if (!fadeAtStart) parts.push({ from: 0, to: 1 - fade, opacity: 1 });
    for (let i = 0; i < steps; i++) {
      const from = fadeAtStart ? i * fade / steps : 1 - fade + i * fade / steps;
      const to = fadeAtStart ? (i + 1) * fade / steps : 1 - fade + (i + 1) * fade / steps;
      const progress = (i + .5) / steps;
      const value = fadeAtStart ? progress : 1 - progress;
      parts.push({ from, to, opacity: value * value * (3 - 2 * value) });
    }
    if (fadeAtStart) parts.push({ from: fade, to: 1, opacity: 1 });
    return parts;
  };
  const xs = segments(position.endsWith('right'));
  const ys = segments(position.startsWith('bottom'));
  for (const x of xs) for (const y of ys) {
    ctx.globalAlpha = layer.opacity * x.opacity * y.opacity;
    ctx.drawImage(image, crop.x + x.from * crop.width, crop.y + y.from * crop.height, (x.to - x.from) * crop.width, (y.to - y.from) * crop.height, x.from * layer.width, y.from * layer.height, (x.to - x.from) * layer.width, (y.to - y.from) * layer.height);
  }
  ctx.globalAlpha = layer.opacity;
}
export function drawPhotoBorder(ctx: CanvasRenderingContext2D, d: Design, t: Template, mode: RenderMode = 'preview') {
  const area = photoImageArea(d, t); if (!area) return;
  const { w, h } = dimensions(d, t);
  ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = mode === 'mask' ? '#000000' : '#ffffff';
  ctx.fillRect(0, 0, w, area.y); ctx.fillRect(0, area.y + area.height, w, h - area.y - area.height);
  ctx.fillRect(0, area.y, area.x, area.height); ctx.fillRect(area.x + area.width, area.y, w - area.x - area.width, area.height);
  ctx.restore();
}
import { getFont } from './fonts';
import { drawQuoteFrame, quoteInsets } from './quotes';
import { drawFrame, drawFrameImage } from './frame';
export const FONT = 'Wanshi Sans';
export function textFont(layer: DesignLayer, size = layer.fontSize || 10) {
  const style = layer.fontStyle === 'italic' ? 'italic ' : '';
  const weight = layer.fontWeight === 'bold' ? '700 ' : '';
  return `${style}${weight}${size}px "${getFont(layer.fontId).family}", "${FONT}"`;
}
export function wrapTextLines(text: string, width: number, measure: (value: string) => number) {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const char of Array.from(paragraph)) {
      if (line && measure(line + char) > width) { lines.push(line); line = ''; }
      line += char;
    }
    lines.push(line);
  }
  return lines;
}
export function drawLayer(ctx: CanvasRenderingContext2D, l: DesignLayer, image?: CanvasImageSource, mode: RenderMode = 'preview', renderScale = 1) {
  if (!l.visible || (mode === 'mask' && l.kind !== 'uv') || (mode === 'production' && l.kind === 'uv')) return;
  ctx.save();
  for (const hole of l.erasures || []) {
    ctx.beginPath(); ctx.rect(-100000, -100000, 200000, 200000);
    ctx.ellipse(hole.x * l.width, hole.y * l.height, hole.rx * l.width, hole.ry * l.height, 0, 0, Math.PI * 2);
    ctx.clip('evenodd');
  }
  ctx.globalAlpha = l.opacity;
  ctx.fillStyle = mode === 'mask' ? '#ffffff' : l.fill;
  if (l.kind === 'stroke' && l.points) {
    ctx.strokeStyle = l.fill; ctx.lineWidth = (l.brushRatio || .01) * Math.min(l.width, l.height); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(l.points[0] * l.width, l.points[1] * l.height);
    for (let i = 2; i < l.points.length; i += 2) ctx.lineTo(l.points[i] * l.width, l.points[i + 1] * l.height);
    ctx.stroke();
    if (l.points.every((v, i) => v === l.points![i % 2])) { ctx.beginPath(); ctx.arc(l.points[0] * l.width, l.points[1] * l.height, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); }
  }
  else if (l.kind === 'shape' && l.petalPose) drawFloatingPetal(ctx, l);
  else if (l.kind === 'frame') image ? drawFrameImage(ctx, l, image) : drawFrame(ctx, l);
  else if (l.kind === 'image' && image) {
    const filters = [
      `brightness(${l.brightness ?? 1})`,
      `contrast(${l.contrast ?? 1})`,
      `saturate(${l.saturation ?? 1})`,
      ...(l.blurMm ? [`blur(${l.blurMm * renderScale}px)`] : []),
    ];
    ctx.filter = filters.join(' ');
    // Keep blur and rounded corners inside the selected picture box.
    const cornerRadius = Math.max(0, Math.min(l.cornerRadiusMm ?? 0, l.width / 2, l.height / 2));
    ctx.beginPath(); ctx.roundRect(0, 0, l.width, l.height, cornerRadius); ctx.clip();
    const crop = imageCropRect(l, image);
    if (crop && l.cornerPosition) drawCornerImage(ctx, image, crop, l);
    else if (crop) ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, l.width, l.height);
    else ctx.drawImage(image, 0, 0, l.width, l.height);
    if (l.screenTear && !l.cornerPosition) {
      const source = image as CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
      const sourceWidth = Number(source.naturalWidth || source.width || 0);
      const sourceHeight = Number(source.naturalHeight || source.height || 0);
      const area = crop || { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
      if (area.width && area.height) for (const band of screenTearBands(l.id, l.width, l.height, l.screenTear)) {
        const sourceY = area.y + band.y / l.height * area.height;
        const sourceBandHeight = band.height / l.height * area.height;
        ctx.save();
        ctx.beginPath(); ctx.rect(0, band.y, l.width, band.height); ctx.clip();
        ctx.drawImage(image, area.x, sourceY, area.width, sourceBandHeight, band.offset, band.y, l.width, band.height);
        ctx.restore();
        ctx.save(); ctx.filter = 'none';
        ctx.globalAlpha = l.opacity * Math.min(.45, .12 + l.screenTear / 350);
        ctx.fillStyle = band.offset > 0 ? '#9be5e4' : '#ed9ba9';
        ctx.fillRect(0, band.y, l.width, Math.max(.12, Math.min(band.height * .08, .65)));
        ctx.restore();
      }
    }
  }
  else if (l.kind === 'text') {
    const size = l.fontSize || 10;
    const lineHeight = size * (l.lineHeight ?? 1.3), letterSpacing = l.letterSpacing ?? 0;
    const inset = l.quoteStyle ? quoteInsets(l.quoteStyle, l.width, l.height) : { left: 0, right: 0, top: 0, bottom: 0 };
    const textWidth = Math.max(.1, l.width - inset.left - inset.right);
    const textHeight = Math.max(.1, l.height - inset.top - inset.bottom);
    if (l.quoteStyle) drawQuoteFrame(ctx, l.quoteStyle, l.width, l.height);
    ctx.fillStyle = l.fill;
    ctx.font = textFont(l, size); ctx.textBaseline = 'top';
    ctx.beginPath(); ctx.rect(inset.left, inset.top, textWidth, textHeight); ctx.clip();
    const measure = (text: string) => ctx.measureText(text).width + Math.max(0, Array.from(text).length - 1) * letterSpacing;
    const drawLine = (text: string, y: number) => {
      const lineWidth = measure(text);
      let x = inset.left + (l.textAlign === 'center' ? (textWidth - lineWidth) / 2 : l.textAlign === 'right' ? textWidth - lineWidth : 0);
      const start = x;
      if (letterSpacing && text) {
        for (const char of Array.from(text)) { ctx.fillText(char, x, y); x += ctx.measureText(char).width + letterSpacing; }
      } else ctx.fillText(text, x, y);
      if (l.textDecoration === 'underline' && text) {
        ctx.save(); ctx.strokeStyle = mode === 'mask' ? '#ffffff' : l.fill; ctx.lineWidth = Math.max(.18, size * .06);
        ctx.beginPath(); ctx.moveTo(start, y + size * 1.08); ctx.lineTo(start + lineWidth, y + size * 1.08); ctx.stroke(); ctx.restore();
      }
    };
    const lines = wrapTextLines(l.text || '', textWidth, measure);
    let y = l.quoteStyle ? inset.top + Math.max(0, (textHeight - lines.length * lineHeight) / 2) : 0;
    for (const line of lines) { drawLine(line, y); y += lineHeight; }
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
  if (mode !== 'mask' && (mode === 'preview' || !d.material || t.presentation === 'photo-holder')) drawSubstrate(ctx, d, bleed ? fullW : w, bleed ? fullH : h, t.presentation === 'acrylic-badge' ? 0.035 : 0.16);
  ctx.translate(b, b);
  for (const l of d.layers.filter(l => (l.face || 'front') === (!d.printStack && d.duplex ? d.activeFace || 'front' : 'front'))) { ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rotation * Math.PI / 180); drawLayer(ctx, l, images.get(l.assetId || ''), mode, scale); ctx.restore(); }
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
  drawPhotoBorder(ctx, d, t, mode);
  if (slot) {
    ctx.save(); ctx.globalAlpha = 1;
    if (mode !== 'mask') ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.roundRect(slot.x, slot.y, slot.width, slot.height, slot.radius); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}
