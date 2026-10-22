import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseStore } from '../server/store';

test('Supabase store keeps metadata private and uses signed storage URLs', async () => {
  const originalFetch = globalThis.fetch, calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input); calls.push({ url, init });
    if (url.includes('/object/upload/sign/')) return new Response(JSON.stringify({ url: '/object/upload/sign/wanshi-private/files/asset.bin?token=upload-token' }), { status: 200 });
    if (url.includes('/object/sign/')) return new Response(JSON.stringify({ signedURL: '/object/sign/wanshi-private/files/asset.bin?token=download-token' }), { status: 200 });
    if (url.includes('/rpc/wanshi_compare_and_swap')) return new Response('true', { status: 200 });
    if (url.includes('/storage/v1/object/wanshi-private/') && (!init?.method || init.method === 'GET')) return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    if (url.includes('bucket=eq.assets')) return new Response(JSON.stringify([{ value: { id: 'asset' } }]), { status: 200 });
    if (url.includes('bucket=eq.drafts')) return new Response(JSON.stringify([{ value: { revision: 2 } }]), { status: 200 });
    return new Response(init?.method === 'DELETE' ? '{}' : '[]', { status: init?.method === 'POST' ? 201 : 200 });
  };
  try {
    const store = new SupabaseStore('https://project.supabase.co/', 'sb_secret_test');
    await store.init();
    assert.deepEqual(await store.get('drafts', 'draft-id'), { revision: 2 });
    assert.deepEqual(await store.list('assets'), [{ id: 'asset' }]);
    await store.put('drafts', 'draft-id', { revision: 3 });
    await store.writeBlob('files', 'asset', 'bin', Buffer.from([1, 2, 3]), true, 'image/png');
    assert.deepEqual(await store.readBlob('files', 'asset', 'bin'), Buffer.from([1, 2, 3]));
    assert.equal((await store.createSignedUploadUrl('files', 'asset')).signedUrl, 'https://project.supabase.co/storage/v1/object/upload/sign/wanshi-private/files/asset.bin?token=upload-token');
    assert.equal(await store.signedDownloadUrl('files', 'asset'), 'https://project.supabase.co/storage/v1/object/sign/wanshi-private/files/asset.bin?token=download-token');
    assert.equal(await store.compareAndSwapDraft('draft-id', 'owner', 2, { revision: 3 }), true);
    assert.ok(calls.every(call => (call.init?.headers as Record<string, string> | undefined)?.Authorization === 'Bearer sb_secret_test'));
    assert.ok(calls.some(call => call.url.includes('/rest/v1/wanshi_objects')));
    assert.ok(calls.some(call => call.url.includes('/storage/v1/object/upload/sign/')));
  } finally { globalThis.fetch = originalFetch; }
});
