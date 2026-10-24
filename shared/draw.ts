import { drawFloatingPetal } from './petals';
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
export function drawPhotoBorder(ctx: CanvasRenderingContext2D, d: Design, t: Template, mode: RenderMode = 'preview') {
  const area = photoImageArea(d, t); if (!area) return;
  const { w, h } = dimensions(d, t);
  ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = mode === 'mask' ? '#000000' : '#ffffff';
  ctx.fillRect(0, 0, w, area.y); ctx.fillRect(0, area.y + area.height, w, h - area.y - area.height);
  ctx.fillRect(0, area.y, area.x, area.height); ctx.fillRect(area.x + area.width, area.y, w - area.x - area.width, area.height);
  ctx.restore();
}
import { getFont } from './fonts';
import { drawFrame } from './frame';
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
  else if (l.kind === 'frame') drawFrame(ctx, l);
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
    if (crop) ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, l.width, l.height);
    else ctx.drawImage(image, 0, 0, l.width, l.height);
  }
  else if (l.kind === 'text') {
    const size = l.fontSize || 10;
    const lineHeight = size * (l.lineHeight ?? 1.3), letterSpacing = l.letterSpacing ?? 0;
    ctx.font = textFont(l, size); ctx.textBaseline = 'top';
    ctx.beginPath(); ctx.rect(0, 0, l.width, l.height); ctx.clip();
    const measure = (text: string) => ctx.measureText(text).width + Math.max(0, Array.from(text).length - 1) * letterSpacing;
    const drawLine = (text: string, y: number) => {
      const lineWidth = measure(text);
      let x = l.textAlign === 'center' ? (l.width - lineWidth) / 2 : l.textAlign === 'right' ? l.width - lineWidth : 0;
      if (letterSpacing && text) {
        for (const char of Array.from(text)) { ctx.fillText(char, x, y); x += ctx.measureText(char).width + letterSpacing; }
      } else ctx.fillText(text, x, y);
      if (l.textDecoration === 'underline' && text) {
        const start = l.textAlign === 'center' ? (l.width - lineWidth) / 2 : l.textAlign === 'right' ? l.width - lineWidth : 0;
        ctx.save(); ctx.strokeStyle = mode === 'mask' ? '#ffffff' : l.fill; ctx.lineWidth = Math.max(.18, size * .06);
        ctx.beginPath(); ctx.moveTo(start, y + size * 1.08); ctx.lineTo(start + lineWidth, y + size * 1.08); ctx.stroke(); ctx.restore();
      }
    };
    let y = 0;
    for (const line of wrapTextLines(l.text || '', l.width, measure)) { drawLine(line, y); y += lineHeight; }
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
