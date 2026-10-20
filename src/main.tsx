import { PrintStackPicker } from './PrintStackPicker';
import { fonts, getFont, type FontId } from '../shared/fonts';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, ApiError } from './api';
import { EditorCanvas, Preview, useImages } from './Canvas';
import { LayerWindow } from './LayerWindow';
import { ProductScene } from './ProductScene';
import { dimensions, emptyDesign, newLayer, materials, supportsDuplex, withPrintStack, stackLabel, resolveTemplate, type Material, type Asset, type Design, type DesignLayer, type Template, type VersionInfo } from '../shared/model';
import './styles.css';

type Loaded = { design: Design; revision: number; assets: Asset[]; versions: VersionInfo[] };
type Config = { templates: Template[]; backgroundRemoval: boolean };
type Saved = { id: string; name: string; updatedAt: string };
function App() {
  const [fontChoice, setFontChoice] = useState<FontId>('sans');
  const [config, setConfig] = useState<Config>(), [design, setDesign] = useState<Design>(), [assets, setAssets] = useState<Asset[]>([]), [versions, setVersions] = useState<VersionInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null), [transient, setTransient] = useState<DesignLayer | null>(null), [zoom, setZoom] = useState(1), [guides, setGuides] = useState(true);
  const [tab, setTab] = useState('uploads'), [savedList, setSavedList] = useState<Saved[]>([]), [showLibrary, setShowLibrary] = useState(false);
  const [status, setStatus] = useState('連線中…'), [error, setError] = useState(''), [busy, setBusy] = useState(false), [confirmation, setConfirmation] = useState(false), [readyFont, setReadyFont] = useState(false);
  const [history, setHistory] = useState<{ past: Design[]; future: Design[] }>({ past: [], future: [] });
  const designRef = useRef<Design | undefined>(undefined), revision = useRef(1), lastSaved = useRef(''), queue = useRef<Promise<unknown>>(Promise.resolve()), boot = useRef(false), fileInput = useRef<HTMLInputElement>(null);
  const { images, failed } = useImages(assets);
  const baseTemplate = config?.templates.find(t => t.id === design?.templateId);
  const template = baseTemplate && design ? resolveTemplate(design, baseTemplate) : undefined;
  const face = 'front';
  const faceLayers = design?.layers.filter(l => (l.face || 'front') === face) || [];
  const canvasDesign = design && { ...design, layers: faceLayers };
  const chosen = faceLayers.find(l => l.id === selected);
  const fitZoom = () => {
    if (!design || !template) return 1;
    const area = document.querySelector('.editor-area');
    const d = dimensions(design, template);
    const widthFit = ((area?.clientWidth || 600) - 104) / ((d.fullW + 24) * 2.6);
    return template.presentation === 'acrylic-block'
      ? Math.max(0.1, Math.min(10, widthFit, 440 / ((d.fullH + 24) * 2.6)))
      : Math.min(1, widthFit);
  };
  useEffect(() => {
    setZoom(fitZoom());
    const resize = () => setZoom(fitZoom());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [design?.id, design?.orientation, design?.sizeId, design?.customSize?.widthMm, design?.customSize?.heightMm, template?.id]);
  const retiredSize = template?.sizes?.find(size => size.id === design?.sizeId && size.retired);

  const preview = design && transient ? { ...design, layers: design.layers.map(l => l.id === transient.id ? transient : l) } : design;
  const applyLoaded = (loaded: Loaded) => { const original = JSON.stringify(loaded.design); loaded = { ...loaded, design: withPrintStack(loaded.design, loaded.design.printStack || (loaded.design.duplex ? 'cmyk-white-cmyk' : loaded.design.printView === 'acrylic' ? 'cmyk-white' : 'white-cmyk')) }; designRef.current = loaded.design; revision.current = loaded.revision; lastSaved.current = original; setDesign(loaded.design); setAssets(loaded.assets); setVersions(loaded.versions); setSelected(null); setHistory({ past: [], future: [] }); setStatus('所有變更已儲存'); localStorage.setItem('wanshi:last-design', loaded.design.id); };
  const report = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
  const save = useCallback((target?: Design) => {
    const task = async () => {
      const d = target || designRef.current; if (!d) throw new Error('尚未載入設計');
      if (lastSaved.current === JSON.stringify(d)) return revision.current;
      setStatus('儲存中…');
      try { const r = await api<{ revision: number }>(`/designs/${d.id}`, { method: 'PUT', body: JSON.stringify({ design: d, baseRevision: revision.current }) }); revision.current = r.revision; lastSaved.current = JSON.stringify(d); setStatus(JSON.stringify(designRef.current) === lastSaved.current ? '所有變更已儲存' : '有變更 · 等待儲存'); return r.revision; }
      catch (e) { setStatus('儲存失敗 · 請重試'); throw e; }
    };
    const next = queue.current.catch(() => {}).then(task); queue.current = next; return next;
  }, []);
  useEffect(() => {
    if (boot.current) return; boot.current = true;
    (async () => {
      await api('/session', { method: 'POST' }); const c = await api<Config>('/config'); setConfig(c);
      await Promise.all(fonts.map(async f => { const font = new FontFace(f.family, "url(/fonts/" + f.file + ")", { weight: f.id === 'sans' || f.id === 'serif' ? '100 900' : '400' }); await font.load(); document.fonts.add(font); })); setReadyFont(true);
      const id = localStorage.getItem('wanshi:last-design');
      if (id) { try { applyLoaded(await api<Loaded>(`/designs/${id}`)); return; } catch (e) { if (!(e instanceof ApiError && e.status === 404)) throw e; } }
      applyLoaded(await api<Loaded>('/designs', { method: 'POST', body: JSON.stringify(emptyDesign(c.templates[0])) }));
    })().catch(report);
  }, []);
  useEffect(() => { if (!design || busy) return; const timer = setTimeout(() => { save().catch(report); }, 900); return () => clearTimeout(timer); }, [design, busy, save]);
  useEffect(() => { const leave = (e: BeforeUnloadEvent) => { if (JSON.stringify(designRef.current) !== lastSaved.current) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave); }, []);
  function change(next: Design) { if (next.sizeId === 'custom' && next.customSize) { const c = next.customSize; next = { ...next, customSize: { ...c, thicknessMm: Math.min(c.thicknessMm, c.widthMm, c.heightMm, 50) } }; } const old = designRef.current!; if (JSON.stringify(old) === JSON.stringify(next)) return; setHistory(h => ({ past: [...h.past.slice(-79), old], future: [] })); designRef.current = next; setDesign(next); setStatus('有變更 · 等待儲存'); }
  function patchLayer(patch: Partial<DesignLayer>, id = selected) { if (!id || !designRef.current) return; change({ ...designRef.current, layers: designRef.current.layers.map(l => l.id === id ? { ...l, ...patch } : l) }); }
  function undo(redo = false) { const stack = redo ? history.future : history.past; if (!stack.length) return; const next = stack[stack.length - 1], current = designRef.current!; setHistory(h => redo ? { past: [...h.past, current], future: h.future.slice(0, -1) } : { past: h.past.slice(0, -1), future: [...h.future, current] }); designRef.current = next; setDesign(next); setSelected(null); setStatus('有變更 · 等待儲存'); }
  function fitNewLayer(layer: DesignLayer) { if (!template || !design) return layer; const { w, h } = dimensions(design, template); if (layer.x >= 0 && layer.y >= 0 && layer.x + layer.width <= w && layer.y + layer.height <= h) return layer; const ratio = Math.min(1, (w - 2 * template.safeMm) / layer.width, (h - 2 * template.safeMm) / layer.height); const width = layer.width * ratio, height = layer.height * ratio; return { ...layer, width, height, x: (w - width) / 2, y: (h - height) / 2, ...(layer.kind === 'text' ? { fontSize: Math.max(1, (layer.fontSize || 10) * ratio) } : {}) }; }
  function add(layer: DesignLayer) { layer = { ...fitNewLayer(layer), face }; change({ ...designRef.current!, layers: [...designRef.current!.layers, layer] }); setSelected(layer.id); }
  function remove() { if (!chosen || chosen.locked) return; change({ ...design!, layers: design!.layers.filter(l => l.id !== chosen.id) }); setSelected(null); }
  function duplicate() { if (chosen) add({ ...chosen, id: crypto.randomUUID(), name: chosen.name + ' 副本', x: chosen.x + 5, y: chosen.y + 5, locked: false }); }
  useEffect(() => { const key = (e: KeyboardEvent) => { if (busy || (e.target as HTMLElement).matches('input, textarea, select')) return; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(e.shiftKey); } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); undo(true); } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); } else if (chosen && !chosen.locked && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); const step = e.shiftKey ? 5 : 0.5; patchLayer({ x: chosen.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0), y: chosen.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0) }); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); });
  async function run(task: () => Promise<void>) { setBusy(true); setError(''); try { await task(); } catch (e) { report(e); } finally { setBusy(false); } }
  async function upload(files: FileList | File[]) {
    if (!files.length || busy) return;
    await run(async () => {
      const form = new FormData(); for (const f of Array.from(files)) form.append('files', f);
      const list = await api<Asset[]>(`/designs/${design!.id}/assets`, { method: 'POST', body: form }); setAssets(a => [...a, ...list]);
      const layers = list.map((a, i) => fitNewLayer(newLayer('image', { name: a.originalName, assetId: a.id, face, x: 20 + i * 7, y: 25 + i * 7, width: 85, height: 85 * a.height / a.width })));
      change({ ...designRef.current!, layers: [...designRef.current!.layers, ...layers] }); setSelected(layers.at(-1)!.id);
      await save(designRef.current);
    });
  }
  async function confirm() { await run(async () => { const r = await save(designRef.current); const v = await api<VersionInfo>(`/designs/${design!.id}/confirm`, { method: 'POST', body: JSON.stringify({ revision: r }) }); setVersions(vs => [...vs, v]); setConfirmation(false); setTab('versions'); }); }
  async function openDesign(id: string) { await run(async () => { await save(designRef.current); applyLoaded(await api<Loaded>(`/designs/${id}`)); setShowLibrary(false); }); }
  async function newDesign() { await run(async () => { await save(designRef.current); applyLoaded(await api<Loaded>('/designs', { method: 'POST', body: JSON.stringify(emptyDesign(config!.templates[0])) })); setShowLibrary(false); }); }
  async function restore(id: string) { await run(async () => { const v = await api<{ design: Design }>(`/versions/${id}`); change(withPrintStack(v.design, v.design.printStack || (v.design.duplex ? 'cmyk-white-cmyk' : v.design.printView === 'acrylic' ? 'cmyk-white' : 'white-cmyk'))); setSelected(null); await save(designRef.current); }); }
  async function cutout() { if (!chosen?.assetId) return; await run(async () => { const result = await api<Asset>(`/assets/${chosen.assetId}/remove-background`, { method: 'POST' }); setAssets(a => [...a, result]); patchLayer({ assetId: result.id }); await save(designRef.current); }); }
  const mm = design && template ? dimensions(design, template) : undefined;
  const selectedAsset = assets.find(a => a.id === chosen?.assetId);
  const effectiveDpi = selectedAsset && chosen ? Math.round(Math.min(selectedAsset.width / chosen.width, selectedAsset.height / chosen.height) * 25.4) : null;
  if (!design || !template || !readyFont) return <div className="loading"><div className="brand-symbol">萬</div><h1>萬事造物</h1><p>{error || '正在準備你的創作工作室…'}</p>{error && <button onClick={() => location.reload()}>重新連線</button>}</div>;
  return <div className="app">
    <header className="topbar"><a className="brand" href="#" onClick={e => e.preventDefault()}><span className="brand-symbol">萬</span><span>萬事造物<small>WANSHI STUDIO</small></span></a><span className="header-divider"/><div className="design-title"><input aria-label="設計名稱" value={design.name} maxLength={160} disabled={busy} onChange={e => change({ ...design, name: e.target.value || '未命名設計' })}/><span className="save-state" role="status"><i className={status.includes('失敗') ? 'bad' : ''}/>{status}</span></div><div className="header-actions"><button onClick={() => run(async () => { await save(); setSavedList(await api<Saved[]>('/designs')); setShowLibrary(true); })} disabled={busy}>我的設計</button><button className="primary" disabled={busy} onClick={() => setConfirmation(true)}>{busy ? '處理中…' : '確認與輸出'} <span>↗</span></button></div></header>
    {error && <div className="error" role="alert">{error}<button onClick={() => setError('')} aria-label="關閉錯誤">×</button><button onClick={() => save().catch(report)}>重試儲存</button></div>}
    {failed.length > 0 && <div className="error" role="alert">有 {failed.length} 張圖片載入失敗，請重新整理後再確認輸出。</div>}
    <div className="workspace">
      <nav className="rail" aria-label="素材面板">{[['uploads', '↥', '上傳'], ['text', 'T', '文字'], ['elements', '✿', '素材'], ['background', '◐', '底材'], ['versions', '◷', '版本']].map(([id, icon, name]) => <button key={id} aria-label={name} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><b>{icon}</b><span>{name}</span></button>)}</nav>
      <aside className={`asset-panel ${tab === 'background' ? 'material-panel' : ''}`}><div className="panel-heading"><span>{({ uploads: '你的圖片', text: '加入文字', elements: '裝飾與效果', background: '底材與列印效果', layers: '圖層管理', versions: '設計版本' } as Record<string, string>)[tab]}</span><small>{tab === 'layers' ? `${design.layers.length} 個圖層` : '創作工具'}</small></div>
        {tab === 'uploads' && <><p className="muted">讓喜歡的畫面，成為日常的一部分。</p><button className="upload-zone" disabled={busy} onClick={() => fileInput.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files); }}><span>＋</span><b>上傳圖片</b><small>點擊或拖入多張圖片<br/>JPG、PNG、WebP · 每張 20 MB</small></button><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-testid="file-upload" onChange={e => { if (e.target.files) upload(e.target.files); e.target.value = ''; }}/><div className="section-label">素材庫 <span>{assets.filter(a => !a.deletedAt).length}</span></div><div className="asset-grid">{assets.filter(a => !a.deletedAt).map(a => <div className="asset-tile" key={a.id}><button disabled={busy} title={a.originalName} onClick={() => add(newLayer('image', { assetId: a.id, name: a.originalName, width: 85, height: 85 * a.height / a.width }))}><img src={`/api/assets/${a.id}`} alt={a.originalName}/><small>{a.variant === 'cutout' ? '已去背' : '原始圖片'}</small></button><button className="asset-delete" aria-label={`刪除素材 ${a.originalName}`} disabled={busy} onClick={() => run(async () => { const updated = await api<Asset>(`/assets/${a.id}`, { method: 'DELETE' }); setAssets(old => old.map(item => item.id === a.id ? updated : item)); })}>×</button></div>)}</div>{!assets.some(a => !a.deletedAt) && <div className="empty-note">刪除只從素材庫移除，已使用圖層與確認版本的原檔保留。<br/>每張圖片都能獨立移動與編輯。</div>}<div className="tip"><b>小提示</b><p>選取圖片後，拖曳角落縮放，拖曳上方圓點旋轉。</p></div></>}
        {tab === 'text' && <><p className="muted">用一句話，留下你的故事。</p><label>新增文字字體<select aria-label="新增文字字體" value={fontChoice} disabled={busy} onChange={e => setFontChoice(e.target.value as FontId)}>{fonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><div className="font-sample" style={{ fontFamily: getFont(fontChoice).family }}>把喜歡，留在日常<br/>萬事造物 123 ABC</div><button className="text-preset" disabled={busy} onClick={() => add(newLayer('text', { fontId: fontChoice, name: '標題', text: '把喜歡，留在日常', fontSize: 10, width: 110, height: 30, fill: '#284a43', x: 19, y: 90 }))}>加入標題</button><button className="text-preset small" disabled={busy} onClick={() => add(newLayer('text', { fontId: fontChoice, name: '內文', text: '屬於你的美好時刻', fontSize: 5, width: 100, height: 25, fill: '#65736b', x: 24, y: 120 }))}>加入內文</button><p className="muted">內建 3 個開源繁中字體家族、5 種款式，採 SIL OFL 1.1 授權，可用於商業設計。選取文字後，可在右側切換字體。</p></>}
        {tab === 'elements' && <><p className="muted">為設計加上一點個性。</p><div className="section-label">基本裝飾</div><div className="element-grid">{[['petal', '❀', '花瓣'], ['star', '✦', '星芒'], ['circle', '●', '圓形'], ['rect', '■', '方形']].map(([shape, symbol, label]) => <button key={shape} disabled={busy} onClick={() => add(newLayer('shape', { shape: shape as DesignLayer['shape'], name: label }))}><b>{symbol}</b>{label}</button>)}</div><div className="section-label">UV 微浮雕</div><button className="uv-card" disabled={busy} onClick={() => add(newLayer('uv', { name: 'UV 花瓣', shape: 'petal', fill: '#d7ba89', width: 28, height: 42 }))}><span>✧</span><b>加入 UV 花瓣效果</b><small>獨立效果圖層與灰階遮罩</small></button><p className="muted">預覽為效果位置示意，不代表實際凸起高度。UV 圖層可在右側切換形狀。</p></>}
        {tab === 'background' && <><p className="muted">{template.presentation === 'acrylic-block' && '壓克力磚固定使用透明底材。'}選擇實際底材；底材色與光澤不會印入油墨製作圖。</p><div className="material-grid">{Object.entries(materials).filter(([id]) => !template.allowedMaterials || template.allowedMaterials.includes(id as Material)).map(([id, m]) => <button key={id} aria-pressed={design.material === id} disabled={busy} onClick={() => { change(withPrintStack({ ...design, material: id as Material }, !supportsDuplex(id as Material) && design.duplex ? 'white-cmyk' : design.printStack || 'white-cmyk')); setSelected(null); }}><i style={{ background: m.color }}/>{m.name}</button>)}</div>{!design.material && <p className="muted">此舊設計保留原背景，選擇底材即可更新。</p>}<PrintStackPicker value={design.printStack || 'white-cmyk'} disabled={busy} duplexAllowed={supportsDuplex(design.material)} onChange={stack => change(withPrintStack(design, stack))}/><p className="muted">同一份圖稿，切換油墨堆疊與觀看效果。雙面為中間白墨、兩側 CMYK，僅透明壓克力與炫彩可用。順序以由底材向外堆疊表示。</p>{design.layers.some(l => l.face === 'back') && <p className="muted">舊背面圖層保留於 JSON 備份，不納入目前這份圖稿的預覽及輸出。</p>}<p className="muted">預覽為效果示意；製作包保存圖稿與堆疊設定，白墨分色與鏡像由印廠依設備處理。</p></>}
        {tab === 'versions' && <><p className="muted">已確認版本獨立保存。繼續編輯草稿，不會改動既有製作包。</p><button disabled={busy} onClick={() => save().catch(report)}>立即儲存草稿</button>{[...versions].reverse().map((v, i) => <article className="version" key={v.id}><b>確認版本 {versions.length - i}</b><small>{new Date(v.createdAt).toLocaleString('zh-TW')}</small><a href={`/api/versions/${v.id}/package.zip`}>下載完整製作包 ↓</a><div className="row"><a href={`/api/versions/${v.id}/preview.png`} target="_blank" rel="noreferrer">查看確認圖</a><button disabled={busy} onClick={() => restore(v.id)}>載入為草稿</button></div></article>)}{!versions.length && <p className="empty-note">尚未確認設計。<br/>完成後點擊右上方「確認與輸出」。</p>}</>}
      </aside>
      <main className={`editor-area ${template.presentation === 'acrylic-block' ? 'block-editor' : ''}`}><LayerWindow layers={faceLayers} selected={selected} select={setSelected} patch={patchLayer} disabled={busy} reorder={(from, to) => { const layers = [...design.layers], a = layers.findIndex(l => l.id === from), b = layers.findIndex(l => l.id === to); if (a < 0 || b < 0 || layers[a].locked) return; const [item] = layers.splice(a, 1); layers.splice(b, 0, item); change({ ...design, layers }); }}/><div className="editor-toolbar"><div className="row"><button title="撤銷 Ctrl+Z" aria-label="撤銷" disabled={!history.past.length || busy} onClick={() => undo()}>↶</button><button title="重做 Ctrl+Shift+Z" aria-label="重做" disabled={!history.future.length || busy} onClick={() => undo(true)}>↷</button><span className="toolbar-separator"/><select aria-label="商品模板" value={design.templateId} disabled={busy} onChange={e => { const next = config!.templates.find(t => t.id === e.target.value)!; change(withPrintStack({ ...design, templateId: next.id, sizeId: next.sizes?.[0].id, customSize: undefined, material: next.allowedMaterials?.[0] || design.material }, design.printStack || 'white-cmyk')); setSelected(null); setTransient(null); }}>{config!.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><button className="orientation-toggle" aria-label={design.orientation === 'portrait' ? '切換為橫式' : '切換為直式'} title="點擊切換直式／橫式" disabled={busy} onClick={() => { change({ ...design, orientation: design.orientation === 'portrait' ? 'landscape' : 'portrait' }); setSelected(null); setTransient(null); }}><span aria-hidden="true">{design.orientation === 'portrait' ? '▯' : '▭'}</span>{design.orientation === 'portrait' ? '直式' : '橫式'}<span aria-hidden="true">⇄</span></button></div><label className="guide-toggle"><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)}/>輔助線</label></div>
        {template.sizes && <div className="product-size-bar"><label>壓克力磚尺寸<select aria-label="商品尺寸" value={design.sizeId || template.sizes[0].id} disabled={busy} onChange={e => { change({ ...design, sizeId: e.target.value, customSize: e.target.value === 'custom' ? design.customSize || { widthMm: template.widthMm, heightMm: template.heightMm, thicknessMm: template.thicknessMm || 20 } : undefined }); setSelected(null); setTransient(null); }}>{template.sizes.filter(size => !size.retired).map(size => <option key={size.id} value={size.id}>{size.name.split(' · ')[0]} · {design.orientation === 'portrait' ? size.widthMm : size.heightMm} × {design.orientation === 'portrait' ? size.heightMm : size.widthMm} × {size.thicknessMm} mm</option>)}{retiredSize && <option value={retiredSize.id}>其他尺寸（{design.orientation === 'portrait' ? retiredSize.widthMm : retiredSize.heightMm} × {design.orientation === 'portrait' ? retiredSize.heightMm : retiredSize.widthMm} mm・另外報價）</option>}{template.allowCustomSize && <option value="custom">其他尺寸（客人自行輸入・另外報價）</option>}</select></label>{design.sizeId === 'custom' && <small>每次 5 mm・長／高 20–250 mm、厚 5–{Math.min(50, mm!.w, mm!.h)} mm（不超過短邊）；輸入會就近對齊 5 mm・<strong>其他尺寸需另外報價</strong></small>}{retiredSize && <small>已保留既有排版尺寸；厚度未指定，請選「其他尺寸」填寫。</small>}<small>長 × 高 × 厚（mm）・依目前方向顯示</small></div>}<div className="canvas-heading"><span>DESIGN YOUR EVERYDAY</span><h1>把靈感，變成實物。</h1><p>{mm!.w} × {mm!.h} mm <span>／</span> {template.name}</p></div>
        <div className="dimension-workspace">
          <div className="dimension-horizontal"><span aria-hidden="true">↔</span>{design.sizeId === 'custom' && design.customSize ? <DimensionControl axis="長" label="長 (mm)" value={mm!.w} min={20} max={250} onChange={value => change({ ...design, customSize: { ...design.customSize!, [design.orientation === 'portrait' ? 'widthMm' : 'heightMm']: value } })}/> : <span>{template.presentation === 'acrylic-block' ? '長' : '寬'} {mm!.w} mm</span>}</div>
          <div className="dimension-canvas"><EditorCanvas design={canvasDesign!} template={template} images={images} selected={selected} select={setSelected} commit={l => patchLayer(l, l.id)} live={setTransient} zoom={zoom} guides={guides} disabled={busy || confirmation}/></div>
          <div className="dimension-vertical"><span aria-hidden="true">↕</span>{design.sizeId === 'custom' && design.customSize ? <DimensionControl vertical axis="高" label="高 (mm)" value={mm!.h} min={20} max={250} onChange={value => change({ ...design, customSize: { ...design.customSize!, [design.orientation === 'portrait' ? 'heightMm' : 'widthMm']: value } })}/> : <span>高<br/>{mm!.h} mm</span>}

          </div>
            {template.presentation === 'acrylic-block' && <div className="dimension-thickness">{design.sizeId === 'custom' && design.customSize ? <DimensionControl axis="厚" label="厚 (mm)" value={design.customSize.thicknessMm} min={5} max={Math.min(50, mm!.w, mm!.h)} onChange={value => change({ ...design, customSize: { ...design.customSize!, thicknessMm: value } })}/> : <span>厚<br/>{template.thicknessMm ?? '未指定'} mm</span>}</div>}
        </div>
        {!faceLayers.length && <p className="canvas-empty">← 上傳一張圖片，開始你的設計</p>}
        <div className="canvas-footer"><div className="legend"><span><i className="trim"/>{template.presentation === 'acrylic-block' ? '成品邊界' : '裁切線'}</span><span><i className="safe"/>{template.presentation === 'acrylic-block' ? '列印安全線' : '安全區'}（內縮 {template.safeMm} mm）</span><span>{template.presentation === 'acrylic-block' ? '現成底材・無出血' : `出血 ${template.bleedMm} mm`}</span></div><div className="zoom"><button aria-label="縮小工作區" onClick={() => setZoom(z => Math.max(0.1, z / 1.2))}>−</button><button onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><button aria-label="放大工作區" onClick={() => setZoom(z => Math.min(10, z * 1.2))}>＋</button><button onClick={() => setZoom(fitZoom())}>符合</button></div></div>
      </main>
      <aside className="right-panel"><div className="panel-heading"><span>成品預覽</span><small className="live-tag">● 即時同步</small></div><ProductScene design={preview!} template={template} images={images}/><div className="specs"><span>成品尺寸<b>{mm!.w} × {mm!.h} mm</b></span><span>加工設定<b>{template.dpi} DPI</b></span></div>
        <div className="inspector"><div className="panel-heading"><span>{chosen ? '圖層設定' : '開始你的創作'}</span>{chosen && <small>{chosen.kind === 'uv' ? 'UV 效果' : chosen.kind === 'image' ? '圖片' : chosen.kind === 'text' ? '文字' : '裝飾'}</small>}</div>
          {chosen ? <><label>圖層名稱<input value={chosen.name} disabled={busy || chosen.locked} onChange={e => patchLayer({ name: e.target.value })}/></label>{chosen.locked && <p className="muted">此圖層已鎖定。<button onClick={() => patchLayer({ locked: false })} disabled={busy}>解鎖</button></p>}<fieldset disabled={busy || chosen.locked}>
            {chosen.kind === 'text' && <><label>文字字體<select aria-label="文字字體" value={chosen.fontId || 'sans'} onChange={e => patchLayer({ fontId: e.target.value as FontId })}>{fonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>文字內容<textarea value={chosen.text || ''} onChange={e => patchLayer({ text: e.target.value })}/></label><Numeric label="字級 (mm)" value={chosen.fontSize || 10} min={1} max={200} onChange={fontSize => patchLayer({ fontSize })}/></>}
            <div className="input-grid">{(['x', 'y', 'width', 'height', 'rotation'] as const).map((key, i) => <Numeric key={key} label={['X (mm)', 'Y (mm)', '寬 (mm)', '高 (mm)', '旋轉 (°)'][i]} value={chosen[key]} min={key === 'width' || key === 'height' ? 0.1 : -1000} max={1000} onChange={v => patchLayer({ [key]: v })}/>)}</div>
            {chosen.kind !== 'image' && <label>顏色<input type="color" value={chosen.fill} onChange={e => patchLayer({ fill: e.target.value })}/></label>}
            {(chosen.kind === 'shape' || chosen.kind === 'uv') && <label>形狀<select value={chosen.shape} onChange={e => patchLayer({ shape: e.target.value as DesignLayer['shape'] })}><option value="petal">花瓣</option><option value="star">星芒</option><option value="circle">圓形</option><option value="rect">方形</option></select></label>}
            <label>{chosen.kind === 'uv' ? '效果強度' : '不透明度'} {Math.round(chosen.opacity * 100)}%<input type="range" min="0" max="1" step="0.01" value={chosen.opacity} onChange={e => patchLayer({ opacity: +e.target.value })}/></label>
            <div className="row"><button onClick={() => patchLayer({ x: (mm!.w - chosen.width) / 2, rotation: 0 })}>水平置中</button><button onClick={() => patchLayer({ y: (mm!.h - chosen.height) / 2, rotation: 0 })}>垂直置中</button></div>
            {chosen.kind === 'image' && <><button className="ai-button" disabled={!config?.backgroundRemoval} onClick={cutout}>✧ {config?.backgroundRemoval ? 'AI 一鍵去背' : 'AI 去背未啟用'}</button><small className="muted">{config?.backgroundRemoval ? '將圖片送往 remove.bg 處理；原圖完整保留。' : '需在伺服器設定 remove.bg 金鑰。'}</small>{selectedAsset?.sourceAssetId && <button onClick={() => patchLayer({ assetId: selectedAsset.sourceAssetId })}>還原原始圖片</button>}{effectiveDpi !== null && <p className={effectiveDpi < template.dpi ? 'resolution-warning' : 'muted'}>目前有效解析度：約 {effectiveDpi} DPI {effectiveDpi < template.dpi && '（低於模板設定）'}</p>}</>}
          </fieldset><div className="row layer-actions"><button onClick={duplicate} disabled={busy}>複製</button><button onClick={() => patchLayer({ locked: !chosen.locked })} disabled={busy}>{chosen.locked ? '解鎖' : '鎖定'}</button><button onClick={remove} disabled={busy || chosen.locked} className="danger">刪除</button></div></> : <p className="empty-note">點選畫布上的圖片、文字或裝飾，<br/>就能調整它的位置與樣式。</p>}
        </div>
      </aside>
    </div><footer className="app-footer"><span>萬事皆可造，日常皆有光。</span><span>獨立設計工作室 · 第一階段</span></footer>
    {showLibrary && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="我的設計"><div className="panel-heading"><h2>我的設計</h2><button onClick={() => setShowLibrary(false)}>關閉</button></div><button className="primary" disabled={busy} onClick={newDesign}>＋ 建立新設計</button>{savedList.map(d => <button className="saved-design" key={d.id} disabled={busy} onClick={() => openDesign(d.id)}><b>{d.name}</b><small>{new Date(d.updatedAt).toLocaleString('zh-TW')}</small></button>)}</section></div>}
    {confirmation && <div className="modal-backdrop"><section className="modal confirm-modal" role="dialog" aria-modal="true" aria-label="確認設計"><h2>讓設計，準備成形。</h2><p>確認後會保存不可覆寫的版本，並提供包含原圖、完整 JSON、排版圖與 UV 遮罩（若使用）的 ZIP。</p><p>印刷堆疊：{stackLabel(design)} · 同一份圖稿{template.thicknessMm && <> · 厚 {template.thicknessMm} mm</>}{design.sizeId === 'custom' && <><br/>其他尺寸：需另外報價，設計確認不代表報價已確認。</>}</p><div className="confirmation-preview"><Preview design={design} template={template} images={images}/></div><p className="muted">成品 {mm!.w} × {mm!.h} mm · 出血 {template.bleedMm} mm · {template.dpi} DPI<br/>安全區每邊內縮 {template.safeMm} mm；請檢查文字與圖片清晰度。安全線不會印出，也不會自動裁切圖稿。UV 預覽僅為效果示意。</p><div className="row"><button disabled={busy} onClick={() => setConfirmation(false)}>繼續編輯</button><button className="primary" disabled={busy || failed.length > 0 || design.layers.some(l => l.visible && l.assetId && !images.has(l.assetId))} onClick={confirm}>{busy ? '正在產生製作檔…' : '確認並建立製作包'}</button></div></section></div>}
  </div>;
}
function DimensionControl({ axis, vertical = false, ...props }: { axis: string; vertical?: boolean; label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return <div className={`dimension-control ${vertical ? 'vertical' : ''}`}>
    <Numeric {...props} step={5} snapOnBlur/>
    <input className="dimension-range" type="range" aria-label={`${axis}滑桿`} aria-orientation={vertical ? 'vertical' : 'horizontal'} aria-valuetext={`${props.value} mm`} min={props.min} max={props.max} step={5} value={props.value} onChange={e => props.onChange(Number(e.target.value))}/>
  </div>;
}
function Numeric({ label, value, min, max, onChange, step = 0.1, snapOnBlur = false }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; step?: number; snapOnBlur?: boolean }) {
  const [text, setText] = useState(value.toFixed(2).replace(/\.?0+$/, ''));
  useEffect(() => setText(String(Math.round(value * 100) / 100)), [value]);
  return <label>{label}<input type="number" step={step} min={min} max={max} value={text} onChange={e => { setText(e.target.value); const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n) && n >= min && n <= max && (!snapOnBlur || n % step === 0)) onChange(n); }} onBlur={() => { if (snapOnBlur && text.trim() && Number.isFinite(Number(text))) { const n = Math.max(min, Math.min(max, Math.round(Number(text) / step) * step)); setText(String(n)); if (n !== value) onChange(n); } else setText(String(Math.round(value * 100) / 100)); }}/></label>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);






