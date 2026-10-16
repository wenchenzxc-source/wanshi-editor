import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import sharp from 'sharp';
import { createApp } from '../server/app';
import { emptyDesign, newLayer, dimensions, templates, type Asset } from '../shared/model';
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
    const d = emptyDesign(); assert.equal((await req('/designs', 'POST', d)).status, 201);
    const png = await sharp({ create: { width: 240, height: 160, channels: 4, background: '#ef3344' } }).png().toBuffer();
    const jpg = await sharp(png).jpeg().toBuffer(), webp = await sharp(png).webp().toBuffer();
    const form = new FormData();
    for (const [name, bytes] of [['test.png', png], ['test.jpg', jpg], ['test.webp', webp]] as const) form.append('files', new Blob([new Uint8Array(bytes)]), name);
    const upload = await req(`/designs/${d.id}/assets`, 'POST', form); assert.equal(upload.status, 201); const assets: Asset[] = await upload.json(); assert.equal(assets.length, 3);
    const spoofed = new FormData(); spoofed.append('files', new Blob(['<svg/>'], { type: 'image/png' }), 'fake.png');
    assert.notEqual((await req(`/designs/${d.id}/assets`, 'POST', spoofed)).status, 201);
    assert.deepEqual(Buffer.from(await (await req(`/assets/${assets[0].id}?original=1`)).arrayBuffer()), png);
    assert.equal((await req(`/assets/${assets[0].id}/remove-background`, 'POST')).status, 503);
    d.layers = [newLayer('image', { assetId: assets[0].id, x: 12.5, y: 30.25, width: 45, height: 30, rotation: 13.5 }), newLayer('text', { text: '中文測試\nHello', fontSize: 8, x: 20, y: 80, height: 40 }), newLayer('uv', { shape: 'circle', x: 50, y: 140, width: 20, height: 20, opacity: 0.5 })];
    const save = await req(`/designs/${d.id}`, 'PUT', { design: d, baseRevision: 1 }); assert.equal(save.status, 200);
    assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: d, baseRevision: 1 })).status, 409);
    assert.equal((await req(`/designs/${d.id}/confirm`, 'POST', { revision: 1 })).status, 409);
    assert.deepEqual((await (await req(`/designs/${d.id}`)).json()).design, d);
    const confirm = await req(`/designs/${d.id}/confirm`, 'POST', { revision: 2 }); assert.equal(confirm.status, 201); const v = await confirm.json();
    const zip = unzip(Buffer.from(await (await req(`/versions/${v.id}/package.zip`)).arrayBuffer()));
    assert.deepEqual(JSON.parse(zip.get('design.json')!.toString()), d);
    assert.deepEqual(zip.get(`originals/${assets[0].id}.png`), png);
    assert.deepEqual(zip.get(`originals/${assets[1].id}.jpg`), jpg);
    assert.deepEqual(zip.get(`originals/${assets[2].id}.webp`), webp);
    const production = await sharp(zip.get('production-with-bleed.png')).metadata();
    assert.equal(production.width, Math.round(154 / 25.4 * 300)); assert.equal(production.height, Math.round(216 / 25.4 * 300)); assert.equal(production.density, 300);
    const preview = await sharp(zip.get('final-preview.png')).metadata(); assert.equal(preview.width, Math.round(148 / 25.4 * 300)); assert.equal(preview.height, Math.round(210 / 25.4 * 300));
    const mask = await sharp(zip.get('uv-mask.png')).raw().toBuffer({ resolveWithObject: true });
    const px = Math.round(63 / 25.4 * 300), py = Math.round(153 / 25.4 * 300), gray = mask.data[(py * mask.info.width + px) * mask.info.channels]; assert.ok(gray >= 126 && gray <= 129); assert.equal(mask.data[0], 0);
    const originalVersion = await (await req(`/versions/${v.id}`)).json();
    d.layers[0].x = 92; d.orientation = 'landscape'; d.orderItemId = 'wc-item-777';
    assert.equal((await req(`/designs/${d.id}`, 'PUT', { design: d, baseRevision: 2 })).status, 200);
    assert.deepEqual(await (await req(`/versions/${v.id}`)).json(), originalVersion);
    const zip2 = unzip(Buffer.from(await (await req(`/versions/${v.id}/package.zip`)).arrayBuffer()));
    for (const [key, value] of zip) assert.deepEqual(zip2.get(key), value, `${key} must remain immutable`);
    const v2 = await (await req(`/designs/${d.id}/confirm`, 'POST', { revision: 3 })).json();
    const landscape = await sharp(Buffer.from(await (await req(`/versions/${v2.id}/preview.png`)).arrayBuffer())).metadata(); assert.equal(landscape.width, preview.height); assert.equal(landscape.height, preview.width);
    const otherSession = await fetch(url + '/session', { method: 'POST' }); cookie = otherSession.headers.get('set-cookie')!.split(';')[0];
    for (const route of [`/designs/${d.id}`, `/assets/${assets[0].id}`, `/versions/${v.id}`, `/versions/${v.id}/package.zip`]) assert.equal((await req(route)).status, 404);
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
