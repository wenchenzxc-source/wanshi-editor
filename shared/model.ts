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
  badgeAccessory: z.enum(['webbing', 'ball-chain', 'keyring', 'lanyard', 'leather', 'original', 'custom', 'none']).optional(),
  badgeCornerRadiusMm: z.union([z.literal(3), z.literal(4)]).optional(),
  photoHolder: z.object({ base: z.boolean(), nfc: z.boolean(), photoService: z.enum(['own', 'print']), paperLayout: z.enum(['full', 'border']).optional() }).optional(),
  slot: z.object({ position: z.enum(['left', 'center', 'right']).optional(), shape: z.enum(['slot', 'circle']).optional(), enabled: z.boolean(), widthMm: z.number().int().min(1).max(250), heightMm: z.number().int().min(1).max(250) }).optional(),
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
  if (d.slot?.enabled && d.slot.shape === 'circle' && d.slot.widthMm !== d.slot.heightMm) ctx.addIssue({ code: 'custom', message: '圓孔的長寬必須相同' });
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
  bleedMm: number; safeMm: number; cornerRadiusMm?: number; dpi: number; noProcess: Zone[];
  presentation?: 'plaque' | 'acrylic-block' | 'acrylic-badge' | 'photo-holder';
  allowedMaterials?: Material[];
  allowCustomSize?: boolean; thicknessMm?: number;
  sizes?: { id: string; name: string; widthMm: number; heightMm: number; thicknessMm?: number; retired?: boolean }[];
};
export function resolveTemplate(d: Pick<Design, 'sizeId' | 'customSize'>, t: Template): Template {
  if (t.allowCustomSize && d.sizeId === 'custom' && d.customSize) return { ...t, ...d.customSize };
  const size = t.sizes?.find(s => s.id === d.sizeId) || t.sizes?.[0];
  return size ? { ...t, widthMm: size.widthMm, heightMm: size.heightMm, thicknessMm: size.thicknessMm ?? t.thicknessMm } : t;
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
] }, { id: 'acrylic-badge-v1', name: '壓克力識別牌', version: 3, cornerRadiusMm: 3, thicknessMm: 3, presentation: 'acrylic-badge', widthMm: 50, heightMm: 90, bleedMm: 0, safeMm: 1, dpi: 300, noProcess: [], sizes: [
  { id: '50x90', name: '名片型', widthMm: 50, heightMm: 90 },
  { id: '60x90', name: '加寬型', widthMm: 60, heightMm: 90 },
  { id: '80x80', name: '方形', widthMm: 80, heightMm: 80 },
] }, { id: 'photo-holder-v1', name: '照片立／掛牌', version: 1, presentation: 'photo-holder', widthMm: 50, heightMm: 76, bleedMm: 0, safeMm: 0, dpi: 300, noProcess: [], allowedMaterials: ['white'], sizes: [
  { id: 'small-photo', name: '小相紙', widthMm: 50, heightMm: 76 },
  { id: 'instax-mini', name: '拍立得 mini', widthMm: 54, heightMm: 86 },
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
  return { schemaVersion: 1, id: crypto.randomUUID(), name: `我的 ${template.name}`, templateId: template.id, ...(template.sizes?.length ? { sizeId: template.sizes[0].id } : {}), orientation: 'portrait', ...(template.presentation === 'photo-holder' ? { photoHolder: { base: false, nfc: false, photoService: 'own' as const } } : {}), material: template.allowedMaterials?.[0] || 'white', printStack: 'white-cmyk', duplex: false, activeFace: 'front', printView: 'direct', background: '#faf6ef', backgroundOpacity: 1, layers: [], wooCommerceProductId: null, orderItemId: null };
}
export function newLayer(kind: DesignLayer['kind'], patch: Partial<DesignLayer> = {}): DesignLayer {
  return { id: crypto.randomUUID(), name: kind === 'text' ? '文字' : kind === 'uv' ? 'UV 微浮雕' : '裝飾', kind, x: 30, y: 40, width: 50, height: 50, rotation: 0, opacity: 1, visible: true, locked: false, fill: '#b89571', shape: 'petal', ...patch };
}


// Slot is defined in the currently displayed orientation, so it always stays at the top.
export function slotGeometry(d: Design, t: Template) {
  if (t.presentation !== 'acrylic-badge' || !d.slot?.enabled) return null;
  const { w } = dimensions(d, t);
  const position = d.slot.shape === 'circle' ? d.slot.position || 'center' : 'center';
  const x = position === 'left' ? 5 : position === 'right' ? w - 5 - d.slot.widthMm : (w - d.slot.widthMm) / 2;
  return { x, y: 5, width: d.slot.widthMm, height: d.slot.heightMm, radius: d.slot.shape === 'circle' ? d.slot.widthMm / 2 : Math.min(1, d.slot.widthMm / 2, d.slot.heightMm / 2) };
}

export const badgeAccessories = [
  { id: 'webbing', name: '織帶扣', widthMm: 34, heightMm: 4, shape: 'slot', image: 'webbing.png' },
  { id: 'ball-chain', name: '珠鍊', widthMm: 3, heightMm: 3, shape: 'circle', image: 'ball-chain.png' },
  { id: 'keyring', name: '鑰匙圈', widthMm: 3, heightMm: 3, shape: 'circle', image: 'keyring.png' },
  { id: 'lanyard', name: '識別證掛繩', widthMm: 15, heightMm: 3, shape: 'slot', image: 'lanyard.png' },
  { id: 'leather', name: '皮繩掛扣', widthMm: 5, heightMm: 5, shape: 'circle', image: 'leather.png' },
  { id: 'original', name: '原款掛扣', widthMm: 5, heightMm: 5, shape: 'circle', image: '' },
] as const;
export function badgeRadius(d: Design, t: Template) { return t.presentation === 'acrylic-badge' ? d.badgeCornerRadiusMm ?? t.cornerRadiusMm ?? 0 : 0; }

// Paper-local image window; landscape rotates the whole paper clockwise.
export function photoImageArea(d: Design, t: Template) {
  if (t.presentation !== 'photo-holder') return null;
  const paper = resolveTemplate(d, t);
  const mini = d.sizeId === 'instax-mini';
  const area = mini ? { x: 4, y: 7, width: 46, height: 62 }
    : d.photoHolder?.paperLayout === 'border' ? { x: 4, y: 7, width: paper.widthMm - 8, height: paper.heightMm - 24 }
    : { x: 0, y: 0, width: paper.widthMm, height: paper.heightMm };
  return d.orientation === 'portrait' ? area : { x: paper.heightMm - area.y - area.height, y: area.x, width: area.height, height: area.width };
}
