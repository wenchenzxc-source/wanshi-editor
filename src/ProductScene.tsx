import { PhotoHolderScene } from './PhotoHolder';
import { BadgeScene } from './BadgeScene';
import { useEffect, useState } from 'react';
import { Preview } from './Canvas';
import { PhotoScene, photoScenes, type PhotoSceneId } from './PhotoScene';
import { dimensions, type Design, type Template } from '../shared/model';
import './product-scene.css';
const scenes = [
  { id: 'models', name: '模型櫃', caption: '讓珍藏的模型，陪伴你的獨家設計。' },
  { id: 'dolls', name: '娃娃牆', caption: '把溫暖的回憶，放進收藏角落。' },
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
  if (template.presentation === 'photo-holder') return <PhotoHolderScene design={design} template={template} images={images}/>;
  if (template.presentation === 'acrylic-badge') return <BadgeScene design={design} template={template} images={images}/>;
  if (template.presentation === 'acrylic-block') {
    const { w, h } = dimensions(design, template);
    const worldW = Math.max(140, w + 115.6), worldH = Math.max(h, 54) + 55;
    const baseline = worldH - 35;
    const pct = (n: number, total: number) => `${n / total * 100}%`;
    return <section className="product-preview-panel" aria-label="透明壓克力磚預覽">
      <div className="scene-control-label">{template.name} <span>長 {w} × 高 {h} mm{template.presentation === 'acrylic-block' && <> · 厚 {template.thicknessMm ?? '未指定'} mm</>}</span></div>
      <div className="block-scale-scene" style={{ aspectRatio: `${worldW} / ${worldH}` }}>
        <div className="scale-reference" aria-label="信用卡大小參照物，8.56 × 5.4 公分" style={{ left: pct(w + 20, worldW), top: pct(baseline - 54, worldH), width: pct(85.6, worldW), height: pct(54, worldH) }}>
          <svg viewBox="0 0 85.6 54" aria-hidden="true">
            <defs><linearGradient id="reference-card-fill" x2="1" y2="1"><stop stopColor="#385e68"/><stop offset="1" stopColor="#173c47"/></linearGradient></defs>
            <rect x="0.5" y="0.5" width="84.6" height="53" rx="3.2" fill="url(#reference-card-fill)" stroke="#66848b"/>
            <path d="M 47 0 L 85.6 35 L 85.6 0 Z" fill="#ffffff0c"/>
            <text x="7" y="12" fill="#f0f5f2" fontSize="5">信用卡大小</text>
            <rect x="7" y="19" width="12" height="10" rx="2" fill="#c9b47a"/>
            <path d="M 11 19 V 29 M 15 19 V 29 M 7 24 H 19" stroke="#8a784e" strokeWidth="0.5"/>
            <text x="7" y="39" fill="#d3e1df" fontSize="5" letterSpacing="1">••••  ••••  ••••</text>
            <text x="7" y="48" fill="#d3e1df" fontSize="4">約 8.56 × 5.4 cm</text>
          </svg>
        </div>
        <div className="acrylic-block-object" style={{ left: pct(10, worldW), top: pct(baseline - h, worldH), width: pct(w, worldW), height: pct(h, worldH) }}><Preview design={design} template={template} images={images}/><div className="acrylic-block-gloss"/></div>
        <svg className="block-ruler" viewBox={`0 0 ${worldW} ${worldH}`} aria-label="公分比例尺">
          <path d={`M 10 ${baseline + 8} H ${worldW - 10}`} stroke="#65776c" strokeWidth="0.5"/>
          {Array.from({ length: Math.floor((worldW - 20) / 10) + 1 }, (_, i) => <g key={i}><path d={`M ${10 + i * 10} ${baseline + 8} v 4`} stroke="#65776c" strokeWidth="0.5"/><text x={10 + i * 10} y={baseline + 20} textAnchor="middle" fontSize="5" fill="#405c4f">{i}</text></g>)}
        </svg>
      </div>
      <p className="scale-caption">刻度單位：cm · 商品與信用卡使用相同比例</p>
      <p className="preview-note">螢幕顯示非實際大小；可用常見信用卡的大小比較尺寸。<br/>邊緣與反射為示意；信用卡示意與刻度不會印出。{(design.sizeId === 'custom' || template.sizes?.some(s => s.id === design.sizeId && s.retired)) && <><br/>其他尺寸・需另外報價</>}</p>
    </section>;
  }
  return <section className="product-preview-panel" aria-label="商品情境預覽設定">
    <div className="scene-control-label">陳列場景 <span>{active.name}</span></div>
    <div className="scene-buttons" role="group" aria-label="切換預覽場景">
      {scenes.map(s => <button key={s.id} type="button" aria-pressed={scene === s.id} onClick={() => setScene(s.id)}><span className="scene-thumbnail scene-photo-thumbnail" aria-hidden="true"><img src={photoScenes[s.id as PhotoSceneId][design.orientation].src} alt=""/></span><span>{s.name}</span></button>)}
    </div>
    {photo ? <><PhotoScene scene={scene as PhotoSceneId} design={design} template={template} images={images}/><button className="photo-expand" onClick={() => setExpanded(true)}>⤢ 放大情境預覽</button><p className="photo-scene-detail">原木情境框 · 底材與觀看面同步預覽</p></> : <><div className={`product-room scene-${scene} ${standing ? 'scene-standing' : ''} finish-${finish} ${design.orientation}`} aria-label={`${active.name}情境預覽`}>
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
    <p className="preview-note">{photo ? "AI 生成寫實場景 · 設計即時融合於相框" : "相框與場景為陳列示意"}<br/>製作檔僅輸出設計；底材光澤、透明度與 UV 均為視覺示意。</p>
    {expanded && photo && <div className="modal-backdrop photo-modal-backdrop" onClick={() => setExpanded(false)}><section className="photo-modal" role="dialog" aria-modal="true" aria-label="放大情境預覽" onClick={e => e.stopPropagation()}><header><span>{active.name} · 寫實融合預覽</span><button autoFocus onClick={() => setExpanded(false)}>關閉</button></header><PhotoScene scene={scene as PhotoSceneId} design={design} template={template} images={images}/><p>相框隨商品方向切換，設計依原比例完整展示。</p></section></div>}
  </section>;
}


