import type { Asset, Design, DesignLayer } from './model';

/** Raster artwork output resolution. Printer device DPI is a different measurement. */
export const PRINT_OUTPUT_PPI = 600;
export const MIN_IMAGE_PPI = 300;
export const TARGET_PRINTER_DPI = 1440;

export function effectiveImagePpi(layer: Pick<DesignLayer, 'kind' | 'width' | 'height' | 'cropWidth' | 'cropHeight'>, asset: Pick<Asset, 'width' | 'height'>) {
  if (layer.kind !== 'image' || layer.width <= 0 || layer.height <= 0 || asset.width <= 0 || asset.height <= 0) return 0;
  const horizontal = asset.width * (layer.cropWidth ?? 1) / (layer.width / 25.4);
  const vertical = asset.height * (layer.cropHeight ?? 1) / (layer.height / 25.4);
  return Math.floor(Math.min(horizontal, vertical));
}

export type ImageQualityIssue = { layerId: string; name: string; ppi: number };

export function imageQualityIssues(design: Pick<Design, 'layers'>, assets: readonly Asset[], minimum = MIN_IMAGE_PPI): ImageQualityIssue[] {
  const byId = new Map(assets.map(asset => [asset.id, asset]));
  return design.layers.flatMap(layer => {
    if (layer.kind !== 'image' || !layer.visible || layer.opacity <= 0 || !layer.assetId) return [];
    const asset = byId.get(layer.assetId);
    if (!asset) return [];
    const ppi = effectiveImagePpi(layer, asset);
    return ppi < minimum ? [{ layerId: layer.id, name: layer.name, ppi }] : [];
  });
}
