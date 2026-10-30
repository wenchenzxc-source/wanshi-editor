import { newLayer, type DesignLayer } from './model';

type ScatterOptions = {
  x: number; y: number; spreadW: number; spreadH: number;
  size: number; count: number; pageW: number; pageH: number;
  opacity: number; assetId: string; name: string; random?: () => number;
};

/** Resolve variation when painting, so previews, saved drafts and exports stay identical. */
export function scatterSparkles({ x, y, spreadW, spreadH, size, count, pageW, pageH, opacity, assetId, name, random = Math.random }: ScatterOptions): DesignLayer[] {
  const pageMin = Math.min(pageW, pageH);
  return Array.from({ length: Math.max(0, count) }, () => {
    const edge = Math.max(.1, Math.min(pageMin * .48, size * (.5 + random() * .95)));
    const rotation = random() * 360;
    const angle = rotation * Math.PI / 180;
    const radius = Math.min(pageMin / 2, edge * Math.SQRT2 / 2);
    const centerX = Math.max(radius, Math.min(pageW - radius, x + (random() - .5) * spreadW));
    const centerY = Math.max(radius, Math.min(pageH - radius, y + (random() - .5) * spreadH));
    return newLayer('image', {
      name, assetId, x: centerX - edge / 2 * Math.cos(angle) + edge / 2 * Math.sin(angle),
      y: centerY - edge / 2 * Math.sin(angle) - edge / 2 * Math.cos(angle),
      width: edge, height: edge, rotation, aspectRatioLocked: true,
      opacity: opacity * (.55 + random() * .45),
    });
  });
}
