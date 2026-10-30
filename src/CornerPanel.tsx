import { useState } from 'react';
import { artCatalog, type Artwork } from '../shared/artwork';
import type { DesignLayer } from '../shared/model';
import { publicUrl, svgDataUrl } from './urls';

export type CornerPosition = NonNullable<DesignLayer['cornerPosition']>;
export const cornerPositions: { id: CornerPosition; name: string }[] = [
  { id: 'top-left', name: '左上角' },
  { id: 'top-right', name: '右上角' },
  { id: 'bottom-right', name: '右下角' },
  { id: 'bottom-left', name: '左下角' },
];
export const cornerCrop = .42;
const frames = artCatalog.filter(art => art.category === '圖框');

function CornerThumb({ art, position }: { art?: Artwork; position: CornerPosition }) {
  return <span className="corner-thumb" style={art ? {
    backgroundImage: `url("${art.file ? publicUrl(`artwork/${art.file}`) : svgDataUrl(art.svg || '')}")`,
    backgroundPosition: `${position.endsWith('left') ? 'left' : 'right'} ${position.startsWith('top') ? 'top' : 'bottom'}`,
  } : undefined}>{!art && '＋'}</span>;
}

export function CornerPanel({ layers, width, height, safe, disabled, onArtwork, onSize, onAll, onClear }: {
  layers: DesignLayer[];
  width: number;
  height: number;
  safe: number;
  disabled: boolean;
  onArtwork: (position: CornerPosition, artworkId: string) => void;
  onSize: (position: CornerPosition, size: number) => void;
  onAll: (artworkId: string) => void;
  onClear: () => void;
}) {
  const [allStyle, setAllStyle] = useState(frames[0]?.id || '');
  const maxSize = Math.max(5, Math.floor(Math.min(width, height) / 2 - safe));
  return <section className="corner-panel" aria-label="四角圖框設定">
    <p className="muted">四個角各自選圖案與大小。角落會跟著成品尺寸定位，圖案往內自然淡出。套用時會替換舊版整片圖框。</p>
    <div className="corner-all-controls"><label>四角同款<select aria-label="四角同款樣式" value={allStyle} onChange={event => setAllStyle(event.target.value)}>{frames.map(art => <option key={art.id} value={art.id}>{art.name}</option>)}</select></label><button disabled={disabled} onClick={() => onAll(allStyle)}>套用四角</button><button disabled={disabled || !layers.some(layer => layer.cornerPosition)} onClick={onClear}>清除四角</button></div>
    <div className="corner-cards">{cornerPositions.map(({ id, name }) => {
      const layer = layers.find(item => item.cornerPosition === id);
      const current = frames.find(art => art.id === layer?.cornerArtworkId);
      return <article key={id} className="corner-card"><details><summary><CornerThumb art={current} position={id}/><span><b>{name}</b><small>{current?.name || '未選擇圖案'}</small></span><span aria-hidden="true">⌄</span></summary><div className="corner-style-grid"><button aria-label={`${name}不使用`} aria-pressed={!layer} disabled={disabled} onClick={() => onArtwork(id, '')}><CornerThumb position={id}/><small>不使用</small></button>{frames.map(art => <button key={art.id} aria-label={`${name}${art.name}`} aria-pressed={layer?.cornerArtworkId === art.id} disabled={disabled} onClick={() => onArtwork(id, art.id)}><CornerThumb art={art} position={id}/><small>{art.name}</small></button>)}</div></details><label className="corner-size"><span>{name}大小 <output>{Math.round(layer?.width || Math.min(35, maxSize))} mm</output></span><input aria-label={`${name}大小`} type="range" min="5" max={maxSize} step="1" value={Math.min(maxSize, layer?.width || Math.min(35, maxSize))} disabled={disabled || !layer} onChange={event => onSize(id, +event.target.value)}/></label></article>;
    })}</div>
  </section>;
}
