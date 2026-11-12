import { createHmac, timingSafeEqual } from 'node:crypto';
import { driveConfigFromEnv, GoogleDriveClient, syncPaidOrder, type DriveJob, type PaidOrderLine } from './drive.js';
import type { StoreLike } from './store.js';

const versionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function paidWooCommerceOrder(raw: Buffer, signature: string | undefined, secret: string, topic: string | undefined): DriveJob | null {
  if (!secret || !signature) throw new Error('WooCommerce 簽章或密鑰缺失');
  const expected = createHmac('sha256', secret).update(raw).digest();
  const received = Buffer.from(signature, 'base64');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error('WooCommerce 簽章無效');
  if (topic !== 'order.created' && topic !== 'order.updated') return null;
  const order = JSON.parse(raw.toString('utf8')) as {
    id?: number; status?: string; date_paid?: string | null; date_paid_gmt?: string | null;
    line_items?: { id?: number; product_id?: number; meta_data?: { key?: string; value?: unknown }[] }[];
  };
  if (!Number.isSafeInteger(order.id) || (order.id || 0) < 1) throw new Error('WooCommerce 訂單編號無效');
  if (!['processing', 'completed'].includes(order.status || '') || !(order.date_paid_gmt || order.date_paid)) return null;
  const lines: PaidOrderLine[] = [];
  for (const item of order.line_items || []) {
    const versionId = item.meta_data?.find(meta => meta.key === '_wanshi_version_id')?.value;
    if (versionId === undefined) continue;
    if (typeof versionId !== 'string' || !versionIdPattern.test(versionId) || !Number.isSafeInteger(item.id) || !Number.isSafeInteger(item.product_id)) throw new Error('WooCommerce 訂單的確認版本資料無效');
    lines.push({ orderItemId: item.id!, productId: item.product_id!, versionId });
  }
  if (!lines.length) return null;
  return { id: `wc-${order.id}`, orderId: order.id!, paidAt: order.date_paid_gmt || order.date_paid!, lines,
    status: 'queued', createdAt: new Date().toISOString() };
}

export async function enqueueDriveJob(store: StoreLike, job: DriveJob) {
  const existing = await store.get<DriveJob>('drive-jobs', job.id);
  if (existing) return { job: existing, created: false };
  try { await store.put('drive-jobs', job.id, job, true); return { job, created: true }; }
  catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
    const winner = await store.get<DriveJob>('drive-jobs', job.id);
    if (!winner) throw error;
    return { job: winner, created: false };
  }
}

export async function runDriveJob(store: StoreLike, id: string, makeDrive = () => {
  const config = driveConfigFromEnv();
  if (!config) throw new Error('尚未設定 Google Drive OAuth 與目標資料夾');
  return new GoogleDriveClient(config);
}) {
  const job = await store.claimDriveJob<DriveJob>(id, 360_000);
  if (!job) return null;
  try {
    const folderId = await syncPaidOrder(job, store, makeDrive());
    const complete: DriveJob = { ...job, status: 'complete', folderId, completedAt: new Date().toISOString(), leaseUntil: undefined, error: undefined };
    await store.put('drive-jobs', id, complete);
    return complete;
  } catch (error) {
    const failed: DriveJob = { ...job, status: 'failed', error: error instanceof Error ? error.message.slice(0, 300) : '未知錯誤',
      nextRetryAt: Date.now() + Math.min(3_600_000, 60_000 * 2 ** Math.min(job.attempts || 1, 6)), leaseUntil: undefined };
    await store.put('drive-jobs', id, failed);
    throw error;
  }
}

export async function runNextDriveJob(store: StoreLike) {
  const jobs = (await store.list<DriveJob>('drive-jobs')).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const job of jobs) {
    if (job.status === 'complete') continue;
    const result = await runDriveJob(store, job.id);
    if (result) return result;
  }
  return null;
}
