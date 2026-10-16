import { z } from 'zod';

const color = z.string().regex(/^#[0-9a-f]{6}$/i);
export const layerSchema = z.object({
  id: z.string().uuid(), name: z.string().max(160), kind: z.enum(['image', 'text', 'shape', 'uv']),
  x: z.number().min(-1000).max(1000), y: z.number().min(-1000).max(1000),
  width: z.number().min(0.1).max(1000), height: z.number().min(0.1).max(1000),
  rotation: z.number().min(-36000).max(36000), opacity: z.number().min(0).max(1),
  visible: z.boolean(), locked: z.boolean(), fill: color,
  assetId: z.string().uuid().optional(), text: z.string().max(2000).optional(),
  fontSize: z.number().min(1).max(200).optional(),
  shape: z.enum(['petal', 'star', 'circle', 'rect']).optional(),
}).superRefine((l, ctx) => {
  if (l.kind === 'image' && !l.assetId) ctx.addIssue({ code: 'custom', message: '圖片缺少素材 ID' });
});
export const designSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().uuid(), name: z.string().min(1).max(160),
  templateId: z.string().max(80), orientation: z.enum(['portrait', 'landscape']),
  background: color, backgroundOpacity: z.number().min(0).max(1),
  layers: z.array(layerSchema).max(150),
  wooCommerceProductId: z.number().int().positive().nullable(),
  orderItemId: z.string().max(100).nullable(),
}).superRefine((d, ctx) => {
  if (new Set(d.layers.map(l => l.id)).size !== d.layers.length) ctx.addIssue({ code: 'custom', message: '圖層 ID 重複' });
});
export type Design = z.infer<typeof designSchema>;
export type DesignLayer = z.infer<typeof layerSchema>;
export type Zone = { x: number; y: number; width: number; height: number; label: string };
export type Template = {
  id: string; name: string; version: number; widthMm: number; heightMm: number;
  bleedMm: number; safeMm: number; dpi: number; noProcess: Zone[];
};
export type Asset = { id: string; designId: string; originalName: string; mime: string; width: number; height: number; sha256: string; sourceAssetId?: string; variant: 'original' | 'cutout' };
export type VersionInfo = { id: string; createdAt: string; revision: number; orderItemId: string | null };
export const templates: Template[] = [{ id: 'a5-plaque-v1', name: 'A5 飾牌', version: 1, widthMm: 148, heightMm: 210, bleedMm: 3, safeMm: 5, dpi: 300, noProcess: [] }];
export function dimensions(d: Pick<Design, 'orientation'>, t: Template) {
  const w = d.orientation === 'portrait' ? t.widthMm : t.heightMm;
  const h = d.orientation === 'portrait' ? t.heightMm : t.widthMm;
  return { w, h, fullW: w + 2 * t.bleedMm, fullH: h + 2 * t.bleedMm };
}
export function zones(d: Design, t: Template): Zone[] {
  return t.noProcess.map(z => d.orientation === 'portrait' ? z : { ...z, x: t.heightMm - z.y - z.height, y: z.x, width: z.height, height: z.width });
}
export function emptyDesign(template = templates[0]): Design {
  return { schemaVersion: 1, id: crypto.randomUUID(), name: `我的 ${template.name}`, templateId: template.id, orientation: 'portrait', background: '#faf6ef', backgroundOpacity: 1, layers: [], wooCommerceProductId: null, orderItemId: null };
}
export function newLayer(kind: DesignLayer['kind'], patch: Partial<DesignLayer> = {}): DesignLayer {
  return { id: crypto.randomUUID(), name: kind === 'text' ? '文字' : kind === 'uv' ? 'UV 微浮雕' : '裝飾', kind, x: 30, y: 40, width: 50, height: 50, rotation: 0, opacity: 1, visible: true, locked: false, fill: '#b89571', shape: 'petal', ...patch };
}
