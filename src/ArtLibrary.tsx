import { useState, useEffect, useRef } from 'react';
import { drawFrame } from '../shared/frame';
import { newLayer, type DesignLayer } from '../shared/model';
import { artCatalog, artCategories } from '../shared/artwork';
export function ArtLibrary({ add, disabled }: { add: (id: string) => void; disabled: boolean }) {
  const [category, setCategory] = useState<string>('全部');
  const items = artCatalog.filter(a => category === '全部' || a.category === category || a.tags?.includes(category));
  return <section aria-label="原創素材庫"><p className="muted">花材與光影可自由排版；圖框一鍵貼合版面。</p><div className="art-categories" role="group" aria-label="素材分類">{artCategories.map(c => <button key={c} aria-pressed={c === category} onClick={() => setCategory(c)}>{c}</button>)}</div><div className="art-grid">{items.map(a => <button key={a.id} disabled={disabled} onClick={() => add(a.id)}><span className={`art-thumb ${a.category === '光影星芒' ? 'dark' : ''}`}>{a.category === '圖框' ? <FrameThumbnail id={a.id}/> : <img src={a.file ? `/artwork/${a.file}` : `/api/library/${a.id}.svg`} alt=""/>}</span><b>{a.name}{a.category === '圖框' && <small>套用到版面</small>}</b></button>)}</div><p className="muted">花材為 AI 生成去背圖；光影與圖框為原創繪製。可用於商品製作。節慶素材將依系列持續新增。</p></section>;
}

function FrameThumbnail({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const ctx = ref.current?.getContext('2d'); if (!ctx) return; ctx.clearRect(0, 0, 200, 200); drawFrame(ctx, newLayer('frame', { width: 200, height: 200, frameId: id as DesignLayer['frameId'] })); }, [id]);
  return <canvas ref={ref} width={200} height={200} aria-hidden="true" style={{ width: '100%', height: '100%' }}/>;
}
