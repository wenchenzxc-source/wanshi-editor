export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
function readableError(value: unknown, status: number): string {
  if (typeof value !== 'string' || !value) return `連線失敗（${status}），請稍後重試。`;
  if (value === '找不到 API') return '目前執行的是舊版後端，請重新啟動編輯器伺服器後再試；素材尚未刪除。';
  if (/^\[\s*\{/.test(value)) {
    try {
      const issues: { path?: (string | number)[] }[] = JSON.parse(value);
      if (issues.some(issue => issue.path?.at(-1) === 'fontId')) return '字體與目前伺服器版本不相容。請重新啟動編輯器服務，然後重試儲存。';
      return '資料格式未通過檢查，請確認商品尺寸及編輯內容後重試。';
    } catch { return '資料格式未通過檢查，請稍後重試。'; }
  }
  return value;
}
export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  if (import.meta.env.VITE_STATIC_DEMO === 'true') {
    const { demoApi } = await import('./demoApi');
    return demoApi<T>(url, options);
  }
  const r = await fetch(`/api${url}`, { ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers } });
  if (!r.ok) { const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` })); throw new ApiError(r.status, readableError(err.error, r.status)); }
  return r.json();
}

export async function uploadAssets<T>(designId: string, files: File[], directUpload = false): Promise<T> {
  if (!directUpload || import.meta.env.VITE_STATIC_DEMO === 'true') {
    const form = new FormData(); for (const file of files) form.append('files', file);
    return api<T>(`/designs/${designId}/assets`, { method: 'POST', body: form });
  }
  const intents = await api<{ id: string; signedUrl: string }[]>(`/designs/${designId}/assets/upload-intents`, { method: 'POST', body: JSON.stringify({ files: files.map(file => ({ name: file.name, mime: file.type, size: file.size })) }) });
  await Promise.all(intents.map(async (intent, index) => {
    const form = new FormData(); form.append('cacheControl', '3600'); form.append('', files[index]);
    const response = await fetch(intent.signedUrl, { method: 'PUT', body: form });
    if (!response.ok) throw new ApiError(response.status, `圖片直傳失敗 (${response.status})，請重新選擇檔案`);
  }));
  return api<T>(`/designs/${designId}/assets/complete`, { method: 'POST', body: JSON.stringify({ ids: intents.map(intent => intent.id) }) });
}
