import { useRef, useState } from 'react';
import type { DesignLayer } from '../shared/model';
type Drag = { id: string; startY: number; delta: number; target: string; centers: { id: string; y: number; height: number }[] };
export function LayerWindow({ layers, selected, select, patch, reorder, disabled }: { layers: DesignLayer[]; selected: string | null; select: (id: string) => void; patch: (patch: Partial<DesignLayer>, id: string) => void; reorder: (from: string, to: string) => void; disabled: boolean }) {
  const [collapsed, collapse] = useState(false), [drag, setDrag] = useState<Drag | null>(null), [announcement, announce] = useState('');
  const dragRef = useRef<Drag | null>(null), list = useRef<HTMLDivElement>(null);
  const ordered = [...layers].reverse();
  function finish(cancel = false) {
    const current = dragRef.current;
    if (!cancel && current && current.id !== current.target) { reorder(current.id, current.target); announce('圖層順序已更新'); }
    dragRef.current = null; setDrag(null);
  }
  return <section className="floating-layers" aria-label="圖層管理">
    <div className="layer-window-heading"><strong>圖層管理 <span>{layers.length}</span></strong><button aria-label={collapsed ? '展開圖層' : '收合圖層'} aria-expanded={!collapsed} onClick={() => collapse(!collapsed)}>{collapsed ? '展開 ＋' : '收合 −'}</button></div>
    {!collapsed && <><small>拖曳左側把手排序 · 最上方顯示在最前面</small><div ref={list} className="floating-layer-list">{ordered.map(l => {
      const from = drag ? ordered.findIndex(x => x.id === drag.id) : -1, to = drag ? ordered.findIndex(x => x.id === drag.target) : -1, index = ordered.indexOf(l);
      const step = drag?.centers[from]?.height || 0;
      const offset = drag?.id === l.id ? drag.delta : from < to && index > from && index <= to ? -step : from > to && index >= to && index < from ? step : 0;
      return <div data-layer-id={l.id} key={l.id} style={{ transform: `translateY(${offset}px)` }} className={`layer-row ${selected === l.id ? 'selected' : ''} ${drag?.id === l.id ? 'dragging' : ''}`}>
        <button className="layer-grip" aria-label={`拖曳排序 ${l.name}`} disabled={disabled || l.locked} onKeyDown={e => { if (e.key === 'Escape') finish(true); }} onPointerDown={e => {
          if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); select(l.id);
          const centers = [...list.current!.querySelectorAll<HTMLElement>('[data-layer-id]')].map(row => { const rect = row.getBoundingClientRect(); return { id: row.dataset.layerId!, y: rect.y + rect.height / 2, height: rect.height + 6 }; });
          const current = { id: l.id, startY: e.clientY, delta: 0, target: l.id, centers }; dragRef.current = current; setDrag(current);
        }} onPointerMove={e => {
          const current = dragRef.current; if (!current) return;
          const origin = current.centers.find(c => c.id === current.id)!;
          const delta = Math.max(current.centers[0].y - origin.y, Math.min(current.centers.at(-1)!.y - origin.y, e.clientY - current.startY));
          const target = [...current.centers].sort((a,b) => Math.abs(a.y - origin.y - delta) - Math.abs(b.y - origin.y - delta))[0].id;
          const next = { ...current, delta, target }; dragRef.current = next; setDrag(next);
        }} onPointerUp={() => finish()} onPointerCancel={() => finish(true)} onLostPointerCapture={() => { if (dragRef.current) finish(true); }}>⠿</button>
        <button className="layer-select" title={l.kind === 'stroke' ? '自由筆刷畫出的線條；橡皮擦不會建立圖層' : l.name} onClick={() => select(l.id)}><span className="layer-kind" aria-hidden="true">{l.kind === 'image' ? '▧' : l.kind === 'text' ? 'T' : l.kind === 'stroke' ? '〰' : '✧'}</span><span className="layer-name">{l.name}</span></button>
        <button aria-label={`${l.visible ? '隱藏' : '顯示'} ${l.name}`} disabled={disabled} onClick={() => patch({ visible: !l.visible }, l.id)}>{l.visible ? '◉' : '○'}</button><button aria-label={`${l.locked ? '解鎖' : '鎖定'} ${l.name}`} disabled={disabled || l.kind === 'frame'} onClick={() => patch({ locked: !l.locked }, l.id)}>{l.locked ? '🔒' : '◇'}</button>
        <button aria-label={`上移 ${l.name}`} disabled={disabled || l.locked || index === 0} onClick={() => reorder(l.id, ordered[index - 1].id)}>↑</button><button aria-label={`下移 ${l.name}`} disabled={disabled || l.locked || index === ordered.length - 1} onClick={() => reorder(l.id, ordered[index + 1].id)}>↓</button>
      </div>;
    })}</div>{!layers.length && <p className="layers-empty">這一面還沒有圖層，上傳圖片或加入文字開始設計。</p>}</>}
    <span className="sr-only" role="status">{announcement}</span>
  </section>;
}
