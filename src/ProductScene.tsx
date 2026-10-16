import { useEffect, useState } from 'react';
import { Preview } from './Canvas';
import { PhotoScene, photoScenes, type PhotoSceneId } from './PhotoScene';
import type { Design, Template } from '../shared/model';
import './product-scene.css';
const scenes = [
  { id: 'bedside', name: '床頭櫃', caption: '讓喜歡的人與風景，陪伴每個晚安。' },
  { id: 'computer', name: '電腦桌', caption: '忙碌之間，也有讓你微笑的風景。' },
  { id: 'desk', name: '溫暖桌面', caption: '把珍藏的時刻，放在日常身旁。' },
  { id: 'wall', name: '居家牆面', caption: '把喜歡的日常，掛在眼前。' },
  { id: 'shelf', name: '生活層架', caption: '留一個角落，給你的美好收藏。' },
  { id: 'gallery', name: '藝廊展台', caption: '讓每一份珍藏，都成為焦點。' },
];
const finishes = [['oak', '原木框'], ['black', '霧黑框'], ['float', '無框']] as const;
function preference(key: string, allowed: string[], fallback: string) {
  try { const value = localStorage.getItem(key); return value && allowed.includes(value) ? value : fallback; } catch { return fallback; }
}
export function ProductScene({ design, template, images }: { design: Design; template: Template; images: Map<string, HTMLImageElement> }) {
  const [scene, setScene] = useState(() => preference('wanshi:preview-scene', scenes.map(s => s.id), 'bedside'));
  const [finish, setFinish] = useState(() => preference('wanshi:preview-finish', finishes.map(f => f[0]), 'oak'));
  const [expanded, setExpanded] = useState(false);
  const photo = scene in photoScenes;
  const active = scenes.find(s => s.id === scene)!;
  useEffect(() => { if (!expanded) return; const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [expanded]);
  const standing = scene !== 'wall';
  useEffect(() => { try { localStorage.setItem('wanshi:preview-scene', scene); localStorage.setItem('wanshi:preview-finish', finish); } catch { /* Storage is optional for preview. */ } }, [scene, finish]);
  return <section className="product-preview-panel" aria-label="商品情境預覽設定">
    <div className="scene-control-label">陳列場景 <span>{active.name}</span></div>
    <div className="scene-buttons" role="group" aria-label="切換預覽場景">
      {scenes.map(s => <button key={s.id} type="button" aria-pressed={scene === s.id} onClick={() => setScene(s.id)}><span className={`scene-thumbnail thumbnail-${s.id}`} style={s.id in photoScenes ? { backgroundImage: `url(${photoScenes[s.id as PhotoSceneId][design.orientation].src})` } : undefined} aria-hidden="true"><i/></span><span>{s.name}</span></button>)}
    </div>
    {photo ? <><PhotoScene scene={scene as PhotoSceneId} design={design} template={template} images={images}/><button className="photo-expand" onClick={() => setExpanded(true)}>⤢ 放大情境預覽</button><p className="photo-scene-detail">原木實景框 · 保留紙面光影與材質</p></> : <><div className={`product-room scene-${scene} ${standing ? 'scene-standing' : ''} finish-${finish} ${design.orientation}`} aria-label={`${active.name}情境預覽`}>
      <div className="room-window-light" aria-hidden="true"/>
      {scene === 'bedside' && <div className="bedside-props" aria-hidden="true"><div className="bed-headboard"/><div className="bed-pillow"/><div className="bed-duvet"/><div className="bedside-lamp"><i/><b/><span/></div></div>}
      {scene === 'computer' && <div className="computer-props" aria-hidden="true"><div className="desktop-monitor"><div className="monitor-screen"><i/><b/><span/></div><div className="monitor-stand"/></div><div className="desktop-keyboard"/><div className="desktop-mouse"/></div>}
      {standing && <><div className="desk-surface" aria-hidden="true"/><div className="desk-contact-shadow" aria-hidden="true"/></>}
      <div className="frame-assembly">
        {standing && <div className="frame-kickstand" aria-hidden="true"/>}
        <div className="display-frame"><div className="frame-mat"><div className="frame-aperture">
          <Preview design={design} template={template} images={images}/><div className="frame-glass" aria-hidden="true"/>
        </div></div></div>
      </div>
      <div className="room-ledge" aria-hidden="true"/>
      <span className="room-caption">{active.caption}</span>
    </div>
    <div className="scene-control-label frame-label">相框款式</div>
    <div className="frame-finishes" role="group" aria-label="預覽畫框樣式">
      {finishes.map(([id, name]) => <button key={id} type="button" aria-pressed={finish === id} onClick={() => setFinish(id)}><i className={`finish-swatch swatch-${id}`} aria-hidden="true"/>{name}</button>)}
    </div>
    </>}
    <p className="preview-note">{photo ? "AI 生成寫實場景 · 設計即時融合於相框" : "相框與場景為陳列示意"}<br/>製作檔僅輸出設計；UV 為位置示意。</p>
    {expanded && photo && <div className="modal-backdrop photo-modal-backdrop" onClick={() => setExpanded(false)}><section className="photo-modal" role="dialog" aria-modal="true" aria-label="放大情境預覽" onClick={e => e.stopPropagation()}><header><span>{active.name} · 寫實融合預覽</span><button autoFocus onClick={() => setExpanded(false)}>關閉</button></header><PhotoScene scene={scene as PhotoSceneId} design={design} template={template} images={images}/><p>相框隨商品方向切換，設計依原比例完整展示。</p></section></div>}
  </section>;
}
