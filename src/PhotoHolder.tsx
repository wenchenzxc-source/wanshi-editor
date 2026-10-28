import { useState } from 'react';
import { Preview } from './Canvas';
import { dimensions, photoImageArea, type Design, type Template } from '../shared/model';
import './photo-holder.css';

export const defaultPhotoHolder: NonNullable<Design['photoHolder']> = { base: false, nfc: false, photoService: 'own' as const, paperLayout: 'full' as const };
export function PhotoHolderOptions({ design, change, disabled }: { design: Design; change: (d: Design) => void; disabled: boolean }) {
  const options = design.photoHolder || defaultPhotoHolder;
  const patch = (p: Partial<typeof options>) => change({ ...design, photoHolder: { ...options, ...p } });
  return <section className="photo-holder-options" aria-label="照片立掛牌選配"><h3>照片立／掛牌</h3><p>固定直式・同款可立可掛，底座另選加購。</p>
    {design.sizeId === 'instax-mini' ? <p>拍立得固定白邊・影像區 46 × 62 mm<br/>照片預設鋪滿影像區，放大後可上下左右取景。</p> : <p>小相紙 50 × 76 mm 滿版<br/>照片預設鋪滿整張相紙，放大後可上下左右取景。</p>}
    <fieldset disabled={disabled}><legend>照片服務</legend><div className="holder-options-row">
      <button aria-pressed={options.photoService === 'own'} onClick={() => patch({ photoService: 'own' })}>自備照片</button>
      <button aria-pressed={options.photoService === 'print'} onClick={() => patch({ photoService: 'print' })}>加購照片列印</button>
    </div><p>{options.photoService === 'own' ? '可上傳照片試放。圖稿僅供預覽，不安排照片列印。' : '使用下方畫布排版，依所選相紙尺寸輸出照片。'}</p>
    <label><input type="checkbox" checked={options.base} onChange={e => patch({ base: e.target.checked })}/>加購桌面底座</label>
    <label><input type="checkbox" checked={options.nfc} onChange={e => patch({ nfc: e.target.checked })}/>背面加裝 NFC</label>
    {options.nfc && <p>已選背面 NFC 硬體；感應內容於製作時另行設定。</p>}</fieldset>
    <small>畫布為相紙範圍。外框與底座為造型示意，外框成品尺寸待確認。</small>
  </section>;
}

export function PhotoHolderScene({ design, template, images }: { design: Design; template: Template; images: Map<string, HTMLImageElement> }) {
  const [expanded, setExpanded] = useState(false);
  const options = design.photoHolder || defaultPhotoHolder, { w, h } = dimensions(design, template);
  // The frame is a proportionate illustration, never used as a manufacturing outline.
  const vw = w + 28, vh = h + 38;
  const picture = () => <div className={`holder-scene ${options.base ? 'standing' : 'hanging'}`} data-face="front" data-base={String(options.base)} data-nfc={String(options.nfc)} style={{ aspectRatio: `${vw} / ${vh}` }}>
    <div className="holder-photo" style={{ left: `${14 / vw * 100}%`, top: `${18 / vh * 100}%`, width: `${w / vw * 100}%`, height: `${h / vh * 100}%` }}>
      <Preview design={design} template={template} images={images}/>
    </div>
    <svg className="holder-frame" viewBox={`0 0 ${vw} ${vh}`} aria-hidden="true">
      {!options.base && <path d={`M${vw / 2 - 5} 0 V14 H${vw / 2 + 5} V0`} fill="#242d2a"/>}
      {options.base && <><path d={`M10 ${h + 23} L18 ${h + 13} H${vw - 18} L${vw - 10} ${h + 23} V${h + 30} Q${vw / 2} ${h + 36} 10 ${h + 30}Z`} fill="#688d86" stroke="#456a63" strokeWidth="1"/><path d={`M10 ${h + 23} Q${vw / 2} ${h + 29} ${vw - 10} ${h + 23}`} fill="none" stroke="#a5bcb0"/></>}
      <rect x="11" y="15" width={w + 6} height={h + 6} rx="3" fill="none" stroke="#63867c" strokeWidth="3"/>
      <path d={`M12 18 H${vw - 12} V${Math.min(38, h / 2)} L${vw - 29} 18 M12 ${h - 2} V${h + 18} H${vw - 12} M12 ${h - 2} L29 ${h + 18}`} fill="none" stroke="#e7e6da" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={`M${vw / 2 - 10} 15 V10 H${vw / 2 + 10} V15`} fill="none" stroke="#e7e6da" strokeWidth="3" strokeLinejoin="round"/>
      <rect x="14" y="18" width={w} height={h} fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth=".3"/>
    </svg>
  </div>;
  return <section aria-label="照片立掛牌預覽" className="product-preview-panel">
    <div className="scene-control-label">{template.sizes?.find(s => s.id === design.sizeId)?.name}<span>直式・相紙 {w} × {h} mm</span></div>

    <p className="preview-note">{design.sizeId === 'instax-mini' ? '拍立得固定白邊' : '小相紙滿版'}・影像區 {photoImageArea(design, template)?.width} × {photoImageArea(design, template)?.height} mm</p>
    {picture()}<button className="photo-expand" onClick={() => setExpanded(true)}>⤢ 放大照片框預覽</button>
    <p className="preview-note">{options.base ? '含桌面底座・可立可掛' : '掛牌・未加購底座'}<br/>{options.nfc ? '背面加裝 NFC' : '無 NFC'}・{options.photoService === 'print' ? '加購照片列印' : '自備照片'}<br/>依實物造型繪製的示意，框體尺寸與遮擋範圍待確認。</p>
    {expanded && <div className="modal-backdrop" onClick={() => setExpanded(false)}><section className="photo-modal" role="dialog" aria-modal="true" aria-label="放大照片框預覽" onClick={e => e.stopPropagation()}><header>照片立／掛牌<button autoFocus onClick={() => setExpanded(false)}>關閉</button></header>{picture()}</section></div>}
  </section>;
}
