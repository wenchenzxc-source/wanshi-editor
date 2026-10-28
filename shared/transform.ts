import type { DesignLayer } from './model';

export type CanvasSize = { w: number; h: number };

export function validLayerSize(width: number, height: number) {
  return Number.isFinite(width) && Number.isFinite(height) && width >= 0.1 && height >= 0.1 && width <= 1000 && height <= 1000;
}

// Missing settings in older designs use the same locked default as new layers.
export function resizeLayerDimension(layer: DesignLayer, axis: 'width' | 'height', value: number, shiftKey = false): Pick<DesignLayer, 'width' | 'height'> {
  const { width, height } = layer;
  if (!Number.isFinite(value)) return { width, height };
  if (layer.aspectRatioLocked === false || shiftKey) return { width, height, [axis]: Math.max(0.1, Math.min(1000, value)) };
  const factor = Math.max(Math.max(0.1 / width, 0.1 / height), Math.min(value / layer[axis], Math.min(1000 / width, 1000 / height)));
  // Floating point multiplication can otherwise land just outside schema bounds.
  const clamp = (size: number) => Math.max(0.1, Math.min(1000, size));
  return { width: clamp(width * factor), height: clamp(height * factor) };
}

export function scaleLayerAtPoint(layer: DesignLayer, factor: number, point: { x: number; y: number }): DesignLayer {
  if (!Number.isFinite(factor) || factor <= 0) return layer;
  const minFactor = Math.max(0.1 / layer.width, 0.1 / layer.height), maxFactor = Math.min(1000 / layer.width, 1000 / layer.height);
  factor = Math.max(minFactor, Math.min(maxFactor, factor));
  const angle = layer.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = point.x - layer.x, dy = point.y - layer.y;
  const localX = dx * cos + dy * sin, localY = -dx * sin + dy * cos;
  return {
    ...layer,
    x: point.x - (localX * factor * cos - localY * factor * sin),
    y: point.y - (localX * factor * sin + localY * factor * cos),
    width: layer.width * factor,
    height: layer.height * factor,
  };
}

export function remapImagesToCanvas(layers: DesignLayer[], from: CanvasSize, to: CanvasSize, safeMm = 0): DesignLayer[] {
  if (!(from.w > 0 && from.h > 0 && to.w > 0 && to.h > 0)) return layers;
  const canvasFactor = Math.min(to.w / from.w, to.h / from.h), availableW = Math.max(0.1, to.w - safeMm * 2), availableH = Math.max(0.1, to.h - safeMm * 2);
  return layers.map(layer => {
    if (layer.kind !== 'image') return layer;
    const centerX = (layer.x + layer.width / 2) / from.w, centerY = (layer.y + layer.height / 2) / from.h;
    const fitFactor = Math.min(1, availableW / (layer.width * canvasFactor), availableH / (layer.height * canvasFactor));
    const factor = canvasFactor * fitFactor, width = layer.width * factor, height = layer.height * factor;
    return {
      ...layer,
      width,
      height,
      x: Math.max(safeMm, Math.min(to.w - safeMm - width, centerX * to.w - width / 2)),
      y: Math.max(safeMm, Math.min(to.h - safeMm - height, centerY * to.h - height / 2)),
    };
  });
}
