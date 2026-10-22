import type { Asset } from '../shared/model';

export const staticDemo = import.meta.env.VITE_STATIC_DEMO === 'true';

export function publicUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

export function assetUrl(asset: Asset) {
  return asset.previewUrl || publicUrl(`api/assets/${asset.id}`);
}

export function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
