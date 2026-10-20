import { z } from 'zod';
import { fontIds } from './fonts';

const color = z.string().regex(/^#[0-9a-f]{6}$/i);
export const materials = { clear: { name: '透明壓克力', color: '#ecf4f5' }, black: { name: '黑', color: '#171b1d' }, white: { name: '白', color: '#ffffff' }, iridescent: { name: '炫彩', color: '#d4e8f0' }, gold: { name: '金', color: '#c9a653' }, silver: { name: '銀', color: '#c1c7cd' }, roseGold: { name: '玫瑰金', color: '#d5a092' } };
export type Material = keyof typeof materials;
export const supportsDuplex = (material?: Material) => material === 'clear' || material === 'iridescent';
export const layerSchema = z.object({
  id: z.string().uuid(), name: z.string().max(160), kind: z.enum(['image', 'text', 'shape', 'uv']),
  x: z.number().min(-1000).max(1000), y: z.number().min(-1000).max(1000),
  width: z.number().min(0.1).max(1000), height: z.number().min(0.1).max(1000),
  rotation: z.number().min(-36000).max(36000), opacity: z.number().min(0).max(1),
  visible: z.boolean(), locked: z.boolean(), fill: color,
  assetId: z.string().uuid().optional(), text: z.string().max(2000).optional(),
  face: z.enum(['front', 'back']).optional(),
  fontSize: z.number().min(1).max(200).optional(),
  fontId: z.enum(fontIds).optional(),
  shape: z.enum(['petal', 'star', 'circle', 'rect']).optional(),
}).superRefine((l, ctx) => {
  if (l.kind === 'image' && !l.assetId) ctx.addIssue({ code: 'custom', message: '圖片缺少素材 ID' });
});
export const designSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().uuid(), name: z.string().min(1).max(160),
  templateId: z.string().max(80), orientation: z.enum(['portrait', 'landscape']),
  sizeId: z.string().max(80).optional(),
  customSize: z.object({ widthMm: z.number().min(20).max(250).multipleOf(5), heightMm: z.number().min(20).max(250).multipleOf(5), thicknessMm: z.number().min(5).max(50).multipleOf(5) }).optional(),
  background: color, backgroundOpacity: z.number().min(0).max(1),
  material: z.enum(['clear', 'black', 'white', 'iridescent', 'gold', 'silver', 'roseGold']).optional(),
  duplex: z.boolean().optional(), activeFace: z.enum(['front', 'back']).optional(),
  printView: z.enum(['direct', 'acrylic']).optional(),
  printStack: z.enum(['cmyk-white', 'white-cmyk', 'cmyk-white-cmyk']).optional(),
  layers: z.array(layerSchema).max(150),
  wooCommerceProductId: z.number().int().positive().nullable(),
  orderItemId: z.string().max(100).nullable(),
}).superRefine((d, ctx) => {
  if (d.sizeId === 'custom' && d.customSize && d.customSize.thicknessMm > Math.min(d.customSize.widthMm, d.customSize.heightMm)) ctx.addIssue({ code: 'custom', path: ['customSize', 'thicknessMm'], message: '厚度不可超過長與高的較小值' });
  if (d.sizeId === 'custom' && !d.customSize) ctx.addIssue({ code: 'custom', message: '請輸入自訂長寬厚' });
  if (d.printStack && (d.duplex !== (d.printStack === 'cmyk-white-cmyk') || d.activeFace === 'back')) ctx.addIssue({ code: 'custom', message: '油墨堆疊使用同一份圖稿，面數設定不一致' });
  if (d.duplex && !supportsDuplex(d.material)) ctx.addIssue({ code: 'custom', message: '只有透明壓克力與炫彩支援雙面' });
  if (!d.duplex && d.activeFace === 'back') ctx.addIssue({ code: 'custom', message: '單面商品不可選擇背面' });
  if (new Set(d.layers.map(l => l.id)).size !== d.layers.length) ctx.addIssue({ code: 'custom', message: '圖層 ID 重複' });
});
export type Design = z.infer<typeof designSchema>;
export function withPrintStack(d: Design, stack: NonNullable<Design['printStack']>): Design {
  return { ...d, printStack: stack, duplex: stack === 'cmyk-white-cmyk', activeFace: 'front', printView: stack === 'cmyk-white' ? 'acrylic' : 'direct' };
}
export function stackLabel(d: Design) { return d.printStack === 'cmyk-white-cmyk' ? 'CMYK → 白 → CMYK' : d.printStack === 'cmyk-white' ? 'CMYK → 白' : '白 → CMYK'; }
export type DesignLayer = z.infer<typeof layerSchema>;
export type Zone = { x: number; y: number; width: number; height: number; label: string };
export type Template = {
  id: string; name: string; version: number; widthMm: number; heightMm: number;
  bleedMm: number; safeMm: number; dpi: number; noProcess: Zone[];
  presentation?: 'plaque' | 'acrylic-block';
  allowedMaterials?: Material[];
  allowCustomSize?: boolean; thicknessMm?: number;
  sizes?: { id: string; name: string; widthMm: number; heightMm: number; thicknessMm?: number; retired?: boolean }[];
};
export function resolveTemplate(d: Pick<Design, 'sizeId' | 'customSize'>, t: Template): Template {
  if (t.allowCustomSize && d.sizeId === 'custom' && d.customSize) return { ...t, ...d.customSize };
  const size = t.sizes?.find(s => s.id === d.sizeId) || t.sizes?.[0];
  return size ? { ...t, widthMm: size.widthMm, heightMm: size.heightMm, thicknessMm: size.thicknessMm } : t;
}
export type Asset = { deletedAt?: string; id: string; designId: string; originalName: string; mime: string; width: number; height: number; sha256: string; sourceAssetId?: string; variant: 'original' | 'cutout' };
export type VersionInfo = { id: string; createdAt: string; revision: number; orderItemId: string | null };
export const templates: Template[] = [{ id: 'a5-plaque-v1', name: 'A5 飾牌', version: 1, widthMm: 148, heightMm: 210, bleedMm: 3, safeMm: 5, dpi: 300, noProcess: [] }, { id: 'acrylic-block-v1', name: '壓克力磚', version: 3, allowCustomSize: true, presentation: 'acrylic-block', widthMm: 100, heightMm: 100, bleedMm: 0, safeMm: 1, dpi: 300, noProcess: [], allowedMaterials: ['clear'], sizes: [
  { id: 'mini-friend', name: '迷你飯友 · 30 × 20 × 5 mm', widthMm: 20, heightMm: 30, thicknessMm: 5 },
  { id: 'friend', name: '飯友 · 50 × 30 × 10 mm', widthMm: 30, heightMm: 50, thicknessMm: 10 },
  { id: 'small-block', name: '小立磚 · 100 × 60 × 20 mm', widthMm: 60, heightMm: 100, thicknessMm: 20 },
  { id: '100x100', retired: true, name: '100 × 100 mm', widthMm: 100, heightMm: 100 },
  { id: '100x150', retired: true, name: '100 × 150 mm', widthMm: 100, heightMm: 150 },
  { id: '150x200', retired: true, name: '150 × 200 mm', widthMm: 150, heightMm: 200 },
] }];
export function dimensions(d: Pick<Design, 'orientation' | 'sizeId' | 'customSize'>, t: Template) {
  t = resolveTemplate(d, t);
  const w = d.orientation === 'portrait' ? t.widthMm : t.heightMm;
  const h = d.orientation === 'portrait' ? t.heightMm : t.widthMm;
  return { w, h, fullW: w + 2 * t.bleedMm, fullH: h + 2 * t.bleedMm };
}
export function zones(d: Design, t: Template): Zone[] {
  t = resolveTemplate(d, t);
  return t.noProcess.map(z => d.orientation === 'portrait' ? z : { ...z, x: t.heightMm - z.y - z.height, y: z.x, width: z.height, height: z.width });
}
export function emptyDesign(template = templates[0]): Design {
  return { schemaVersion: 1, id: crypto.randomUUID(), name: `我的 ${template.name}`, templateId: template.id, ...(template.sizes?.length ? { sizeId: template.sizes[0].id } : {}), orientation: 'portrait', material: template.allowedMaterials?.[0] || 'white', printStack: 'white-cmyk', duplex: false, activeFace: 'front', printView: 'direct', background: '#faf6ef', backgroundOpacity: 1, layers: [], wooCommerceProductId: null, orderItemId: null };
}
export function newLayer(kind: DesignLayer['kind'], patch: Partial<DesignLayer> = {}): DesignLayer {
  return { id: crypto.randomUUID(), name: kind === 'text' ? '文字' : kind === 'uv' ? 'UV 微浮雕' : '裝飾', kind, x: 30, y: 40, width: 50, height: 50, rotation: 0, opacity: 1, visible: true, locked: false, fill: '#b89571', shape: 'petal', ...patch };
}

