import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import archiver from 'archiver';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { designSchema, templates, type Design, type Template, type Asset } from '../shared/model';
import { Store } from './store';
import { fontPath, registerFont, render } from './render';

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
    if (!catalog.some(t => t.id === d.templateId)) throw new HttpError(400, '未知商品模板');
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
  app.post('/api/assets/:id/remove-background', async (req, res) => {
    const a = await ownedAsset(req.params.id, res.locals.owner);
    if (!process.env.REMOVEBG_API_KEY) throw new HttpError(503, 'AI 去背未啟用：伺服器尚未設定 remove.bg API 金鑰');
    const form = new FormData(); form.append('image_file', new Blob([new Uint8Array(await readFile(store.file('files', a.id, 'bin')))], { type: a.mime }), 'image'); form.append('size', 'auto');
    const upstream = await fetch('https://api.remove.bg/v1.0/removebg', { method: 'POST', headers: { 'X-Api-Key': process.env.REMOVEBG_API_KEY }, body: form, signal: AbortSignal.timeout(60000) });
    if (!upstream.ok) throw new HttpError(502, `去背服務失敗 (${upstream.status})，原圖已保留`);
    const raw = Buffer.from(await upstream.arrayBuffer());
    const bytes = await sharp(raw, { limitInputPixels: 40_000_000 }).png().toBuffer(), m = await sharp(bytes).metadata();
    const cutout = { ...a, id: randomUUID(), mime: 'image/png', width: m.width!, height: m.height!, sha256: hash(bytes), sourceAssetId: a.id, variant: 'cutout' as const };
    await writeFile(store.file('files', cutout.id, 'bin'), bytes, { flag: 'wx' }); await store.put('assets', cutout.id, cutout, true);
    const { owner: _, ...result } = cutout; res.json(result);
  });
  app.post('/api/designs/:id/confirm', async (req, res) => {
    const { revision } = z.object({ revision: z.number().int().positive() }).parse(req.body);
    await store.exclusive(req.params.id, async () => {
      const d = await owned(req.params.id, res.locals.owner);
      if (revision !== d.revision) throw new HttpError(409, '確認前請先儲存最新設計');
      const v: Snapshot = { ...d, id: randomUUID(), createdAt: new Date().toISOString(), template: catalog.find(t => t.id === d.design.templateId)!, assets: await assetsFor(d.design.id, d.owner) };
      // Persist actual output bytes at confirmation: later fonts/render changes cannot change an order.
      const preview = await render(v.design, v.template, v.assets, store, 'preview', false);
      const production = await render(v.design, v.template, v.assets, store, 'production');
      await writeFile(store.file('files', `${v.id}-preview`, 'png'), preview, { flag: 'wx' });
      await writeFile(store.file('files', `${v.id}-production`, 'png'), production, { flag: 'wx' });
      if (v.design.layers.some(l => l.kind === 'uv' && l.visible)) await writeFile(store.file('files', `${v.id}-mask`, 'png'), await render(v.design, v.template, v.assets, store, 'mask'), { flag: 'wx' });
      await store.put('versions', v.id, v, true);
      res.status(201).json({ id: v.id, createdAt: v.createdAt, revision: v.revision, orderItemId: v.design.orderItemId });
    });
  });
  const snapshot = async (id: string, owner: string) => {
    const v = await store.get<Snapshot>('versions', idSchema.parse(id));
    if (!v || v.owner !== owner) throw new HttpError(404, '找不到確認版本'); return v;
  };
  app.get('/api/versions/:id', async (req, res) => { const { owner: _, ...v } = await snapshot(req.params.id, res.locals.owner); res.json(v); });
  app.get('/api/versions/:id/preview.png', async (req, res) => { const v = await snapshot(req.params.id, res.locals.owner); res.type('png').sendFile(store.file('files', `${v.id}-preview`, 'png')); });
  app.get('/api/versions/:id/package.zip', async (req, res) => {
    const v = await snapshot(req.params.id, res.locals.owner);
    res.attachment(`wanshi-${v.id}.zip`);
    const zip = archiver('zip', { zlib: { level: 6 } }); zip.on('error', e => res.destroy(e)); zip.pipe(res);
    zip.append(JSON.stringify(v.design, null, 2), { name: 'design.json' });
    zip.append(JSON.stringify({ versionId: v.id, createdAt: v.createdAt, revision: v.revision, template: v.template, assets: v.assets, wooCommerceProductId: v.design.wooCommerceProductId, orderItemId: v.design.orderItemId, units: 'mm', origin: 'trim-top-left', uv: 'grayscale: black=none, white=full; preview is conceptual' }, null, 2), { name: 'manifest.json' });
    zip.file(store.file('files', `${v.id}-preview`, 'png'), { name: 'final-preview.png' });
    zip.file(store.file('files', `${v.id}-production`, 'png'), { name: 'production-with-bleed.png' });
    if (v.design.layers.some(l => l.kind === 'uv' && l.visible)) zip.file(store.file('files', `${v.id}-mask`, 'png'), { name: 'uv-mask.png' });
    for (const a of v.assets) zip.file(store.file('files', a.id, 'bin'), { name: `${a.variant === 'original' ? 'originals' : 'cutouts'}/${a.id}.${a.mime === 'image/jpeg' ? 'jpg' : a.mime.split('/')[1]}` });
    zip.append('原圖及去背圖依 UUID 保存，原始檔名與 SHA-256 請見 manifest.json。\nproduction-with-bleed.png 含出血；final-preview.png 為裁切成品與 UV 示意。\nUV 遮罩只定義效果區域與強度，不代表真實凸起高度。印前請依加工設備校色與檢查。', { name: 'README.txt' });
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
