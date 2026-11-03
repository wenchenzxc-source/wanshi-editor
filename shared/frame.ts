import type { DesignLayer } from './model';
// Borders follow the page; corner ornaments retain their proportions.
export function drawFrame(ctx: CanvasRenderingContext2D, l: DesignLayer) {
  const { width: w, height: h } = l;
  const short = Math.min(w, h), inset = Math.max(.7, short * .014), corner = short * .29;
  ctx.save(); ctx.strokeStyle = l.frameId === 'halloween-frame' ? '#83778f' : l.frameId === 'starlight-frame' ? '#bda56d' : '#b9969e';
  ctx.lineWidth = Math.max(.25, short * .004);
  ctx.beginPath(); ctx.roundRect(inset, inset, w - 2 * inset, h - 2 * inset, short * .025); ctx.stroke();
  const ornament = () => {
    if (l.frameId === 'halloween-frame') {
      ctx.lineWidth = Math.max(.18, short * .002); ctx.strokeStyle = '#a6a0b2';
      for (let i = 0; i < 5; i++) { const a = i * Math.PI / 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * corner, Math.sin(a) * corner); ctx.stroke(); }
      for (let r = corner / 4; r <= corner; r += corner / 4) { ctx.beginPath(); ctx.moveTo(r, 0); for (let i = 1; i <= 4; i++) { const a = i * Math.PI / 8, mid = a - Math.PI / 16; ctx.quadraticCurveTo(Math.cos(mid) * r * .8, Math.sin(mid) * r * .8, Math.cos(a) * r, Math.sin(a) * r); } ctx.stroke(); }
    } else if (l.frameId === 'starlight-frame') {
      ctx.fillStyle = '#e0c995'; const r = short * .04; ctx.translate(r, r); ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * .1, -r * .1, r, 0); ctx.quadraticCurveTo(r * .1, r * .1, 0, r); ctx.quadraticCurveTo(-r * .1, r * .1, -r, 0); ctx.quadraticCurveTo(-r * .1, -r * .1, 0, -r); ctx.fill();
    } else {
      ctx.strokeStyle = '#8b9b88'; ctx.lineWidth = short * .0025; ctx.beginPath(); ctx.moveTo(0, corner); ctx.quadraticCurveTo(corner * .08, corner * .1, corner, 0); ctx.stroke();
      for (let i = 1; i < 5; i++) { ctx.save(); ctx.translate(corner * i / 6, corner * (5 - i) / 8); ctx.rotate(-.65); ctx.fillStyle = i % 2 ? '#dfc0c4' : '#b4c0a7'; ctx.beginPath(); ctx.ellipse(0, 0, corner * .045, corner * .13, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    }
  };
  ctx.save(); ctx.translate(inset, inset); ornament(); ctx.restore();
  ctx.save(); ctx.translate(w - inset, h - inset); ctx.rotate(Math.PI); ornament(); ctx.restore();
  ctx.restore();
}

// Generated frame art is rendered as a fixed-width straight-line underlay plus
// four proportional corners. Only the length of a straight edge changes with
// the page; its cross-axis scale (and therefore line weight) stays constant.
export function drawFrameImage(ctx: CanvasRenderingContext2D, l: DesignLayer, image: CanvasImageSource) {
  const source = image as CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const sw = Number(source.naturalWidth || source.width || 0), sh = Number(source.naturalHeight || source.height || 0);
  if (!sw || !sh) return;
  // The painted ornaments extend well beyond the former 31% cut. A 46% corner
  // crop keeps the complete floral cluster; the edge itself is sampled from a
  // narrow, clean section of the source so no leaf or flower is stretched.
  const sx = sw * .46, sy = sh * .46;
  const short = Math.min(l.width, l.height);
  // A narrow source strip determines the physical stroke weight. Extending
  // the side changes only strip length, never this cross-axis thickness.
  const edgeThickness = short * .004;
  const maxCorner = short * .48;
  const size = (scale = 1) => Math.min(maxCorner, short * .38 * scale);
  const tl = size(l.frameTopLeftScale), tr = size(l.frameTopRightScale), br = size(l.frameBottomRightScale), bl = size(l.frameBottomLeftScale);
  const draw = (sourceX: number, sourceY: number, sourceW: number, sourceH: number, x: number, y: number, width: number, height: number) => {
    if (width > 0 && height > 0) ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, x, y, width, height);
  };

  // Each source needs a clean sample between its corner ornament and any
  // centre medallion. Sampling only 0.4% avoids stretching decorative objects.
  // The source lines sit inside the transparent PNG, not on its outer edge.
  // Positions were measured from the clean straight sections of each asset.
  const samples: Record<string, { x: number; y: number; top: number; bottom: number; left: number; right: number }> = {
    'christmas-pine-frame': { x: .40, y: .42, top: 85 / 1254, bottom: 84 / 1254, left: 61 / 1254, right: 59 / 1254 },
    'lunar-plum-frame': { x: .48, y: .48, top: 70 / 1254, bottom: 72 / 1254, left: 45 / 1254, right: 47 / 1254 },
    'valentine-rose-frame': { x: .50, y: .48, top: 89 / 1254, bottom: 83 / 1254, left: 53 / 1254, right: 52 / 1254 },
    'midautumn-osmanthus-frame': { x: .50, y: .48, top: 133 / 1254, bottom: 115 / 1254, left: 80 / 1254, right: 79 / 1254 },
  };
  const sample = samples[l.frameId || ''] || { x: .50, y: .50, top: .08, bottom: .08, left: .08, right: .08 };
  const stripW = Math.max(2, sw * .004), stripH = Math.max(2, sh * .004);
  const sampleX = Math.max(0, Math.min(sw - stripW, sw * sample.x - stripW / 2));
  const sampleY = Math.max(0, Math.min(sh - stripH, sh * sample.y - stripH / 2));

  const topSource = sample.top * sh, bottomSource = sh - sample.bottom * sh - stripH;
  const leftSource = sample.left * sw, rightSource = sw - sample.right * sw - stripW;
  const topEdge = size() * sample.top / .46, bottomEdge = l.height - size() * sample.bottom / .46 - edgeThickness;
  const leftEdge = size() * sample.left / .46, rightEdge = l.width - size() * sample.right / .46 - edgeThickness;
  // Full-length strips sit beneath the corners at the same inset as the
  // source artwork, so no isolated line appears at the page edge.
  draw(sampleX, topSource, stripW, stripH, 0, topEdge, l.width, edgeThickness);
  draw(sampleX, bottomSource, stripW, stripH, 0, bottomEdge, l.width, edgeThickness);
  draw(leftSource, sampleY, stripW, stripH, leftEdge, 0, edgeThickness, l.height);
  draw(rightSource, sampleY, stripW, stripH, rightEdge, 0, edgeThickness, l.height);

  // Keep any star, bead or small flower at the centre of each side as a
  // fixed-size overlay. It is never included in the stretched line sample.
  const centreSourceW = sw * .12, centreSourceH = sh * .12;
  const centreW = edgeThickness * centreSourceW / stripH, centreH = edgeThickness * centreSourceH / stripW;
  draw((sw - centreSourceW) / 2, topSource, centreSourceW, stripH, (l.width - centreW) / 2, topEdge, centreW, edgeThickness);
  draw((sw - centreSourceW) / 2, bottomSource, centreSourceW, stripH, (l.width - centreW) / 2, bottomEdge, centreW, edgeThickness);
  draw(leftSource, (sh - centreSourceH) / 2, stripW, centreSourceH, leftEdge, (l.height - centreH) / 2, edgeThickness, centreH);
  draw(rightSource, (sh - centreSourceH) / 2, stripW, centreSourceH, rightEdge, (l.height - centreH) / 2, edgeThickness, centreH);

  draw(0, 0, sx, sy, 0, 0, tl, tl);
  draw(sw - sx, 0, sx, sy, l.width - tr, 0, tr, tr);
  draw(sw - sx, sh - sy, sx, sy, l.width - br, l.height - br, br, br);
  draw(0, sh - sy, sx, sy, 0, l.height - bl, bl, bl);
}
