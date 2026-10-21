import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import archiver from 'archiver';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { designSchema, templates, resolveTemplate, fitFrames, dimensions, photoImageArea, slotGeometry, badgeRadius, badgeAccessories, type Design, type Template, type Asset } from '../shared/model';
import { Store } from './store';
import { fontPath, registerFont, render } from './render';
import { fonts } from '../shared/fonts';
import { artCatalog } from '../shared/artwork';

type PrivateAsset = Asset & { owner: string };
type Draft = { owner: string; design: Design; revision: number; updatedAt: string };
type Snapshot = Draft & { id: string; createdAt: string; template: Template; assets: Asset[] };
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const idSchema = z.string().uuid();
export async function createApp(dataDir: string, options: { templates?: Template[] } = {}) {
  const app = express(), store = new Store(dataDir), catalog = options.templates || templates;
  await store.init(); registerFont();
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (!['GET', 'HEAD'].includes(req.method)) {
      const origin = req.get('origin');
      const allowed = new Set([`http://${req.get('host')}`, `https://${req.get('host')}`, ...(process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173').split(',')]);
      if (req.get('sec-fetch-site') === 'cross-site' || (origin && !allowed.has(origin))) return next(new HttpError(403, '來源不允許'));
    }
    next();
  });
  app.use(express.json({ limit: '2mb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true, apiVersion: 'eraser-v16' }));
  app.post('/api/session', async (req, res) => {
    const existing = req.headers.cookie?.match(/(?:^|; )wanshi=([a-f0-9]{64})(?:;|$)/)?.[1];
    if (existing && await store.get('sessions', hash(existing))) return res.json({ ok: true });
    const token = randomBytes(32).toString('hex');
    await store.put('sessions', hash(token), { createdAt: new Date().toISOString() }, true);
    res.cookie('wanshi', token, { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', maxAge: 365 * 86400000, path: '/' });
    res.json({ ok: true });
  });
  app.use('/api', async (req, res, next) => {
    const token = req.headers.cookie?.match(/(?:^|; )wanshi=([a-f0-9]{64})(?:;|$)/)?.[1];
    if (!token || !await store.get('sessions', hash(token))) return next(new HttpError(401, '請重新載入以建立私有工作階段'));
    res.locals.owner = hash(token); next();
  });
  const owned = async (id: string, owner: string) => {
    const d = await store.get<Draft>('drafts', idSchema.parse(id));
    if (!d || d.owner !== owner) throw new HttpError(404, '找不到設計'); return d;
  };
  const ownedAsset = async (id: string, owner: string) => {
    const a = await store.get<PrivateAsset>('assets', idSchema.parse(id));
    if (!a || a.owner !== owner) throw new HttpError(404, '找不到素材'); return a;
  };
  const assetsFor = async (id: string, owner: string) => (await store.list<PrivateAsset>('assets')).filter(a => a.owner === owner && a.designId === id).map(({ owner: _, ...a }) => a);
  const validateDesign = async (d: Design, owner: string) => {
    const template = catalog.find(t => t.id === d.templateId);
    if (!template) throw new HttpError(400, '未知商品模板');
    if (template.presentation === 'photo-holder') {
      if (!d.photoHolder) throw new HttpError(400, '請選擇照片服務、底座與 NFC');
      if (d.duplex || d.printView === 'acrylic' || d.printStack !== 'white-cmyk') throw new HttpError(400, '照片相紙不支援壓克力印刷效果');
    } else if (d.photoHolder) throw new HttpError(400, '此商品不支援照片框選配');
    if (template.allowedMaterials && !template.allowedMaterials.includes(d.material!)) throw new HttpError(400, '此商品不支援所選底材');
    if (!(template.allowCustomSize && d.sizeId === 'custom') && (template.sizes?.length ? !template.sizes.some(s => s.id === d.sizeId) : d.sizeId !== undefined)) throw new HttpError(400, '請選擇有效的商品尺寸');
    const normalized = fitFrames(d, template);
    if (d.layers.some((l, i) => l.kind === 'frame' && JSON.stringify(l) !== JSON.stringify(normalized.layers[i]))) throw new HttpError(400, '圖框必須貼合版面且鎖定');
    const resolved = resolveTemplate(d, template);
    if (resolved.safeMm * 2 >= Math.min(resolved.widthMm, resolved.heightMm) || ((resolved.widthMm + resolved.bleedMm * 2) * resolved.dpi / 25.4) * ((resolved.heightMm + resolved.bleedMm * 2) * resolved.dpi / 25.4) > 40_000_000) throw new HttpError(400, '尺寸超過工作區或輸出限制');
    if (d.slot?.enabled) {
      if (template.presentation !== 'acrylic-badge') throw new HttpError(400, '此商品不支援開槽');
      const preset = badgeAccessories.find(a => a.id === d.badgeAccessory);
      if (preset && (d.slot.widthMm !== preset.widthMm || d.slot.heightMm !== preset.heightMm || d.slot.shape !== preset.shape)) throw new HttpError(400, '配件與孔槽規格不一致');
      const slot = slotGeometry(d, resolved)!, size = dimensions(d, resolved);
      if (slot.x < resolved.safeMm || slot.x + slot.width > size.w - resolved.safeMm || slot.y + slot.height > size.h - resolved.safeMm) throw new HttpError(400, '開槽超出成品安全範圍');
    }
    if (badgeAccessories.some(a => a.id === d.badgeAccessory) && !d.slot?.enabled) throw new HttpError(400, '所選配件需要開孔或開槽');
    if (d.badgeAccessory === 'none' && d.slot?.enabled) throw new HttpError(400, '無配件款不可附帶孔槽');
    for (const l of d.layers) if (l.assetId) { const a = await ownedAsset(l.assetId, owner); if (a.designId !== d.id) throw new HttpError(400, '素材不屬於此設計'); }
  };
  app.get('/api/config', (_req, res) => res.json({ templates: catalog, backgroundRemoval: Boolean(process.env.REMOVEBG_API_KEY), maxFileBytes: 20 * 1024 * 1024 }));
  app.get('/api/font', (_req, res) => res.sendFile(fontPath));
  app.get('/api/designs', async (_req, res) => res.json((await store.list<Draft>('drafts')).filter(d => d.owner === res.locals.owner).map(d => ({ id: d.design.id, name: d.design.name, updatedAt: d.updatedAt }))));
  app.post('/api/designs', async (req, res) => {
    const design = designSchema.parse(req.body); await validateDesign(design, res.locals.owner);
    const draft: Draft = { owner: res.locals.owner, design, revision: 1, updatedAt: new Date().toISOString() };
    try { await store.put('drafts', design.id, draft, true); } catch (e: any) { if (e.code === 'EEXIST') throw new HttpError(409, '設計 ID 已存在'); throw e; }
    res.status(201).json({ design, revision: 1, assets: [], versions: [] });
  });
  app.get('/api/designs/:id', async (req, res) => {
    const d = await owned(req.params.id, res.locals.owner);
    const versions = (await store.list<Snapshot>('versions')).filter(v => v.owner === d.owner && v.design.id === d.design.id).map(v => ({ id: v.id, createdAt: v.createdAt, revision: v.revision, orderItemId: v.design.orderItemId }));
    res.json({ design: d.design, revision: d.revision, assets: await assetsFor(d.design.id, d.owner), versions });
  });
  app.put('/api/designs/:id', async (req, res) => {
    const input = z.object({ design: designSchema, baseRevision: z.number().int().positive() }).parse(req.body);
    await store.exclusive(req.params.id, async () => {
      const old = await owned(req.params.id, res.locals.owner);
      if (input.design.id !== old.design.id) throw new HttpError(400, '設計 ID 不一致');
      if (old.revision !== input.baseRevision) throw new HttpError(409, '其他分頁已更新此設計，請重新開啟，避免覆蓋變更');
      await validateDesign(input.design, old.owner);
      const draft = { ...old, design: input.design, revision: old.revision + 1, updatedAt: new Date().toISOString() };
      await store.put('drafts', req.params.id, draft); res.json({ revision: draft.revision });
    });
  });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 12 } });
  app.post('/api/designs/:id/assets', upload.array('files', 12), async (req, res) => {
    const d = await owned(String(req.params.id), res.locals.owner), files = req.files as Express.Multer.File[];
    if (!files?.length) throw new HttpError(400, '請選擇圖片');
    const prepared = await Promise.all(files.map(async f => {
      try {
      const meta = await sharp(f.buffer, { limitInputPixels: 40_000_000 }).metadata();
      if (!['jpeg', 'png', 'webp'].includes(meta.format || '') || (meta.pages || 1) > 1) throw new HttpError(400, '只接受非動畫 JPG、PNG、WebP 圖片');
      await sharp(f.buffer, { limitInputPixels: 40_000_000 }).resize(1, 1).toBuffer();
      const swap = [5, 6, 7, 8].includes(meta.orientation || 1);
      const asset: PrivateAsset = { id: randomUUID(), designId: d.design.id, owner: d.owner, originalName: Buffer.from(f.originalname, 'latin1').toString('utf8').slice(0, 160), mime: `image/${meta.format}`, width: (swap ? meta.height : meta.width)!, height: (swap ? meta.width : meta.height)!, sha256: hash(f.buffer), variant: 'original' };
      return { asset, bytes: f.buffer };
      } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, '圖片無法解碼、檔案損毀或超過 40MP，請使用有效的 JPG、PNG、WebP'); }
    }));
    for (const p of prepared) { await writeFile(store.file('files', p.asset.id, 'bin'), p.bytes, { flag: 'wx' }); await store.put('assets', p.asset.id, p.asset, true); }
    res.status(201).json(prepared.map(({ asset: { owner: _, ...a } }) => a));
  });
  app.get('/api/assets/:id', async (req, res) => {
    const a = await ownedAsset(req.params.id, res.locals.owner);
    if (req.query.original === '1') { res.type(a.mime); return res.sendFile(store.file('files', a.id, 'bin')); }
    res.type('png').send(await sharp(store.file('files', a.id, 'bin')).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).png().toBuffer());
  });
  app.delete('/api/assets/:id', async (req, res) => {
    await store.exclusive(`asset-${req.params.id}`, async () => {
      const a = await ownedAsset(req.params.id, res.locals.owner);
      const updated = { ...a, deletedAt: a.deletedAt || new Date().toISOString() };
      await store.put('assets', a.id, updated);
      const { owner: _, ...result } = updated; res.json(result);
    });
  });
  app.post('/api/assets/:id/remove-background', async (req, res) => {
    const a = await ownedAsset(req.params.id, res.locals.owner);
    if (!process.env.REMOVEBG_API_KEY) throw new HttpError(503, 'AI 去背未啟用：伺服器尚未設定 remove.bg API 金鑰');
    const form = new FormData(); form.append('image_file', new Blob([new Uint8Array(await readFile(store.file('files', a.id, 'bin')))], { type: a.mime }), 'image'); form.append('size', 'auto');
    const upstream = await fetch('https://api.remove.bg/v1.0/removebg', { method: 'POST', headers: { 'X-Api-Key': process.env.REMOVEBG_API_KEY }, body: form, signal: AbortSignal.timeout(60000) });
    if (!upstream.ok) throw new HttpError(502, `去背服務失敗 (${upstream.status})，原圖已保留`);
    const raw = Buffer.from(await upstream.arrayBuffer());
    const bytes = await sharp(raw, { limitInputPixels: 40_000_000 }).png().toBuffer(), m = await sharp(bytes).metadata();
    const cutout = { ...a, deletedAt: undefined, id: randomUUID(), mime: 'image/png', width: m.width!, height: m.height!, sha256: hash(bytes), sourceAssetId: a.id, variant: 'cutout' as const };
    await writeFile(store.file('files', cutout.id, 'bin'), bytes, { flag: 'wx' }); await store.put('assets', cutout.id, cutout, true);
    const { owner: _, ...result } = cutout; res.json(result);
  });
  app.post('/api/designs/:id/confirm', async (req, res) => {
    const { revision } = z.object({ revision: z.number().int().positive() }).parse(req.body);
    await store.exclusive(req.params.id, async () => {
      const d = await owned(req.params.id, res.locals.owner);
      if (revision !== d.revision) throw new HttpError(409, '確認前請先儲存最新設計');
      if (d.design.photoHolder?.photoService === 'print' && !d.design.layers.some(l => l.visible && l.opacity > 0 && l.kind !== 'uv' && l.face !== 'back')) throw new HttpError(400, '加購照片列印請先加入照片、文字或圖稿');
      if (d.design.photoHolder && d.design.layers.some(l => l.kind === 'uv' && l.visible)) throw new HttpError(400, '照片列印不支援 UV 微浮雕，請隱藏或刪除 UV 圖層');
      const v: Snapshot = { ...d, id: randomUUID(), createdAt: new Date().toISOString(), template: resolveTemplate(d.design, catalog.find(t => t.id === d.design.templateId)!), assets: await assetsFor(d.design.id, d.owner) };
      // Persist actual output bytes at confirmation: later fonts/render changes cannot change an order.
      const front = { ...v.design, activeFace: 'front' as const };
      const preview = await render(front, v.template, v.assets, store, 'preview', false);
      const production = await render(front, v.template, v.assets, store, 'production');
      await writeFile(store.file('files', `${v.id}-preview`, 'png'), preview, { flag: 'wx' });
      await writeFile(store.file('files', `${v.id}-production`, 'png'), production, { flag: 'wx' });
      if (v.design.layers.some(l => l.kind === 'uv' && l.visible && l.face !== 'back')) await writeFile(store.file('files', `${v.id}-mask`, 'png'), await render(front, v.template, v.assets, store, 'mask'), { flag: 'wx' });
      if (v.design.duplex && !v.design.printStack) {
        const back = { ...v.design, activeFace: 'back' as const };
        for (const mode of ['preview', 'production', 'mask'] as const) {
          if (mode === 'mask' && !back.layers.some(l => l.kind === 'uv' && l.visible && l.face === 'back')) continue;
          await writeFile(store.file('files', `${v.id}-back-${mode}`, 'png'), await render(back, v.template, v.assets, store, mode, mode !== 'preview'), { flag: 'wx' });
        }
      }
      await store.put('versions', v.id, v, true);
      res.status(201).json({ id: v.id, createdAt: v.createdAt, revision: v.revision, orderItemId: v.design.orderItemId });
    });
  });
  const snapshot = async (id: string, owner: string) => {
    const v = await store.get<Snapshot>('versions', idSchema.parse(id));
    if (!v || v.owner !== owner) throw new HttpError(404, '找不到確認版本'); return v;
  };
  type CartItem = { id: string; versionId: string; quantity: number; addedAt: string };
  const getCart = async (owner: string) => await store.get<CartItem[]>('carts', owner) || [];
  app.get('/api/cart', async (_req, res) => {
    const items = await getCart(res.locals.owner);
    res.json(await Promise.all(items.map(async item => { const v = await snapshot(item.versionId, res.locals.owner); return { ...item, name: v.design.name, product: v.template.name, designId: v.design.id, dimensions: dimensions(v.design, v.template), photoHolder: v.design.photoHolder, wooCommerceProductId: v.design.wooCommerceProductId, orderItemId: v.design.orderItemId }; })));
  });
  app.post('/api/cart', async (req, res) => {
    const { versionId } = z.object({ versionId: idSchema }).parse(req.body);
    await snapshot(versionId, res.locals.owner);
    const item = await store.exclusive(`cart-${res.locals.owner}`, async () => {
      const items = await getCart(res.locals.owner), existing = items.find(i => i.versionId === versionId);
      if (existing) return existing; // Safe retry: one item per confirmed version.
      const next = { id: randomUUID(), versionId, quantity: 1, addedAt: new Date().toISOString() };
      items.push(next); await store.put('carts', res.locals.owner, items); return next;
    }); res.status(201).json(item);
  });
  app.patch('/api/cart/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id), { quantity } = z.object({ quantity: z.number().int().min(0).max(99) }).parse(req.body);
    await store.exclusive(`cart-${res.locals.owner}`, async () => {
      const items = await getCart(res.locals.owner), item = items.find(i => i.id === id);
      if (!item) throw new HttpError(404, '找不到購物車商品');
      item.quantity = quantity; await store.put('carts', res.locals.owner, items.filter(i => i.quantity > 0));
    }); res.json({ ok: true });
  });
  app.get('/api/library/:file', (req, res) => {
    const artwork = artCatalog.find(a => `${a.id}.svg` === req.params.file);
    if (!artwork?.svg) throw new HttpError(404, '找不到素材');
    res.type('svg').send(artwork.svg);
  });
  app.post('/api/designs/:id/library', async (req, res) => {
    const draft = await owned(req.params.id, res.locals.owner);
    const { artworkId } = z.object({ artworkId: z.string() }).parse(req.body);
    const artwork = artCatalog.find(a => a.id === artworkId);
    if (!artwork) throw new HttpError(404, '找不到素材');
    if (artwork.category === '圖框') throw new HttpError(400, '請以套用圖框加入版面');
    const buffer = artwork.file ? await readFile(path.resolve('public/artwork', artwork.file)) : await sharp(Buffer.from(artwork.svg!)).resize(1600, 1600).png().toBuffer();
    const metadata = await sharp(buffer).metadata();
    const asset: PrivateAsset = { id: randomUUID(), designId: draft.design.id, owner: res.locals.owner, libraryArtworkId: artwork.id, originalName: `${artwork.name}.png`, mime: 'image/png', width: metadata.width!, height: metadata.height!, sha256: hash(buffer), variant: 'original' };
    await writeFile(store.file('files', asset.id, 'bin'), buffer, { flag: 'wx' });
    await store.put('assets', asset.id, asset, true);
    const { owner: _, ...publicAsset } = asset; res.status(201).json(publicAsset);
  });
  app.get('/api/versions/:id', async (req, res) => { const { owner: _, ...v } = await snapshot(req.params.id, res.locals.owner); res.json(v); });
  app.get('/api/versions/:id/preview.png', async (req, res) => { const v = await snapshot(req.params.id, res.locals.owner); res.type('png').sendFile(store.file('files', `${v.id}-preview`, 'png')); });
  app.get('/api/versions/:id/package.zip', async (req, res) => {
    const v = await snapshot(req.params.id, res.locals.owner);
    res.attachment(`wanshi-${v.id}.zip`);
    const zip = archiver('zip', { zlib: { level: 6 } }); zip.on('error', e => res.destroy(e)); zip.pipe(res);
    zip.append(JSON.stringify(v.design, null, 2), { name: 'design.json' });
    if ((v.assets.some(a => a.libraryArtworkId) || v.design.layers.some(l => l.kind === 'frame'))) zip.append('萬事造物素材：包含原創向量及 AI 生成透明花材，可用於本工作室及客戶的設計、修改與商品製作；不宣稱排他權利。素材 ID 與原圖 SHA-256 見 manifest.json。', { name: 'artwork-license.txt' });
    const usedFonts = fonts.filter(f => v.design.layers.some(l => l.kind === 'text' && (l.fontId || 'sans') === f.id));
    zip.append(JSON.stringify(usedFonts, null, 2), { name: 'fonts/catalog.json' });
    for (const font of usedFonts) zip.file(path.join(path.dirname(fontPath), font.file), { name: `fonts/${font.file}` });
    for (const license of new Set(usedFonts.map(f => f.license))) zip.file(path.join(path.dirname(fontPath), license), { name: `fonts/${license}` });
    zip.append(JSON.stringify({ versionId: v.id, createdAt: v.createdAt, revision: v.revision, template: v.template, assets: v.assets, wooCommerceProductId: v.design.wooCommerceProductId, orderItemId: v.design.orderItemId, units: 'mm', origin: 'trim-top-left', uv: 'grayscale: black=none, white=full; preview is conceptual' }, null, 2), { name: 'manifest.json' });
    zip.file(store.file('files', `${v.id}-preview`, 'png'), { name: 'final-preview.png' });
    if (!v.design.photoHolder || v.design.photoHolder.photoService === 'print') zip.file(store.file('files', `${v.id}-production`, 'png'), { name: v.design.photoHolder ? 'photo-print.png' : 'production-with-bleed.png' });
    if (v.design.layers.some(l => l.kind === 'uv' && l.visible && l.face !== 'back')) zip.file(store.file('files', `${v.id}-mask`, 'png'), { name: 'uv-mask.png' });
    if (v.design.duplex && !v.design.printStack) {
      zip.file(store.file('files', `${v.id}-back-preview`, 'png'), { name: 'back-final-preview.png' });
      zip.file(store.file('files', `${v.id}-back-production`, 'png'), { name: 'back-production-with-bleed.png' });
      if (v.design.layers.some(l => l.kind === 'uv' && l.visible && l.face === 'back')) zip.file(store.file('files', `${v.id}-back-mask`, 'png'), { name: 'back-uv-mask.png' });
    }
    const slot = slotGeometry(v.design, v.template), physical = dimensions(v.design, v.template);
    if (v.design.photoHolder) zip.append(JSON.stringify({ product: '照片立／掛牌', paper: v.template.sizes?.find(s => s.id === v.design.sizeId)?.name, paperSizeMm: { width: physical.w, height: physical.h }, imageAreaMm: photoImageArea(v.design, v.template), paperLayout: v.design.sizeId === 'instax-mini' ? 'instax-border' : v.design.photoHolder.paperLayout || 'full', photoService: v.design.photoHolder.photoService, printPhoto: v.design.photoHolder.photoService === 'print', desktopBase: v.design.photoHolder.base, rearNfc: v.design.photoHolder.nfc, nfcProgramming: v.design.photoHolder.nfc ? 'to-be-configured' : 'not-included', frameDimensionsMm: null, frameDimensionsStatus: 'awaiting-confirmation', preview: 'paper artwork only; frame illustration is not a manufacturing outline' }, null, 2), { name: 'photo-holder-options.json' });
    if (slot) zip.append(`<svg xmlns="http://www.w3.org/2000/svg" width="${physical.w}mm" height="${physical.h}mm" viewBox="0 0 ${physical.w} ${physical.h}"><rect x="${slot.x}" y="${slot.y}" width="${slot.width}" height="${slot.height}" rx="${slot.radius}" fill="none" stroke="#ff0000" stroke-width="0.1"/></svg>`, { name: 'slot-cut-path.svg' });
    if (v.template.presentation === 'acrylic-badge') zip.append(`<svg xmlns="http://www.w3.org/2000/svg" width="${physical.w}mm" height="${physical.h}mm" viewBox="0 0 ${physical.w} ${physical.h}"><rect x="0" y="0" width="${physical.w}" height="${physical.h}" rx="${badgeRadius(v.design, v.template)}" fill="none" stroke="#000000" stroke-width="0.1"/>${slot ? `<rect x="${slot.x}" y="${slot.y}" width="${slot.width}" height="${slot.height}" rx="${slot.radius}" fill="none" stroke="#ff0000" stroke-width="0.1"/>` : ''}</svg>`, { name: 'badge-cut-path.svg' });
    zip.append(JSON.stringify({ ...(v.design.photoHolder ? { photoHolder: v.design.photoHolder, dimensionScope: 'photo-paper', frameDimensionsMm: null, printPhoto: v.design.photoHolder.photoService === 'print' } : {}), badgeAccessory: v.design.badgeAccessory || null, cornerRadiusMm: badgeRadius(v.design, v.template), slot: slot ? { ...slot, units: 'mm', placement: `top-${v.design.slot?.shape === 'circle' ? v.design.slot.position || 'center' : 'center'}`, topOffsetMm: 5 } : null, material: v.design.material || 'legacy-background', sizeId: v.design.sizeId, widthMm: physical.w, heightMm: physical.h, thicknessMm: v.template.thicknessMm, requiresQuote: v.design.sizeId === 'custom', duplex: !!v.design.duplex, printView: v.design.printView || 'direct', printStack: v.design.printStack || null, stackOrder: 'substrate-outwards', artworkMode: v.design.printStack ? 'single-artwork-ink-stack' : 'legacy-independent-faces', artwork: 'readable from each selected face; no automatic mirroring; substrate and gloss excluded from ink PNG; printer must plan mirroring and white ink' }, null, 2), { name: 'manufacturing.json' });
    for (const a of v.assets) zip.file(store.file('files', a.id, 'bin'), { name: `${a.variant === 'original' ? 'originals' : 'cutouts'}/${a.id}.${a.mime === 'image/jpeg' ? 'jpg' : a.mime.split('/')[1]}` });
    zip.append(v.design.photoHolder ? `照片立／掛牌：本包尺寸為相紙範圍，非外框成品尺寸。外框尺寸尚待確認，不提供外框切割檔。\n${v.design.photoHolder.photoService === 'own' ? '客人自備照片：final-preview.png 僅供試放參考，不安排照片列印。' : '加購照片列印：photo-print.png 為相紙尺寸圖稿；列印方式依實際設備確認。'}\n底座、背面 NFC 選配見 photo-holder-options.json。NFC 選配不代表晶片已寫入。原始圖片與可編輯 JSON 保留。` : '原圖及去背圖依 UUID 保存，原始檔名與 SHA-256 請見 manifest.json。\nproduction-with-bleed.png 依 manifest.json 的模板出血設定輸出（出血為 0 時即成品大小）；final-preview.png 為成品與 UV 示意。安全線為排版提醒，不會自動裁切圖稿。\nUV 遮罩只定義效果區域與強度，不代表真實凸起高度。印前請依加工設備校色與檢查。', { name: 'README.txt' });
    await zip.finalize();
  });
  app.use('/api', (_req, _res, next) => next(new HttpError(404, '找不到 API')));
  app.use(express.static(path.resolve('dist')));
  app.get('/', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (res.headersSent) return;
    const status = error instanceof z.ZodError || error instanceof multer.MulterError ? 400 : error.status || 500;
    if (status === 500) console.error(error);
    res.status(status).json({ error: status === 500 ? '處理失敗，請稍後重試；設計及原圖仍保留' : error.message });
  });
  return app;
}



