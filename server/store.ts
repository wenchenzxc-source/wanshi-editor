import { mkdir, readFile, writeFile, rename, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type SignedUpload = { signedUrl: string; token: string };
export interface StoreLike {
  init(): Promise<void>;
  get<T>(bucket: string, id: string): Promise<T | null>;
  put(bucket: string, id: string, value: unknown, immutable?: boolean): Promise<void>;
  list<T>(bucket: string): Promise<T[]>;
  exclusive<T>(id: string, fn: () => Promise<T>): Promise<T>;
  readBlob(bucket: string, id: string, ext?: string): Promise<Buffer>;
  writeBlob(bucket: string, id: string, ext: string, bytes: Buffer, immutable?: boolean, contentType?: string): Promise<void>;
  deleteBlob(bucket: string, id: string, ext?: string): Promise<void>;
  createSignedUploadUrl?(bucket: string, id: string, ext?: string): Promise<SignedUpload>;
  signedDownloadUrl?(bucket: string, id: string, ext?: string, expiresIn?: number): Promise<string>;
  compareAndSwapDraft?(id: string, owner: string, baseRevision: number, value: unknown): Promise<boolean>;
}

function validateKey(bucket: string, id: string, ext = 'json') {
  if (!/^[a-z-]+$/.test(bucket) || !/^[a-zA-Z0-9-]+$/.test(id) || !/^[a-z]+$/.test(ext)) throw new Error('Invalid storage key');
}

export class Store implements StoreLike {
  constructor(public root: string) {}
  file(bucket: string, id: string, ext = 'json') { validateKey(bucket, id, ext); return path.join(this.root, bucket, `${id}.${ext}`); }
  async init() { for (const b of ['drafts', 'versions', 'assets', 'files', 'sessions', 'carts', 'upload-intents']) await mkdir(path.join(this.root, b), { recursive: true }); }
  async get<T>(bucket: string, id: string): Promise<T | null> {
    try { return JSON.parse(await readFile(this.file(bucket, id), 'utf8')); }
    catch (e: any) { if (e.code === 'ENOENT') return null; throw e; }
  }
  async put(bucket: string, id: string, value: unknown, immutable = false) {
    if (immutable) { await writeFile(this.file(bucket, id), JSON.stringify(value), { flag: 'wx' }); return; }
    const temp = this.file(bucket, `${id}-${randomUUID()}`, 'tmp');
    await writeFile(temp, JSON.stringify(value));
    try {
      for (let attempt = 0; ; attempt++) {
        try { await rename(temp, this.file(bucket, id)); break; }
        catch (error: any) {
          if (process.platform !== 'win32' || !['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 5) throw error;
          await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        }
      }
    } finally { await unlink(temp).catch((e: any) => { if (e.code !== 'ENOENT') throw e; }); }
  }
  async list<T>(bucket: string): Promise<T[]> {
    const files = await readdir(path.join(this.root, bucket));
    return Promise.all(files.filter(f => /^[a-zA-Z0-9-]+\.json$/.test(f)).map(f => readFile(path.join(this.root, bucket, f), 'utf8').then(JSON.parse)));
  }
  async readBlob(bucket: string, id: string, ext = 'bin') { return readFile(this.file(bucket, id, ext)); }
  async writeBlob(bucket: string, id: string, ext: string, bytes: Buffer, immutable = false) { await writeFile(this.file(bucket, id, ext), bytes, immutable ? { flag: 'wx' } : undefined); }
  async deleteBlob(bucket: string, id: string, ext = 'bin') { await unlink(this.file(bucket, id, ext)).catch((e: any) => { if (e.code !== 'ENOENT') throw e; }); }
  private queues = new Map<string, Promise<unknown>>();
  async exclusive<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(id) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn); this.queues.set(id, next);
    try { return await next; } finally { if (this.queues.get(id) === next) this.queues.delete(id); }
  }
}

export class SupabaseStore implements StoreLike {
  private rest: string;
  private storage: string;
  private queues = new Map<string, Promise<unknown>>();
  constructor(private url: string, private secret: string, private storageBucket = 'wanshi-private') {
    this.url = url.replace(/\/$/, ''); this.rest = `${this.url}/rest/v1`; this.storage = `${this.url}/storage/v1`;
  }
  private headers(extra: Record<string, string> = {}) { return { apikey: this.secret, Authorization: `Bearer ${this.secret}`, ...extra }; }
  private objectPath(bucket: string, id: string, ext = 'bin') { validateKey(bucket, id, ext); return `${bucket}/${id}.${ext}`; }
  private async checked(response: Response) {
    if (response.ok) return response;
    const body = await response.text(); const error: any = new Error(`Supabase ${response.status}: ${body.slice(0, 500)}`);
    if (response.status === 409) error.code = 'EEXIST'; throw error;
  }
  async init() { await this.checked(await fetch(`${this.rest}/wanshi_objects?select=id&limit=1`, { headers: this.headers() })); }
  async get<T>(bucket: string, id: string): Promise<T | null> {
    validateKey(bucket, id);
    const response = await this.checked(await fetch(`${this.rest}/wanshi_objects?bucket=eq.${encodeURIComponent(bucket)}&id=eq.${encodeURIComponent(id)}&select=value&limit=1`, { headers: this.headers() }));
    const rows = await response.json() as { value: T }[]; return rows[0]?.value ?? null;
  }
  async put(bucket: string, id: string, value: unknown, immutable = false) {
    validateKey(bucket, id);
    const target = `${this.rest}/wanshi_objects${immutable ? '' : '?on_conflict=bucket,id'}`;
    await this.checked(await fetch(target, { method: 'POST', headers: this.headers({ 'Content-Type': 'application/json', Prefer: immutable ? 'return=minimal' : 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ bucket, id, value, updated_at: new Date().toISOString() }) }));
  }
  async list<T>(bucket: string): Promise<T[]> {
    validateKey(bucket, 'list');
    const response = await this.checked(await fetch(`${this.rest}/wanshi_objects?bucket=eq.${encodeURIComponent(bucket)}&select=value`, { headers: this.headers({ Range: '0-9999' }) }));
    return (await response.json() as { value: T }[]).map(row => row.value);
  }
  async readBlob(bucket: string, id: string, ext = 'bin') {
    const key = this.objectPath(bucket, id, ext);
    const response = await this.checked(await fetch(`${this.storage}/object/${this.storageBucket}/${key}`, { headers: this.headers() }));
    return Buffer.from(await response.arrayBuffer());
  }
  async writeBlob(bucket: string, id: string, ext: string, bytes: Buffer, immutable = false, contentType = 'application/octet-stream') {
    const key = this.objectPath(bucket, id, ext);
    await this.checked(await fetch(`${this.storage}/object/${this.storageBucket}/${key}`, { method: 'POST', headers: this.headers({ 'Content-Type': contentType, 'x-upsert': String(!immutable) }), body: new Uint8Array(bytes) }));
  }
  async deleteBlob(bucket: string, id: string, ext = 'bin') {
    const key = this.objectPath(bucket, id, ext);
    await this.checked(await fetch(`${this.storage}/object/${this.storageBucket}`, { method: 'DELETE', headers: this.headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ prefixes: [key] }) }));
  }
  async createSignedUploadUrl(bucket: string, id: string, ext = 'bin') {
    const key = this.objectPath(bucket, id, ext);
    const response = await this.checked(await fetch(`${this.storage}/object/upload/sign/${this.storageBucket}/${key}`, { method: 'POST', headers: this.headers({ 'Content-Type': 'application/json' }), body: '{}' }));
    const data = await response.json() as { url: string };
    const signedUrl = data.url.startsWith('http') ? data.url : `${this.storage}${data.url}`;
    const token = new URL(signedUrl).searchParams.get('token'); if (!token) throw new Error('Supabase 未回傳上傳 token');
    return { signedUrl, token };
  }
  async signedDownloadUrl(bucket: string, id: string, ext = 'bin', expiresIn = 300) {
    const key = this.objectPath(bucket, id, ext);
    const response = await this.checked(await fetch(`${this.storage}/object/sign/${this.storageBucket}/${key}`, { method: 'POST', headers: this.headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ expiresIn }) }));
    const data = await response.json() as { signedURL: string };
    return data.signedURL.startsWith('http') ? data.signedURL : `${this.storage}${data.signedURL}`;
  }
  async compareAndSwapDraft(id: string, owner: string, baseRevision: number, value: unknown) {
    const response = await this.checked(await fetch(`${this.rest}/rpc/wanshi_compare_and_swap`, { method: 'POST', headers: this.headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ p_id: id, p_owner: owner, p_base_revision: baseRevision, p_value: value }) }));
    return Boolean(await response.json());
  }
  async exclusive<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(id) || Promise.resolve(); const next = prev.catch(() => {}).then(fn); this.queues.set(id, next);
    try { return await next; } finally { if (this.queues.get(id) === next) this.queues.delete(id); }
  }
}

export function configuredStore(dataDir: string): StoreLike {
  const url = process.env.SUPABASE_URL, secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && secret) return new SupabaseStore(url, secret, process.env.SUPABASE_STORAGE_BUCKET || 'wanshi-private');
  return new Store(dataDir);
}
