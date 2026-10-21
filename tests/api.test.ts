import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import sharp from 'sharp';
import { createApp } from '../server/app';
import { emptyDesign, newLayer, dimensions, templates, badgeAccessories, slotGeometry, photoImageArea, type Asset } from '../shared/model';
import { render } from '../server/render';
import { Store } from '../server/store';

function unzip(b: Buffer) {
  const result = new Map<string, Buffer>();
  let end = b.length - 22; while (end >= 0 && b.readUInt32LE(end) !== 0x06054b50) end--;
  assert.ok(end >= 0); let offset = b.readUInt32LE(end + 16);
  const count = b.readUInt16LE(end + 10);
  for (let i = 0; i < count; i++) {
    assert.equal(b.readUInt32LE(offset), 0x02014b50);
    const method = b.readUInt16LE(offset + 10), size = b.readUInt32LE(offset + 20), nameLen = b.readUInt16LE(offset + 28), extra = b.readUInt16LE(offset + 30), comment = b.readUInt16LE(offset + 32), local = b.readUInt32LE(offset + 42);
    const name = b.subarray(offset + 46, offset + 46 + nameLen).toString();
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28), data = b.subarray(start, start + size);
    result.set(name, method === 8 ? inflateRawSync(data) : data); offset += 46 + nameLen + extra + comment;
  } return result;
}
test('private upload → editable draft → immutable confirmation → complete production ZIP', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wanshi-test-')), app = await createApp(root), server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r)); const url = `http://127.0.0.1:${(server.address() as any).port}/api`;
  let cookie = '';
  const req = (route: string, method = 'GET', body?: unknown) => fetch(url + route, { method, headers: { Cookie: cookie, ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  try {
    assert.equal((await req('/designs')).status, 401);
    cookie = (await req('/session', 'POST')).headers.get('set-cookie')!.split(';')[0];
    const d = emptyDesign(); delete d.printStack; assert.equal((await req('/designs', 'POST', d)).status, 201);
    const png = await sharp({ create: { width: 240, height: 160, channels: 4, background: '#ef3344' } }).png().toBuffer();
    const jpg = await sharp(png).jpeg().toBuffer(), webp = await sharp(png).webp().toBuffer();
    const form = new FormData();
    for (const [name, bytes] of [['test.png', png], ['test.jpg', jpg], ['test.webp', webp]] as const) form.append('files', new Blob([new Uint8Array(bytes)]), name);
    const upload = await req(`/designs/${d.id}/assets`, 'POST', form); assert.equal(upload.status, 201); const assets: Asset[] = await upload.json(); assert.equal(assets.length, 3);
    const spoofed = new FormData(); spoofed.append('files', new Blob(['<svg/>'], { type: 'image/png' }), 'fake.png');
    assert.notEqual((await req(`/designs/${d.id}/assets`, 'POST', spoofed)).status, 201);
    assert.deepEqual(Buffer.from(await (await req(`/assets/${assets[0].id}?original=1`)).arrayBuffer()), png);
    assert.equal((await req(`/assets/${assets[0].id}/remove-background`, 'POST')).status, 503);
    d.layers = [newLayer('image', { assetId: assets[0].id, x: 12.5, y: 30.25, width: 45, height: 30, rotation: 13.5 }), newLayer('text', { fontId: 'serif', text: '中文測試\nHello', fontSize: 8, x: 20, y: 80, height: 40 }), newLayer('uv', { shape: 'circle', x: 50, y: 140, width: 20, height: 20, opacity: 0.5 })];
    const save = await req(`/designs/${d.id}`, 'PUT', { design: d, baseRevision: 1 }); assert.equal(save.status, 200);
    assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: d, baseRevision: 1 })).status, 409);
    assert.equal((await req(`/designs/${d.id}/confirm`, 'POST', { revision: 1 })).status, 409);
    assert.deepEqual((await (await req(`/designs/${d.id}`)).json()).design, d);
    const confirm = await req(`/designs/${d.id}/confirm`, 'POST', { revision: 2 }); assert.equal(confirm.status, 201); const v = await confirm.json();
    const zip = unzip(Buffer.from(await (await req(`/versions/${v.id}/package.zip`)).arrayBuffer()));
    assert.deepEqual(JSON.parse(zip.get('design.json')!.toString()), d);
    assert.ok(zip.has('fonts/NotoSerifTC.ttf')); assert.ok(zip.has('fonts/NotoSerifTC-OFL.txt'));
    assert.deepEqual(zip.get(`originals/${assets[0].id}.png`), png);
    assert.deepEqual(zip.get(`originals/${assets[1].id}.jpg`), jpg);
    assert.deepEqual(zip.get(`originals/${assets[2].id}.webp`), webp);
    const production = await sharp(zip.get('production-with-bleed.png')).metadata();
    assert.equal(production.width, Math.round(154 / 25.4 * 300)); assert.equal(production.height, Math.round(216 / 25.4 * 300)); assert.equal(production.density, 300);
    const preview = await sharp(zip.get('final-preview.png')).metadata(); assert.equal(preview.width, Math.round(148 / 25.4 * 300)); assert.equal(preview.height, Math.round(210 / 25.4 * 300));
    const mask = await sharp(zip.get('uv-mask.png')).raw().toBuffer({ resolveWithObject: true });
    const px = Math.round(63 / 25.4 * 300), py = Math.round(153 / 25.4 * 300), gray = mask.data[(py * mask.info.width + px) * mask.info.channels]; assert.ok(gray >= 126 && gray <= 129); assert.equal(mask.data[0], 0);
    const originalVersion = await (await req(`/versions/${v.id}`)).json();
    assert.equal((await req(`/assets/${assets[0].id}`, 'DELETE')).status, 200);
    assert.ok((await (await req(`/designs/${d.id}`)).json()).assets[0].deletedAt || (await (await req(`/designs/${d.id}`)).json()).assets.some((a: Asset) => a.id === assets[0].id && a.deletedAt));
    d.layers[0].x = 92; d.orientation = 'landscape'; d.orderItemId = 'wc-item-777';
    assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: d, baseRevision: 2 })).status, 200);
    assert.deepEqual(await (await req(`/versions/${v.id}`)).json(), originalVersion);
    const zip2 = unzip(Buffer.from(await (await req(`/versions/${v.id}/package.zip`)).arrayBuffer()));
    for (const [key, value] of zip) assert.deepEqual(zip2.get(key), value, `${key} must remain immutable`);
    const v2 = await (await req(`/designs/${d.id}/confirm`, 'POST', { revision: 3 })).json();
    const landscape = await sharp(Buffer.from(await (await req(`/versions/${v2.id}/preview.png`)).arrayBuffer())).metadata(); assert.equal(landscape.width, preview.height); assert.equal(landscape.height, preview.width);
    d.material = 'gold'; d.duplex = true;
    assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: d, baseRevision: 3 })).status, 400);
    d.material = 'clear'; d.activeFace = 'back';
    d.layers.push(newLayer('shape', { face: 'back', shape: 'rect', fill: '#00ff00' }), newLayer('uv', { face: 'back' }));
    assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: d, baseRevision: 3 })).status, 200);
    const dual = await (await req(`/designs/${d.id}/confirm`, 'POST', { revision: 4 })).json();
    const dualZip = unzip(Buffer.from(await (await req(`/versions/${dual.id}/package.zip`)).arrayBuffer()));
    assert.ok(dualZip.has('back-final-preview.png')); assert.ok(dualZip.has('back-uv-mask.png'));
    const back = await sharp(dualZip.get('back-production-with-bleed.png')).raw().toBuffer();
    assert.equal(back[3], 0, 'substrate must not be printed into blank ink pixels');
    assert.notDeepEqual(dualZip.get('production-with-bleed.png'), dualZip.get('back-production-with-bleed.png'));
    d.printStack = 'cmyk-white-cmyk'; d.activeFace = 'front';
    assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: d, baseRevision: 4 })).status, 200);
    const stackVersion = await (await req(`/designs/${d.id}/confirm`, 'POST', { revision: 5 })).json();
    const stackZip = unzip(Buffer.from(await (await req(`/versions/${stackVersion.id}/package.zip`)).arrayBuffer()));
    assert.equal(stackZip.has('back-production-with-bleed.png'), false);
    assert.equal(JSON.parse(stackZip.get('manufacturing.json')!.toString()).printStack, 'cmyk-white-cmyk');
    assert.equal(JSON.parse(stackZip.get('design.json')!.toString()).layers.filter((l: any) => l.face === 'back').length, 2);
    const otherSession = await fetch(url + '/session', { method: 'POST' }); cookie = otherSession.headers.get('set-cookie')!.split(';')[0];
    for (const route of [`/designs/${d.id}`, `/assets/${assets[0].id}`, `/versions/${v.id}`, `/versions/${v.id}/package.zip`]) assert.equal((await req(route)).status, 404);
    assert.equal((await req(`/assets/${assets[0].id}`, 'DELETE')).status, 404);
    const badOrigin = await fetch(url + '/session', { method: 'POST', headers: { Origin: 'https://evil.example' } }); assert.equal(badOrigin.status, 403);
  } finally { await new Promise<void>(r => server.close(() => r())); await rm(root, { recursive: true, force: true }); }
});
test('template dimensions and render use configurable bleed, DPI and safe areas', async () => {
  const t = { ...templates[0], bleedMm: 7, safeMm: 9, dpi: 150 };
  assert.deepEqual(dimensions({ orientation: 'landscape' }, t), { w: 210, h: 148, fullW: 224, fullH: 162 });
  const d = emptyDesign(); d.orientation = 'landscape';
  d.layers = [newLayer('shape', { shape: 'rect', fill: '#ff0000', x: 10, y: 20, width: 20, height: 10, rotation: 90 })];
  const output = await render(d, t, [], new Store('unused'), 'production');
  const meta = await sharp(output).metadata(); assert.equal(meta.width, Math.round(224 * 150 / 25.4)); assert.equal(meta.height, Math.round(162 * 150 / 25.4)); assert.equal(meta.density, 150);
  const sample = await sharp(output).extract({ left: Math.round(12 * 150 / 25.4), top: Math.round(37 * 150 / 25.4), width: 1, height: 1 }).raw().toBuffer();
  assert.equal(sample[0], 255); assert.equal(sample[1], 0); assert.equal(sample[2], 0);
});


test('acrylic block restricts material, restores size and exports selected dimensions', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wanshi-block-')), app = await createApp(root), server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r)); const url = `http://127.0.0.1:${(server.address() as any).port}/api`;
  const cookie = (await fetch(url + '/session', { method: 'POST' })).headers.get('set-cookie')!.split(';')[0];
  const req = (route: string, method = 'GET', body?: unknown) => fetch(url + route, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  try {
    const template = templates.find(t => t.id === 'acrylic-block-v1')!, d = emptyDesign(template);
    assert.equal(template.bleedMm, 0); assert.equal(template.safeMm, 1); assert.equal(d.material, 'clear'); assert.equal((await req('/designs', 'POST', d)).status, 201);
    assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: { ...d, material: 'gold' }, baseRevision: 1 })).status, 400);
    assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: { ...d, sizeId: 'invalid' }, baseRevision: 1 })).status, 400);
    d.sizeId = 'friend'; d.orientation = 'landscape';
    assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: d, baseRevision: 1 })).status, 200);
    assert.equal((await (await req(`/designs/${d.id}`)).json()).design.sizeId, 'friend');
    for (const customSize of [
      { widthMm: 20, heightMm: 50, thicknessMm: 25 },
      { widthMm: 50, heightMm: 20, thicknessMm: 25 },
      { widthMm: 15, heightMm: 20, thicknessMm: 5 },
      { widthMm: 20, heightMm: 15, thicknessMm: 5 },
      { widthMm: 20, heightMm: 20, thicknessMm: 0 },
      { widthMm: 255, heightMm: 50, thicknessMm: 10 },
      { widthMm: 50, heightMm: 255, thicknessMm: 10 },
      { widthMm: 50, heightMm: 50, thicknessMm: 55 },
      { widthMm: 51, heightMm: 50, thicknessMm: 10 },
      { widthMm: 50, heightMm: 50, thicknessMm: 6 },
    ]) assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: { ...d, sizeId: 'custom', customSize }, baseRevision: 2 })).status, 400);
    const v = await (await req(`/designs/${d.id}/confirm`, 'POST', { revision: 2 })).json();
    const zip = unzip(Buffer.from(await (await req(`/versions/${v.id}/package.zip`)).arrayBuffer()));
    const meta = await sharp(zip.get('production-with-bleed.png')).metadata();
    assert.equal(meta.width, Math.round(50 / 25.4 * 300)); assert.equal(meta.height, Math.round(30 / 25.4 * 300));
    assert.equal(JSON.parse(zip.get('manufacturing.json')!.toString()).thicknessMm, 10);
    d.sizeId = 'custom'; d.customSize = { widthMm: 55, heightMm: 80, thicknessMm: 15 };
    assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: { ...d, customSize: { ...d.customSize, thicknessMm: -1 } }, baseRevision: 2 })).status, 400);
    assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: d, baseRevision: 2 })).status, 200);
    const custom = await (await req(`/designs/${d.id}/confirm`, 'POST', { revision: 3 })).json();
    const customZip = unzip(Buffer.from(await (await req(`/versions/${custom.id}/package.zip`)).arrayBuffer()));
    const settings = JSON.parse(customZip.get('manufacturing.json')!.toString());
    assert.equal(settings.requiresQuote, true); assert.equal(settings.thicknessMm, 15);
    const customMeta = await sharp(customZip.get('production-with-bleed.png')).metadata();
    assert.equal(customMeta.width, Math.round(80 / 25.4 * 300)); assert.equal(customMeta.height, Math.round(55 / 25.4 * 300));

  } finally { await new Promise<void>(r => server.close(() => r())); await rm(root, { recursive: true, force: true }); }
});

test('acrylic badge preset outputs use the selected physical size without bleed', async () => {
  const template = templates.find(t => t.id === 'acrylic-badge-v1')!;
  assert.equal(template.bleedMm, 0); assert.equal(template.safeMm, 1);
  for (const size of template.sizes!) for (const orientation of ['portrait', 'landscape'] as const) {
    const d = { ...emptyDesign(template), sizeId: size.id, orientation };
    const output = await render(d, template, [], new Store('unused'), 'production');
    const meta = await sharp(output).metadata();
    assert.equal(meta.width, Math.round((orientation === 'portrait' ? size.widthMm : size.heightMm) * 300 / 25.4));
    assert.equal(meta.height, Math.round((orientation === 'portrait' ? size.heightMm : size.widthMm) * 300 / 25.4));
  }
});

test('badge slots stay at the top and export transparent ink plus immutable cut geometry', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wanshi-slot-')), app = await createApp(root), server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r)); const url = `http://127.0.0.1:${(server.address() as any).port}/api`;
  const cookie = (await fetch(url + '/session', { method: 'POST' })).headers.get('set-cookie')!.split(';')[0];
  const req = (route: string, method = 'GET', body?: unknown) => fetch(url + route, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  try {
    const d = emptyDesign(templates.find(t => t.id === 'acrylic-badge-v1')!);
    d.slot = { enabled: true, widthMm: 12, heightMm: 3 };
    d.layers = [newLayer('shape', { shape: 'rect', x: 0, y: 0, width: 100, height: 100, fill: '#ff0000' }), newLayer('uv', { shape: 'rect', x: 0, y: 0, width: 100, height: 100 })];
    assert.equal((await req('/designs', 'POST', d)).status, 201);
    assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: { ...d, badgeAccessory: 'webbing' }, baseRevision: 1 })).status, 400);
    for (const slot of [{ enabled: true, widthMm: 12.5, heightMm: 3 }, { enabled: true, widthMm: 49, heightMm: 3 }, { enabled: true, widthMm: 12, heightMm: 85 }]) assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: { ...d, slot }, baseRevision: 1 })).status, 400);
    let firstVersion = '', firstCut = '';
    for (const [index, orientation] of (['portrait', 'landscape'] as const).entries()) {
      d.orientation = orientation;
      if (index) assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: d, baseRevision: 1 })).status, 200);
      const v = await (await req(`/designs/${d.id}/confirm`, 'POST', { revision: index + 1 })).json();
      const zip = unzip(Buffer.from(await (await req(`/versions/${v.id}/package.zip`)).arrayBuffer()));
      const settings = JSON.parse(zip.get('manufacturing.json')!.toString());
      assert.equal(settings.thicknessMm, 3); assert.equal(settings.slot.y, 5);
      assert.equal(settings.slot.x, ((orientation === 'portrait' ? 50 : 90) - 12) / 2);
      assert.match(zip.get('slot-cut-path.svg')!.toString(), /y="5"/);
      const left = Math.round((settings.slot.x + 6) * 300 / 25.4), top = Math.round(6 * 300 / 25.4);
      const ink = await sharp(zip.get('production-with-bleed.png')).ensureAlpha().extract({ left, top, width: 1, height: 1 }).raw().toBuffer();
      assert.equal(ink[3], 0);
      const corner = await sharp(zip.get('production-with-bleed.png')).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer(); assert.equal(corner[3], 0);
      assert.match(zip.get('badge-cut-path.svg')!.toString(), /rx="3"/);
      const mask = await sharp(zip.get('uv-mask.png')).extract({ left, top, width: 1, height: 1 }).raw().toBuffer(); assert.equal(mask[0], 0);
      if (!index) { firstVersion = v.id; firstCut = zip.get('slot-cut-path.svg')!.toString(); }
    }
    const oldZip = unzip(Buffer.from(await (await req(`/versions/${firstVersion}/package.zip`)).arrayBuffer()));
    assert.equal(oldZip.get('slot-cut-path.svg')!.toString(), firstCut);
  } finally { await new Promise<void>(r => server.close(() => r())); await rm(root, { recursive: true, force: true }); }
});

test('accessory hole shapes and R4 corners remove ink at their exact geometry', async () => {
  const t = templates.find(t => t.id === 'acrylic-badge-v1')!;
  for (const a of badgeAccessories) {
    const d = { ...emptyDesign(t), badgeAccessory: a.id, badgeCornerRadiusMm: 4 as const, slot: { enabled: true, widthMm: a.widthMm, heightMm: a.heightMm, shape: a.shape }, layers: [newLayer('shape', { shape: 'rect' as const, x: 0, y: 0, width: 50, height: 90, fill: '#ff0000' })] };
    const output = await render(d, t, [], new Store('unused'), 'production');
    const sample = async (x: number, y: number) => (await sharp(output).ensureAlpha().extract({ left: Math.round(x * 300 / 25.4), top: Math.round(y * 300 / 25.4), width: 1, height: 1 }).raw().toBuffer())[3];
    assert.equal(await sample(25, 5 + a.heightMm / 2), 0, a.id);
    assert.equal(await sample(0, 0), 0);
    assert.equal(await sample(4, 1), 255);
    if (a.shape === 'circle') assert.equal(await sample((50 - a.widthMm) / 2 + 0.1, 5.1), 255, 'circle bounding-box corner keeps ink');
  }
});

test('round holes follow left center right in the current orientation', async () => {
  const t = templates.find(t => t.id === 'acrylic-badge-v1')!;
  for (const orientation of ['portrait', 'landscape'] as const) for (const position of ['left', 'center', 'right'] as const) {
    const d = { ...emptyDesign(t), orientation, slot: { enabled: true, shape: 'circle' as const, widthMm: 3, heightMm: 3, position }, layers: [newLayer('shape', { shape: 'rect', x: 0, y: 0, width: 100, height: 100 })] };
    const slot = slotGeometry(d, t)!, w = orientation === 'portrait' ? 50 : 90;
    assert.equal(slot.x, position === 'left' ? 5 : position === 'right' ? w - 8 : (w - 3) / 2); assert.equal(slot.y, 5);
    const png = await render(d, t, [], new Store('unused'), 'production');
    const pixel = await sharp(png).ensureAlpha().extract({ left: Math.round((slot.x + 1.5) * 300 / 25.4), top: Math.round(6.5 * 300 / 25.4), width: 1, height: 1 }).raw().toBuffer();
    assert.equal(pixel[3], 0);
  }
});

test('photo holder saves options and exports only purchased photo printing without changing confirmed versions', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wanshi-holder-')), app = await createApp(root), server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  const url = `http://127.0.0.1:${(server.address() as any).port}/api`;
  let cookie = '';
  const req = (route: string, method = 'GET', body?: unknown) => fetch(url + route, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  try {
    const session = await req('/session', 'POST'); cookie = session.headers.get('set-cookie')!.split(';')[0];
    const t = templates.find(t => t.presentation === 'photo-holder')!;
    let d = emptyDesign(t);
    assert.deepEqual(dimensions(d, t), { w: 50, h: 76, fullW: 50, fullH: 76 });
    assert.deepEqual(dimensions({ ...d, sizeId: 'instax-mini', orientation: 'landscape' }, t), { w: 86, h: 54, fullW: 86, fullH: 54 });
    assert.equal((await req('/designs', 'POST', d)).status, 201);
    const first = await (await req(`/designs/${d.id}/confirm`, 'POST', { revision: 1 })).json();
    const ownZip = unzip(Buffer.from(await (await req(`/versions/${first.id}/package.zip`)).arrayBuffer()));
    assert.ok(ownZip.has('final-preview.png'));
    assert.ok(!ownZip.has('photo-print.png') && !ownZip.has('production-with-bleed.png'));
    assert.equal(JSON.parse(ownZip.get('photo-holder-options.json')!.toString()).printPhoto, false);
    d = { ...d, sizeId: 'instax-mini', photoHolder: { base: true, nfc: true, photoService: 'print' } };
    assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: d, baseRevision: 1 })).status, 200);
    assert.equal((await req(`/designs/${d.id}/confirm`, 'POST', { revision: 2 })).status, 400);
    d.layers = [newLayer('shape', { x: 0, y: 0, width: 54, height: 86, shape: 'rect', fill: '#ff0000' })];
    assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: d, baseRevision: 2 })).status, 200);
    const v = await (await req(`/designs/${d.id}/confirm`, 'POST', { revision: 3 })).json();
    const pack = unzip(Buffer.from(await (await req(`/versions/${v.id}/package.zip`)).arrayBuffer()));
    const options = JSON.parse(pack.get('photo-holder-options.json')!.toString());
    assert.equal(options.desktopBase, true); assert.equal(options.rearNfc, true); assert.equal(options.printPhoto, true);
    assert.deepEqual(options.paperSizeMm, { width: 54, height: 86 }); assert.equal(options.frameDimensionsMm, null);
    const meta = await sharp(pack.get('photo-print.png')!).metadata();
    assert.equal(meta.width, Math.round(54 * 300 / 25.4)); assert.equal(meta.height, Math.round(86 * 300 / 25.4));
    assert.deepEqual((await (await req(`/designs/${d.id}`)).json()).design.photoHolder, d.photoHolder);
    assert.deepEqual((await (await req(`/versions/${first.id}`)).json()).design.photoHolder, { base: false, nfc: false, photoService: 'own' });
    assert.ok(!unzip(Buffer.from(await (await req(`/versions/${first.id}/package.zip`)).arrayBuffer())).has('photo-print.png'));
  } finally { await new Promise<void>(r => server.close(() => r())); await rm(root, { recursive: true, force: true }); }
});

test('photo borders match preview and production while full paper remains printable', async () => {
  const t = templates.find(t => t.presentation === 'photo-holder')!;
  const store = new Store(tmpdir());
  for (const orientation of ['portrait', 'landscape'] as const) {
    for (const sizeId of ['instax-mini', 'small-photo']) {
      for (const paperLayout of ['full', 'border'] as const) {
        const d = { ...emptyDesign(t), sizeId, orientation, photoHolder: { base: false, nfc: false, photoService: 'print' as const, paperLayout } };
        const { w, h } = dimensions(d, t);
        d.layers = [newLayer('shape', { x: 0, y: 0, width: w, height: h, shape: 'rect', fill: '#ff0000' })];
        for (const mode of ['preview', 'production'] as const) {
          const { data, info } = await sharp(await render(d, t, [], store, mode, false)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          const pixel = (x: number, y: number) => [...data.subarray((Math.round(y * 300 / 25.4) * info.width + Math.round(x * 300 / 25.4)) * 4, (Math.round(y * 300 / 25.4) * info.width + Math.round(x * 300 / 25.4)) * 4 + 4)];
          assert.deepEqual(pixel(1, 1), sizeId === 'small-photo' && paperLayout === 'full' ? [255, 0, 0, 255] : [255, 255, 255, 255]);
          assert.deepEqual(pixel(w / 2, h / 2), [255, 0, 0, 255]);
        }
      }
    }
  }
});


test('photo paper uses matching instax margins and rotates the image boundary', () => {
  const t = templates.find(t => t.presentation === 'photo-holder')!;
  const d = { ...emptyDesign(t), photoHolder: { base: false, nfc: false, photoService: 'own' as const, paperLayout: 'border' as const } };
  assert.deepEqual(photoImageArea(d, t), { x: 4, y: 7, width: 42, height: 52 });
  assert.deepEqual(photoImageArea({ ...d, sizeId: 'instax-mini' }, t), { x: 4, y: 7, width: 46, height: 62 });
  assert.deepEqual(photoImageArea({ ...d, orientation: 'landscape' }, t), { x: 17, y: 4, width: 52, height: 42 });
  assert.deepEqual(photoImageArea({ ...d, photoHolder: { ...d.photoHolder, paperLayout: 'full' } }, t), { x: 0, y: 0, width: 50, height: 76 });
});
