import { artCatalog } from '../shared/artwork';
import { templates, type Asset, type Design } from '../shared/model';
import { ApiError } from './api';
import { publicUrl, svgDataUrl } from './urls';

type Draft = { design: Design; revision: number; updatedAt: string };
type Loaded = { design: Design; revision: number; assets: Asset[]; versions: [] };

const database = 'wanshi-pages-preview-v1';
let opening: Promise<IDBDatabase> | undefined;

function db() {
  return opening ||= new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('drafts', { keyPath: 'design.id' });
      request.result.createObjectStore('assets', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function all<T>(store: string): Promise<T[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction(store).objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction(store).objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put<T>(store: string, value: T): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction(store, 'readwrite').objectStore(store).put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

const json = (options: RequestInit) => options.body ? JSON.parse(String(options.body)) : {};
const assetsFor = async (designId: string) => (await all<Asset>('assets')).filter(asset => asset.designId === designId);

async function loaded(draft: Draft): Promise<Loaded> {
  return { design: draft.design, revision: draft.revision, assets: await assetsFor(draft.design.id), versions: [] };
}

async function dataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function imageSize(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new ApiError(400, '圖片無法解碼，請改用 JPG、PNG 或 WebP。'));
    image.src = url;
  });
}

async function draftFor(id: string) {
  const draft = await get<Draft>('drafts', id);
  if (!draft) throw new ApiError(404, '找不到設計');
  return draft;
}

export async function demoApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  if (url === '/session') return {} as T;
  if (url === '/config') return { templates, backgroundRemoval: false } as T;
  if (url === '/cart') return [] as T;
  if (url === '/designs' && method === 'GET') {
    return (await all<Draft>('drafts')).map(d => ({ id: d.design.id, name: d.design.name, updatedAt: d.updatedAt })) as T;
  }
  if (url === '/designs' && method === 'POST') {
    const design = json(options) as Design;
    const draft = { design, revision: 1, updatedAt: new Date().toISOString() };
    await put('drafts', draft);
    return loaded(draft) as T;
  }
  const designMatch = url.match(/^\/designs\/([^/]+)$/);
  if (designMatch && method === 'GET') return loaded(await draftFor(designMatch[1])) as T;
  if (designMatch && method === 'PUT') {
    const old = await draftFor(designMatch[1]);
    const input = json(options) as { design: Design; baseRevision: number };
    if (old.revision !== input.baseRevision) throw new ApiError(409, '其他分頁已更新此設計，請重新載入。');
    const draft = { design: input.design, revision: old.revision + 1, updatedAt: new Date().toISOString() };
    await put('drafts', draft);
    return { revision: draft.revision } as T;
  }
  const uploadMatch = url.match(/^\/designs\/([^/]+)\/assets$/);
  if (uploadMatch && method === 'POST' && options.body instanceof FormData) {
    await draftFor(uploadMatch[1]);
    const files = options.body.getAll('files').filter((entry): entry is File => entry instanceof File);
    const results: Asset[] = [];
    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new ApiError(400, '只接受 JPG、PNG、WebP 圖片');
      const previewUrl = await dataUrl(file);
      const size = await imageSize(previewUrl);
      const asset: Asset = { id: crypto.randomUUID(), designId: uploadMatch[1], originalName: file.name.slice(0, 160), mime: file.type, ...size, sha256: 'browser-preview', variant: 'original', previewUrl };
      await put('assets', asset); results.push(asset);
    }
    return results as T;
  }
  const libraryMatch = url.match(/^\/designs\/([^/]+)\/library$/);
  if (libraryMatch && method === 'POST') {
    await draftFor(libraryMatch[1]);
    const entry = artCatalog.find(a => a.id === json(options).artworkId);
    if (!entry) throw new ApiError(404, '找不到素材');
    const previewUrl = entry.file ? await dataUrl(await (await fetch(publicUrl(`artwork/${entry.file}`))).blob()) : svgDataUrl(entry.svg || '');
    const size = await imageSize(previewUrl);
    const asset: Asset = { id: crypto.randomUUID(), designId: libraryMatch[1], libraryArtworkId: entry.id, originalName: `${entry.name}.png`, mime: 'image/png', ...size, sha256: 'browser-preview', variant: 'original', previewUrl };
    await put('assets', asset);
    return asset as T;
  }
  const deleteMatch = url.match(/^\/assets\/([^/]+)$/);
  if (deleteMatch && method === 'DELETE') {
    const asset = await get<Asset>('assets', deleteMatch[1]);
    if (!asset) throw new ApiError(404, '找不到素材');
    const updated = { ...asset, deletedAt: asset.deletedAt || new Date().toISOString() };
    await put('assets', updated); return updated as T;
  }
  if (/\/confirm$/.test(url) || url.startsWith('/cart/')) {
    throw new ApiError(501, 'GitHub 線上預覽可使用完整排版與本機儲存；確認製作包與購物車需連接正式伺服器。');
  }
  if (/\/remove-background$/.test(url)) throw new ApiError(503, '線上預覽未啟用 AI 去背。');
  throw new ApiError(404, '線上預覽不支援這項伺服器功能');
}
