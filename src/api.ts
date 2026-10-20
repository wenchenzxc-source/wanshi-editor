export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api${url}`, { ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers } });
  if (!r.ok) { const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` })); throw new ApiError(r.status, err.error === '找不到 API' ? '目前執行的是舊版後端，請重新啟動編輯器伺服器後再試；素材尚未刪除。' : err.error); }
  return r.json();
}
