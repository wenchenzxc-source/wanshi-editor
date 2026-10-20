import { useState } from 'react';
import type { Design } from '../shared/model';
type Stack = NonNullable<Design['printStack']>;
const options: { id: Stack; name: string; order: string; effect: string; view: string }[] = [
  { id: 'cmyk-white', name: '單面・壓克力面', order: 'CMYK → 白', effect: '隔著壓克力看彩色圖案，呈現透亮感；印刷側看到白墨底。', view: '從底材側觀看' },
  { id: 'white-cmyk', name: '單面・直噴面', order: '白 → CMYK', effect: '直接看表面的彩色油墨；白墨在圖案下方襯底。', view: '從印刷側觀看' },
  { id: 'cmyk-white-cmyk', name: '雙面・中間白墨', order: 'CMYK → 白 → CMYK', effect: '白墨夾在兩層彩墨中，兩側都看到同一份彩色圖案。', view: '兩側皆可觀看' },
];
function StackPicture({ stack }: { stack: Stack }) {
  const layers = stack.split('-');
  const picture = (x: number, colored: boolean, glass: boolean) => <g transform={`translate(${x} 24)`}>
    <rect width="84" height="66" rx="5" fill={colored ? '#f4e9d4' : '#fff'} stroke="#9fb4ab" strokeWidth="2"/>
    {colored ? <><path d="M42 54 Q33 40 43 23" stroke="#578966" strokeWidth="3" fill="none"/><path d="M40 45 Q17 23 35 36Z M41 39 Q65 21 49 38Z" fill="#81a985"/><circle cx="44" cy="23" r="13" fill="#d89377"/><circle cx="44" cy="23" r="6" fill="#eac275"/></> : <text x="42" y="38" textAnchor="middle" fill="#8c958e" fontSize="12">白墨區</text>}
    {glass && <><path d="M8 56 L46 6 L61 6 L23 56Z" fill="#ffffff" opacity=".45"/><rect x="3" y="3" width="78" height="60" rx="3" fill="none" stroke="#d0e4e7"/></>}
  </g>;
  return <svg viewBox="0 0 224 166" role="img" aria-label={`${options.find(o => o.id === stack)!.order}：底材側與印刷側效果示意`}>
    <text x="54" y="14" textAnchor="middle" fontSize="11" fill="#52665d">底材側</text><text x="170" y="14" textAnchor="middle" fontSize="11" fill="#52665d">印刷側</text>
    {picture(12, stack !== 'white-cmyk', true)}{picture(128, stack !== 'cmyk-white', false)}
    <text x="112" y="109" textAnchor="middle" fontSize="10" fill="#68766b">堆疊剖面 · 由底材向外 →</text>
    <rect x="12" y="120" width="44" height="31" rx="3" fill="#deedf0" stroke="#a4bcc0"/><text x="34" y="140" textAnchor="middle" fontSize="10" fill="#3d5c5a">底材</text>
    {layers.map((ink, i) => <g key={i}><rect x={62 + i * 49} y="120" width="44" height="31" rx="3" fill={ink === 'white' ? '#fff' : '#e5c99d'} stroke="#acb7a6"/><text x={84 + i * 49} y="140" textAnchor="middle" fontSize="10" fill="#40523f">{ink === 'white' ? '白墨' : 'CMYK'}</text></g>)}
  </svg>;
}
export function PrintStackPicker({ value, onChange, duplexAllowed, disabled }: { value: Stack; onChange: (value: Stack) => void; duplexAllowed: boolean; disabled: boolean }) {
  const [hover, setHover] = useState<Stack | null>(null), [pinned, setPinned] = useState<Stack | null>(null);
  const inspecting = hover || pinned || value, option = options.find(o => o.id === inspecting)!;
  return <section className="print-stack-picker" aria-label="印刷堆疊">
    <h3>印刷順序與效果</h3><p className="stack-instruction">移上選項看圖解，點選才會套用。</p>
    <div className="stack-options" role="group" aria-label="選擇印刷順序">{options.map(o => {
      const unavailable = o.id === 'cmyk-white-cmyk' && !duplexAllowed;
      return <div key={o.id} className={`stack-option ${value === o.id ? 'is-selected' : ''}`} onMouseEnter={() => setHover(o.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(o.id)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHover(null); }}>
        <button className="stack-choose" aria-label={o.order} aria-pressed={value === o.id} disabled={disabled || unavailable} onClick={() => { onChange(o.id); setPinned(null); }}><span className="stack-radio" aria-hidden="true">{value === o.id ? '●' : '○'}</span><span><b>{o.name}</b><small>{o.order}</small></span></button>
        <button className="stack-help" aria-label={`${o.order} 效果說明`} aria-controls="stack-effect-guide" onClick={() => setPinned(o.id)}>ⓘ</button>
        {unavailable && <small className="stack-restriction">僅透明壓克力、炫彩可選</small>}
      </div>;
    })}</div>
    <div id="stack-effect-guide" className="stack-effect-guide" aria-live="polite"><div className="stack-guide-title"><b>{option.name}</b><span>{inspecting === value ? '已選用' : '效果說明・未套用'}</span></div><StackPicture stack={inspecting}/><strong>{option.view}</strong><p>{option.effect}</p><small>上圖以透光底材示意；不透光底材無法從底材側看到圖案。白墨僅示意覆蓋區域，實際光澤與顏色依材質、印刷而定。</small>{pinned && pinned !== value && <button onClick={() => { setPinned(null); setHover(null); }}>回到已選效果</button>}</div>
  </section>;
}
