import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GoogleDriveClient } from '../server/drive';
import { createApp } from '../server/app';
import { enqueueDriveJob, paidWooCommerceOrder, runDriveJob } from '../server/order-sync';
import { Store } from '../server/store';
import { emptyDesign, templates } from '../shared/model';

test('paid WooCommerce webhook queues one immutable version and Drive retry remains idempotent', async () => {
  const versionId = randomUUID(), secret = 'test-webhook-secret';
  const payload = { id: 412, status: 'processing', date_paid_gmt: '2026-11-12T08:00:00',
    line_items: [{ id: 17, product_id: 55, meta_data: [{ key: '_wanshi_version_id', value: versionId }] }] };
  const raw = Buffer.from(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(raw).digest('base64');
  assert.throws(() => paidWooCommerceOrder(raw, 'wrong', secret, 'order.updated'), /簽章/);
  const unpaid = Buffer.from(JSON.stringify({ ...payload, status: 'pending' }));
  assert.equal(paidWooCommerceOrder(unpaid, createHmac('sha256', secret).update(unpaid).digest('base64'), secret, 'order.updated'), null);
  const job = paidWooCommerceOrder(raw, signature, secret, 'order.updated')!;
  assert.deepEqual(job.lines, [{ orderItemId: 17, productId: 55, versionId }]);
  const root = await mkdtemp(path.join(tmpdir(), 'wanshi-drive-job-')), store = new Store(root);
  await store.init();
  try {
    const design = emptyDesign();
    await store.put('versions', versionId, { id: versionId, design, template: templates[0], assets: [], createdAt: '2026-11-12T07:00:00' }, true);
    await store.writeBlob('files', `${versionId}-preview`, 'png', Buffer.from('preview'));
    await store.writeBlob('files', `${versionId}-production`, 'png', Buffer.from('production'));
    assert.equal((await enqueueDriveJob(store, job)).created, true);
    assert.equal((await enqueueDriveJob(store, job)).created, false);
    const uploaded: string[] = [];
    const fakeDrive = {
      rootFolderId: 'root', verifyTarget: async () => ({ id: 'root' }),
      folder: async (parent: string, name: string) => `${parent}/${name}`,
      file: async (_parent: string, name: string, _mime: string, _bytes: Buffer) => { uploaded.push(name); return name; },
    } as unknown as GoogleDriveClient;
    const result = await runDriveJob(store, job.id, () => fakeDrive);
    assert.equal(result?.status, 'complete');
    assert.ok(uploaded.includes('order.json'));
    assert.ok(uploaded.includes('design.json'));
    assert.ok(uploaded.includes('final-preview.png'));
    assert.ok(uploaded.includes('production-with-bleed.png'));
    assert.equal(await runDriveJob(store, job.id, () => fakeDrive), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Google Drive client uses OAuth refresh and a private resumable upload', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const http: typeof fetch = async (input, init) => {
    const url = String(input); calls.push({ url, init });
    if (url.endsWith('/token')) return new Response(JSON.stringify({ access_token: 'access-token' }));
    if (url.includes('/drive/v3/files/root?')) return new Response(JSON.stringify({ id: 'root', name: '訂單', mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: true } }));
    if (url.includes('uploadType=resumable')) return new Response('{}', { headers: { Location: 'https://www.googleapis.com/upload/session/123' } });
    if (url.includes('/drive/v3/files?')) return new Response(JSON.stringify({ files: [] }));
    if (url.includes('/upload/session/123')) return new Response(JSON.stringify({ id: 'created-file', name: 'art.png' }));
    throw new Error(`Unexpected request: ${url}`);
  };
  const drive = new GoogleDriveClient({ clientId: 'client', clientSecret: 'secret', refreshToken: 'refresh', folderId: 'root' }, http);
  assert.equal((await drive.verifyTarget()).id, 'root');
  assert.equal(await drive.file('root', 'art.png', 'image/png', Buffer.from([1, 2, 3])), 'created-file');
  assert.ok(calls.some(call => call.url.endsWith('/token') && String(call.init?.body).includes('grant_type=refresh_token')));
  assert.ok(calls.some(call => call.url.includes('uploadType=resumable')));
  assert.ok(calls.some(call => call.url.includes('/upload/session/123') && call.init?.method === 'PUT'));
});

test('WooCommerce webhook accepts signed paid orders without a browser session', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wanshi-woo-hook-'));
  const secret = 'test-woo-secret', previous = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
  process.env.WOOCOMMERCE_WEBHOOK_SECRET = secret;
  const store = new Store(root);
  const versionId = randomUUID();
  const app = await createApp(root, { store, studioToken: 'studio-token' });
  await store.put('versions', versionId, { id: versionId, design: emptyDesign(), template: templates[0], assets: [], createdAt: new Date().toISOString() }, true);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}/api/integrations/woocommerce/webhook`;
  try {
    const body = Buffer.from(JSON.stringify({ id: 89, status: 'processing', date_paid: '2026-11-12T08:00:00', line_items: [{ id: 5, product_id: 2, meta_data: [{ key: '_wanshi_version_id', value: versionId }] }] }));
    const headers = { 'Content-Type': 'application/json', 'X-WC-Webhook-Topic': 'order.updated', 'X-WC-Webhook-Signature': createHmac('sha256', secret).update(body).digest('base64') };
    assert.equal((await fetch(url, { method: 'POST', headers: { ...headers, 'X-WC-Webhook-Signature': 'bad' }, body })).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers, body })).status, 202);
    assert.equal((await store.get<{ status: string }>('drive-jobs', 'wc-89'))?.status, 'queued');
    assert.equal((await fetch(url, { method: 'POST', headers, body })).status, 202);
    assert.equal((await store.list('drive-jobs')).length, 1);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (previous === undefined) delete process.env.WOOCOMMERCE_WEBHOOK_SECRET; else process.env.WOOCOMMERCE_WEBHOOK_SECRET = previous;
    await rm(root, { recursive: true, force: true });
  }
});
