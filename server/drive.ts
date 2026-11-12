import type { Asset, Design, Template } from '../shared/model';
import type { StoreLike } from './store';

export type PaidOrderLine = { orderItemId: number; productId: number; versionId: string };
export type DriveJob = {
  id: string;
  orderId: number;
  paidAt: string;
  lines: PaidOrderLine[];
  status: 'queued' | 'working' | 'failed' | 'complete';
  createdAt: string;
  leaseUntil?: number;
  nextRetryAt?: number;
  attempts?: number;
  folderId?: string;
  completedAt?: string;
  error?: string;
};

type Snapshot = { id: string; design: Design; template: Template; assets: Asset[]; createdAt: string };
type DriveConfig = { clientId: string; clientSecret: string; refreshToken: string; folderId: string };
type DriveFile = { id: string; name: string; mimeType?: string; capabilities?: { canAddChildren?: boolean } };

export function driveConfigFromEnv(env = process.env): DriveConfig | null {
  const clientId = env.GOOGLE_DRIVE_CLIENT_ID, clientSecret = env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = env.GOOGLE_DRIVE_REFRESH_TOKEN, folderId = env.GOOGLE_DRIVE_FOLDER_ID;
  return clientId && clientSecret && refreshToken && folderId ? { clientId, clientSecret, refreshToken, folderId } : null;
}

export class GoogleDriveClient {
  private accessToken?: string;
  constructor(private config: DriveConfig, private http: typeof fetch = fetch) {}

  private async token() {
    if (this.accessToken) return this.accessToken;
    const response = await this.http('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.config.clientId, client_secret: this.config.clientSecret, refresh_token: this.config.refreshToken, grant_type: 'refresh_token' }),
    });
    if (!response.ok) throw new Error(`Google OAuth 權杖更新失敗 (${response.status})`);
    const data = await response.json() as { access_token?: string };
    if (!data.access_token) throw new Error('Google OAuth 未回傳存取權杖');
    this.accessToken = data.access_token;
    return this.accessToken;
  }

  private async request(url: string, init: RequestInit = {}) {
    const make = async () => this.http(url, { ...init, headers: { Authorization: `Bearer ${await this.token()}`, ...init.headers } });
    let response = await make();
    if (response.status === 401) { this.accessToken = undefined; response = await make(); }
    if (!response.ok) throw new Error(`Google Drive ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return response;
  }

  async verifyTarget() {
    const response = await this.request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(this.config.folderId)}?fields=id,name,mimeType,capabilities(canAddChildren)&supportsAllDrives=true`);
    const folder = await response.json() as DriveFile;
    if (folder.mimeType !== 'application/vnd.google-apps.folder' || folder.capabilities?.canAddChildren === false) throw new Error('Google Drive 目標資料夾無法新增檔案');
    return folder;
  }

  private async child(parentId: string, name: string): Promise<DriveFile | null> {
    const q = `'${parentId.replace(/['\\]/g, '\\$&')}' in parents and name = '${name.replace(/['\\]/g, '\\$&')}' and trashed = false`;
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q); url.searchParams.set('fields', 'files(id,name,mimeType)');
    url.searchParams.set('pageSize', '100'); url.searchParams.set('supportsAllDrives', 'true'); url.searchParams.set('includeItemsFromAllDrives', 'true');
    const response = await this.request(url.toString());
    const data = await response.json() as { files?: DriveFile[] };
    return data.files?.find(file => file.name === name) || null;
  }

  async folder(parentId: string, name: string) {
    const existing = await this.child(parentId, name);
    if (existing) {
      if (existing.mimeType !== 'application/vnd.google-apps.folder') throw new Error(`Drive 同名項目不是資料夾：${name}`);
      return existing.id;
    }
    const response = await this.request('https://www.googleapis.com/drive/v3/files?fields=id,name', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
    });
    return (await response.json() as DriveFile).id;
  }

  async file(parentId: string, name: string, mimeType: string, bytes: Buffer) {
    const existing = await this.child(parentId, name);
    if (existing) return existing.id;
    const start = await this.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(bytes.length) },
      body: JSON.stringify({ name, mimeType, parents: [parentId] }),
    });
    const location = start.headers.get('location');
    if (!location || new URL(location).hostname !== 'www.googleapis.com') throw new Error('Google Drive 未提供有效的上傳位址');
    const upload = await this.http(location, {
      method: 'PUT', headers: { 'Content-Type': mimeType, 'Content-Length': String(bytes.length), Authorization: `Bearer ${await this.token()}` }, body: new Uint8Array(bytes),
    });
    if (!upload.ok) throw new Error(`Google Drive 上傳失敗 (${upload.status}): ${(await upload.text()).slice(0, 300)}`);
    return (await upload.json() as DriveFile).id;
  }

  get rootFolderId() { return this.config.folderId; }
}

export async function syncPaidOrder(job: DriveJob, store: StoreLike, drive: GoogleDriveClient) {
  await drive.verifyTarget();
  const orderFolder = await drive.folder(drive.rootFolderId, `訂單-${job.orderId}`);
  await drive.file(orderFolder, 'order.json', 'application/json', Buffer.from(JSON.stringify({ orderId: job.orderId, paidAt: job.paidAt, lines: job.lines }, null, 2)));
  for (const line of job.lines) {
    const snapshot = await store.get<Snapshot>('versions', line.versionId);
    if (!snapshot) throw new Error(`找不到確認版本 ${line.versionId}`);
    const folder = await drive.folder(orderFolder, `項目-${line.orderItemId}-${line.versionId}`);
    const json = (name: string, data: unknown) => drive.file(folder, name, 'application/json', Buffer.from(JSON.stringify(data, null, 2)));
    await json('design.json', snapshot.design);
    await json('manifest.json', { orderId: job.orderId, orderItemId: line.orderItemId, versionId: line.versionId, confirmedAt: snapshot.createdAt, template: snapshot.template, assets: snapshot.assets });
    const file = async (name: string, id: string, ext: string, mime = 'image/png') => drive.file(folder, name, mime, await store.readBlob('files', id, ext));
    await file('final-preview.png', `${line.versionId}-preview`, 'png');
    if (!snapshot.design.photoHolder || snapshot.design.photoHolder.photoService === 'print') {
      await file(snapshot.design.photoHolder ? 'photo-print.png' : 'production-with-bleed.png', `${line.versionId}-production`, 'png');
    }
    if (snapshot.design.layers.some(layer => layer.kind === 'uv' && layer.visible && layer.face !== 'back')) await file('uv-mask.png', `${line.versionId}-mask`, 'png');
    if (snapshot.design.duplex && !snapshot.design.printStack) {
      await file('back-final-preview.png', `${line.versionId}-back-preview`, 'png');
      await file('back-production-with-bleed.png', `${line.versionId}-back-production`, 'png');
      if (snapshot.design.layers.some(layer => layer.kind === 'uv' && layer.visible && layer.face === 'back')) await file('back-uv-mask.png', `${line.versionId}-back-mask`, 'png');
    }
    for (const asset of snapshot.assets) {
      const ext = asset.mime === 'image/jpeg' ? 'jpg' : asset.mime.split('/')[1];
      const assetFolder = await drive.folder(folder, asset.variant === 'original' ? 'originals' : 'cutouts');
      await drive.file(assetFolder, `${asset.id}.${ext}`, asset.mime, await store.readBlob('files', asset.id, 'bin'));
    }
  }
  return orderFolder;
}
