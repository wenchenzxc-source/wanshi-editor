import { newLayer, type DesignLayer } from './model';
const poses = ['open', 'tilted', 'edge', 'curled'] as const;
/** Randomness is resolved only on insertion; saved layers render deterministically. */
export function scatterPetals(cx: number, cy: number, spreadW: number, spreadH: number, size: number, count: number, flower: 'sakura' | 'rose', opacity: number, pageW = spreadW, pageH = spreadH, random = Math.random): DesignLayer[] {
  return Array.from({ length: count }, (_, i) => {
    const width = Math.min(pageW * .7, size * (.55 + random() * .85)), height = Math.min(pageH * .7, width * (.85 + random() * .35));
    const rotation = random() * 360, a = rotation * Math.PI / 180;
    const radius = Math.hypot(width, height) / 2;
    const centerX = Math.max(radius, Math.min(pageW - radius, cx + (random() - .5) * spreadW));
    const centerY = Math.max(radius, Math.min(pageH - radius, cy + (random() - .5) * spreadH));
    return newLayer('shape', { name: flower === 'sakura' ? '飄落櫻花瓣' : '飄落玫瑰花瓣', shape: 'petal', flowerType: flower,
      petalPose: poses[(i + Math.floor(random() * poses.length)) % poses.length], width, height, rotation,
      x: centerX - width / 2 * Math.cos(a) + height / 2 * Math.sin(a), y: centerY - width / 2 * Math.sin(a) - height / 2 * Math.cos(a),
      fill: flower === 'sakura' ? '#e8acbc' : '#bd748d', opacity: opacity * (.65 + random() * .35) });
  });
}
/** Soft botanical illustration in normalized coordinates, with four distinct silhouettes. */
export function drawFloatingPetal(ctx: CanvasRenderingContext2D, l: DesignLayer) {
  ctx.save(); ctx.scale(l.width, l.height);
  const rose = l.flowerType === 'rose';
  const gradient = ctx.createLinearGradient(.2, 0, .75, 1);
  gradient.addColorStop(0, rose ? '#f2ced5' : '#fff0f0'); gradient.addColorStop(.55, l.fill); gradient.addColorStop(1, rose ? '#995770' : '#cf869e');
  ctx.fillStyle = gradient; ctx.beginPath();
  if (l.petalPose === 'edge') {
    ctx.moveTo(.18,.12); ctx.bezierCurveTo(.78,.22,.92,.73,.32,.95); ctx.bezierCurveTo(.66,.57,.43,.36,.18,.12);
  } else if (l.petalPose === 'curled') {
    ctx.moveTo(.48,.94); ctx.bezierCurveTo(-.08,.65,.04,.1,.5,.12); ctx.bezierCurveTo(.96,-.04,1,.48,.62,.53); ctx.bezierCurveTo(.9,.72,.68,.88,.48,.94);
  } else if (l.petalPose === 'tilted') {
    ctx.moveTo(.22,.9); ctx.bezierCurveTo(-.04,.45,.3,.08,.84,.16); ctx.bezierCurveTo(.98,.5,.6,.85,.22,.9);
  } else {
    ctx.moveTo(.5,.95); ctx.bezierCurveTo(-.04,.7,-.04,.09,.35,.08);
    if (!rose) { ctx.quadraticCurveTo(.45,.08,.5,.19); ctx.quadraticCurveTo(.58,.05,.68,.09); }
    else ctx.bezierCurveTo(.55,.03,.66,.12,.72,.08);
    ctx.bezierCurveTo(1.08,.18,.98,.7,.5,.95);
  }
  ctx.closePath(); ctx.fill();
  // Restrained fold highlight rather than photographic veins.
  ctx.beginPath(); ctx.strokeStyle = rose ? '#fff0eb88' : '#ffffff99'; ctx.lineWidth = .014;
  if (l.petalPose === 'curled') { ctx.moveTo(.12,.31); ctx.bezierCurveTo(.33,.08,.7,.62,.86,.35); }
  else if (l.petalPose === 'edge') { ctx.moveTo(.2,.14); ctx.quadraticCurveTo(.76,.55,.34,.92); }
  else { ctx.moveTo(.5,.87); ctx.quadraticCurveTo(.35,.56,.47,.32); }
  ctx.stroke(); ctx.restore();
}
