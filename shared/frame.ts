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
