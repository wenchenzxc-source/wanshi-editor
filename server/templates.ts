import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { templates, type Template } from '../shared/model';
const templateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1), version: z.number().int().positive(),
  widthMm: z.number().min(10).max(600), heightMm: z.number().min(10).max(600),
  bleedMm: z.number().min(0).max(30), safeMm: z.number().min(0).max(50), dpi: z.number().int().min(72).max(600),
  presentation: z.enum(['plaque', 'acrylic-block']).optional(),
  allowedMaterials: z.array(z.enum(['clear', 'black', 'white', 'iridescent', 'gold', 'silver', 'roseGold'])).min(1).optional(),
  allowCustomSize: z.boolean().optional(), thicknessMm: z.number().positive().optional(),
  sizes: z.array(z.object({ id: z.string().min(1).max(80), name: z.string().min(1), retired: z.boolean().optional(), widthMm: z.number().min(10).max(600), heightMm: z.number().min(10).max(600), thicknessMm: z.number().positive().max(100).optional() })).min(1).optional(),
  noProcess: z.array(z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), width: z.number().positive(), height: z.number().positive(), label: z.string() })).max(30),
}).superRefine((t, ctx) => {
  if (t.sizes) {
    if (new Set(t.sizes.map(s => s.id)).size !== t.sizes.length) ctx.addIssue({ code: 'custom', message: '尺寸 ID 重複' });
    for (const s of t.sizes) if (t.safeMm * 2 >= Math.min(s.widthMm, s.heightMm) || ((s.widthMm + t.bleedMm * 2) * t.dpi / 25.4) * ((s.heightMm + t.bleedMm * 2) * t.dpi / 25.4) > 40_000_000) ctx.addIssue({ code: 'custom', message: '尺寸安全區或輸出像素超過模板限制' });
  }
  if (t.safeMm * 2 >= Math.min(t.widthMm, t.heightMm) || ((t.widthMm + t.bleedMm * 2) * t.dpi / 25.4) * ((t.heightMm + t.bleedMm * 2) * t.dpi / 25.4) > 40_000_000) ctx.addIssue({ code: 'custom', message: '安全區或輸出像素超過模板限制' });
  for (const z of t.noProcess) if (z.x + z.width > t.widthMm || z.y + z.height > t.heightMm) ctx.addIssue({ code: 'custom', message: '不可加工區超出成品範圍' });
});
export async function loadTemplates(file = process.env.TEMPLATES_FILE): Promise<Template[]> {
  const result = z.array(templateSchema).min(1).parse(file ? JSON.parse(await readFile(file, 'utf8')) : templates);
  if (new Set(result.map(t => t.id)).size !== result.length) throw new Error('模板 ID 不可重複'); return result;
}
