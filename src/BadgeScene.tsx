import { useEffect, useState, useId } from 'react';
import { Preview } from './Canvas';
import { dimensions, slotGeometry, badgeRadius, badgeAccessories, type Design, type Template } from '../shared/model';

const scenes = [
  { id: 'backpack', name: '背包吊牌', image: '/scenes/badge-backpack-v1.png', x: 49.8, y: 33.1 },
  { id: 'lanyard', name: '識別證配戴', image: '/scenes/badge-lanyard-v1.png', x: 50.5, y: 42.4 },
];
export function BadgeScene({ design, template, images }: { design: Design; template: Template; images: Map<string, HTMLImageElement> }) {
  const [sceneId, setSceneId] = useState(() => { try { return localStorage.getItem('wanshi:badge-scene') || 'backpack'; } catch { return 'backpack'; } });
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const scene = scenes.find(s => s.id === sceneId) || scenes[0];
  const { w, h } = dimensions(design, template), slot = slotGeometry(design, template);
  const unit = Math.min(48 / w, 48 / h), top = scene.y - (slot ? slot.y + slot.height / 2 : 1) * unit;
  useEffect(() => { try { localStorage.setItem('wanshi:badge-scene', scene.id); } catch {} setFailed(false); }, [scene.id]);
  useEffect(() => { if (!expanded) return; const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [expanded]);
  const left = scene.x - (slot ? slot.x + slot.width / 2 : w / 2) * unit;
  const picture = () => <div className="badge-lifestyle" aria-label={`${scene.name}照片融合預覽`} data-orientation={design.orientation}>
    <img src={scene.image} alt={scene.name + '生活情境'} onError={() => setFailed(true)}/>
    <div className="badge-live-art" style={{ left: `${left}%`, top: `${top}%`, width: `${w * unit}%`, height: `${h * unit}%`, borderRadius: `${badgeRadius(design, template) / w * 100}% / ${badgeRadius(design, template) / h * 100}%` }}><Preview design={design} template={template} images={images}/></div>
    {slot && <HardwareOverlay scene={scene}/>}

    {failed && <p className="photo-load-error">場景圖片載入失敗，請重新整理。</p>}
  </div>;
  return <section className="product-preview-panel" aria-label="壓克力識別牌預覽">
    <div className="scene-control-label">生活情境 <span>長 {w} × 高 {h} × 厚 {template.thicknessMm} mm</span></div>
    <div className="badge-scene-buttons" role="group" aria-label="識別牌預覽場景">{scenes.map(s => <button key={s.id} aria-pressed={s.id === scene.id} onClick={() => setSceneId(s.id)}><img src={s.image} alt=""/>{s.name}</button>)}</div>
    {picture()}<button className="photo-expand" onClick={() => setExpanded(true)}>⤢ 放大情境預覽</button>
    <p className="preview-note">{badgeAccessories.find(a => a.id === design.badgeAccessory)?.name || '自訂配件'}・圓角 R{badgeRadius(design, template)} mm<br/>AI 生成生活場景・圖稿與孔槽即時同步<br/>配件與光影為示意，實際大小以標示尺寸為準。{!slot && <><br/>未開槽：配戴需另搭配夾具。</>}</p>
    {expanded && <div className="modal-backdrop" onClick={() => setExpanded(false)}><section className="photo-modal" role="dialog" aria-modal="true" aria-label="放大識別牌預覽" onClick={e => e.stopPropagation()}><header>{scene.name}<button autoFocus onClick={() => setExpanded(false)}>關閉</button></header>{picture()}</section></div>}
  </section>;
}

function HardwareOverlay({ scene }: { scene: typeof scenes[number] }) {
  const maskId = useId().replace(/:/g, '');
  const rx = scene.id === 'backpack' ? 2 : 1.4, ry = scene.id === 'backpack' ? 2.1 : 1.7;
  return <svg className="badge-hardware" viewBox="0 0 100 100" aria-hidden="true">
    <defs><mask id={maskId}><rect width="100" height="100" fill="black"/><ellipse cx={scene.x} cy={scene.y - ry + .15} rx={rx} ry={ry} fill="none" stroke="white" strokeWidth=".6"/></mask></defs>
    <image href={scene.image} width="100" height="100" mask={`url(#${maskId})`}/>
  </svg>;
}
