import type { DesignLayer } from './model';

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
