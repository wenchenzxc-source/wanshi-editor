export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api${url}`, { ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers } });
  if (!r.ok) { const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` })); throw new ApiError(r.status, err.error); }
  return r.json();
}
