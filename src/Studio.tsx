import { FormEvent, useEffect, useState } from 'react';
import './studio-admin.css';

type StudioJob = {
  id: string; createdAt: string; revision: number; designId: string; name: string; product: string;
  dimensions: { w: number; h: number }; orderItemId?: string | null; material?: string;
  photoHolder?: { base: boolean; nfc: boolean; photoService: string };
};

async function studioRequest<T>(url: string, options: RequestInit = {}) {
  const response = await fetch(`/api/studio${url}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || `HTTP ${response.status}`), { status: response.status });
  return body as T;
}

export function StudioApp() {
  const [jobs, setJobs] = useState<StudioJob[]>([]), [token, setToken] = useState('');
  const [authenticated, setAuthenticated] = useState(false), [busy, setBusy] = useState(true), [error, setError] = useState('');
  const load = async () => {
    setBusy(true); setError('');
    try { setJobs(await studioRequest<StudioJob[]>('/orders')); setAuthenticated(true); }
    catch (reason: any) { setAuthenticated(false); if (reason.status !== 401) setError(reason.message); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);
  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await studioRequest('/login', { method: 'POST', body: JSON.stringify({ token }) }); setToken(''); await load(); }
    catch (reason: any) { setError(reason.message); setBusy(false); }
  };
  const logout = async () => { setBusy(true); await studioRequest('/logout', { method: 'POST', body: '{}' }).catch(() => {}); setJobs([]); setAuthenticated(false); setBusy(false); };
  if (!authenticated) return <main className="studio-admin studio-login"><section><small>WANSHI PRODUCTION</small><h1>工作室製作後台</h1><p>只有工作室人員可以查看無浮水印圖稿與下載 600 PPI 製作包。</p><form onSubmit={login}><label>工作室密碼<input type="password" autoComplete="current-password" value={token} onChange={event => setToken(event.target.value)} required autoFocus/></label><button className="primary" disabled={busy || !token}>{busy ? '檢查中…' : '安全登入'}</button></form>{error && <p className="studio-error" role="alert">{error}</p>}<a href="/">返回客戶編輯器</a></section></main>;
  return <main className="studio-admin"><header><div><small>WANSHI PRODUCTION</small><h1>工作室製作後台</h1><p>確認版本保存在私有儲存空間；客戶端只會取得含浮水印的低解析預覽。</p></div><div><button onClick={() => void load()} disabled={busy}>重新整理</button><button onClick={() => void logout()} disabled={busy}>登出</button><a href="/">客戶編輯器</a></div></header>
    {error && <p className="studio-error" role="alert">{error}</p>}
    <section className="studio-summary"><b>{jobs.length}</b><span>個已確認製作版本</span></section>
    {!jobs.length && !busy && <section className="studio-empty"><h2>尚無製作版本</h2><p>客戶確認並加入購物車後，版本會出現在這裡。</p></section>}
    <section className="studio-jobs" aria-label="已確認製作版本">{jobs.map(job => <article key={job.id}>
      <img src={`/api/studio/versions/${job.id}/preview.png`} alt={`${job.product} 無浮水印工作室預覽`} draggable={false}/>
      <div><small>{new Date(job.createdAt).toLocaleString('zh-TW')}</small><h2>{job.name}</h2><p>{job.product} · {job.dimensions.w} × {job.dimensions.h} mm</p><p>版本 {job.revision}{job.orderItemId ? ` · 訂單 ${job.orderItemId}` : ' · 尚未綁定訂單'}</p>{job.photoHolder && <p>{job.photoHolder.photoService === 'print' ? '加購相片列印' : '客人自備照片'} · {job.photoHolder.base ? '含底座' : '無底座'} · {job.photoHolder.nfc ? '含 NFC' : '無 NFC'}</p>}</div>
      <a className="primary" href={`/api/versions/${job.id}/package.zip`}>下載 600 PPI 製作包</a>
    </article>)}</section>
  </main>;
}
