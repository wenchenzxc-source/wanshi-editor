import { useState, useEffect, useRef } from 'react';
import { drawFrame } from '../shared/frame';
import { newLayer, type DesignLayer } from '../shared/model';
import { artCatalog, artCategories } from '../shared/artwork';
import { publicUrl, svgDataUrl } from './urls';
export function ArtLibrary({ add, disabled }: { add: (id: string) => void; disabled: boolean }) {
  const [category, setCategory] = useState<string>('全部');
  const items = artCatalog.filter(a => category === '全部' || a.category === category || a.tags?.includes(category));
  return <section aria-label="原創素材庫"><p className="muted">花材、植物與手繪小物可自由排版；圖框一鍵貼合版面。</p><div className="art-categories" role="group" aria-label="素材分類">{artCategories.map(c => <button key={c} aria-pressed={c === category} onClick={() => setCategory(c)}>{c}</button>)}</div><div className="art-grid">{items.map(a => <button key={a.id} disabled={disabled} onClick={() => add(a.id)}><span className={`art-thumb ${a.category === '光影星芒' ? 'dark' : ''}`}>{a.category === '圖框' ? <FrameThumbnail id={a.id}/> : <img src={a.file ? publicUrl(`artwork/${a.file}`) : svgDataUrl(a.svg || '')} alt=""/>}</span><b>{a.name}{a.category === '圖框' && <small>套用到版面</small>}</b></button>)}</div><p className="muted">透明手繪圖為本專案原創生成；光影與圖框為原創繪製。可用於工作室及客戶商品製作，節慶系列會持續新增。</p></section>;
}

function FrameThumbnail({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const ctx = ref.current?.getContext('2d'); if (!ctx) return; ctx.clearRect(0, 0, 200, 200); drawFrame(ctx, newLayer('frame', { width: 200, height: 200, frameId: id as DesignLayer['frameId'] })); }, [id]);
  return <canvas ref={ref} width={200} height={200} aria-hidden="true" style={{ width: '100%', height: '100%' }}/>;
}
