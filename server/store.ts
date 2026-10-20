import { mkdir, readFile, writeFile, rename, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export class Store {
  constructor(public root: string) {}
  file(bucket: string, id: string, ext = 'json') {
    if (!/^[a-z-]+$/.test(bucket) || !/^[a-zA-Z0-9-]+$/.test(id) || !/^[a-z]+$/.test(ext)) throw new Error('Invalid storage key');
    return path.join(this.root, bucket, `${id}.${ext}`);
  }
  async init() { for (const b of ['drafts', 'versions', 'assets', 'files', 'sessions']) await mkdir(path.join(this.root, b), { recursive: true }); }
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
  private queues = new Map<string, Promise<unknown>>();
  async exclusive<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(id) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn); this.queues.set(id, next);
    try { return await next; } finally { if (this.queues.get(id) === next) this.queues.delete(id); }
  }
}
