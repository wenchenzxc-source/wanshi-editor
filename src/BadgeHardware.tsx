import { useId } from 'react';
import type { Design } from '../shared/model';

// Scene coordinates are percentages. The lower connector ends at the actual
// aperture center, shared by the live card and both sizes of scene preview.
export function BadgeHardware({ scene, x, y, accessory, slotWidth, slotHeight }: {
  scene: string; x: number; y: number; accessory: Design['badgeAccessory']; slotWidth: number; slotHeight: number;
}) {
  const id = useId().replace(/:/g, '');
  const kind = accessory || 'custom';
  if (kind === 'none' || kind === 'custom') return null;
  const metal = `url(#${id}-metal)`, fabric = `url(#${id}-fabric)`;
  const neck = scene === 'lanyard', start = neck ? -y - 2 : 11 - y;
  const flat = kind === 'webbing' || kind === 'lanyard';
  const strapWidth = flat ? Math.min(slotWidth * .8, kind === 'webbing' ? 9 : 5) : 3;
  const color = kind === 'webbing' ? '#4c5036' : kind === 'lanyard' ? '#9e9278' : '#262c2b';
  const connectorWidth = Math.min(slotWidth * .65, .65);
  const ring = (cy: number, rx: number, ry: number) => <ellipse cx="0" cy={cy} rx={rx} ry={ry} fill="none" stroke={metal} strokeWidth=".65"/>;
  return <svg className="badge-hardware" viewBox="0 0 100 100" aria-hidden="true" data-accessory={kind} data-anchor={`${x},${y}`}>
    <defs>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2=".4"><stop stopColor="#555c5b"/><stop offset=".22" stopColor="#faf9ee"/><stop offset=".45" stopColor="#8f9695"/><stop offset=".66" stopColor="#fffef6"/><stop offset="1" stopColor="#555a58"/></linearGradient>
      <pattern id={`${id}-fabric`} width=".45" height=".45" patternUnits="userSpaceOnUse"><rect width=".45" height=".45" fill={color}/><path d="M0 .1H.45M.1 0V.45" stroke="#fff" strokeOpacity=".12" strokeWidth=".07"/></pattern>
      <radialGradient id={`${id}-bead`} cx=".3" cy=".2"><stop stopColor="#fff"/><stop offset=".35" stopColor="#cdd2ce"/><stop offset="1" stopColor="#4c5653"/></radialGradient>
      <filter id={`${id}-shadow`} x="-50%" y="-20%" width="200%" height="150%"><feDropShadow dx=".25" dy=".3" stdDeviation=".18" floodOpacity=".4"/></filter>
    </defs>
    <g transform={`translate(${x} ${y})`} filter={`url(#${id}-shadow)`}>
      {(flat || kind === 'original') && <>
        <path d={neck ? `M-14 ${start} L-1 -8 Q0 -6 1 -8 L14 ${start}` : `M0 ${start} L0 -7`} fill="none" stroke={fabric} strokeWidth={strapWidth} strokeLinejoin="round"/>
        <path d={neck ? `M-14 ${start} L-1 -8 M14 ${start} L1 -8` : `M${-strapWidth / 2 + .3} ${start} V-7`} fill="none" stroke="#dedcc6" strokeOpacity=".3" strokeWidth=".12" strokeDasharray=".3 .25"/>
        {flat ? <>
          <rect x={-strapWidth / 2 - .35} y="-9" width={strapWidth + .7} height="3" rx=".55" fill="#252b28" stroke="#72756b" strokeWidth=".25"/>
          <path d={`M${-strapWidth / 2} -6 V${-slotHeight / 2} Q0 ${slotHeight / 2} ${strapWidth / 2} ${-slotHeight / 2} V-6`} fill={fabric} stroke="#292c24" strokeWidth=".2"/>
          <path d={`M${-strapWidth / 2} -.2 H${strapWidth / 2}`} stroke="#c9c6aa" strokeOpacity=".6" strokeWidth=".25"/>
        </> : <>{ring(-6, 1.7, 1.6)}<Clasp metal={metal} width={connectorWidth}/></>}
      </>}
      {kind === 'ball-chain' && <>
        <path d={`M0 -.1 C-7 -5 -5 ${start} 0 ${start} C5 ${start} 7 -5 0 -.1`} fill="none" stroke="#9baba7" strokeWidth=".2"/>
        {Array.from({ length: 46 }, (_, i) => {
          const t = i / 46 * Math.PI * 2, cy = start / 2 + Math.cos(t) * -start / 2;
          return <circle key={i} cx={Math.sin(t) * 4.5} cy={cy} r=".38" fill={`url(#${id}-bead)`}/>;
        })}
        <rect x="-.5" y="-1.8" width="1" height="1.5" rx=".35" fill={metal}/>
      </>}
      {kind === 'keyring' && <>
        {neck && <path d={`M-13 ${start} L0 -15 L13 ${start}`} fill="none" stroke="#404d49" strokeWidth=".65"/>}
        {!neck && <path d={`M0 ${start} V-16`} stroke={fabric} strokeWidth="2.5"/>}
        {ring(-12, 4.2, 4.2)}<ellipse cx=".35" cy="-12.2" rx="3.8" ry="3.9" fill="none" stroke={metal} strokeWidth=".3"/>
        {[-7.5, -5.8, -4.1].map((cy, i) => <ellipse key={cy} cx="0" cy={cy} rx={i % 2 ? .4 : .8} ry="1.15" fill="none" stroke={metal} strokeWidth=".4"/>)}
        <path d="M0 -3.3 C-1.7 -3.3 -1.7 -.2 0 0 C1 -.1 1.3 -1.7 .6 -2" fill="none" stroke={metal} strokeWidth={connectorWidth}/>
      </>}
      {kind === 'leather' && <>
        <path d={neck ? `M-14 ${start} Q-6 -16 0 -6 Q6 -16 14 ${start}` : `M0 -6 C-9 -10 -7 ${start} 0 ${start} C7 ${start} 9 -10 0 -6`} fill="none" stroke="#412a20" strokeWidth="1.05"/>
        <path d={neck ? `M-14 ${start} Q-6 -16 0 -6 Q6 -16 14 ${start}` : `M0 -6 C-9 -10 -7 ${start} 0 ${start} C7 ${start} 9 -10 0 -6`} fill="none" stroke="#aa7750" strokeWidth=".35"/>
        <rect x="-.65" y="-7" width="1.3" height="2" rx=".3" fill="#b09658"/><Clasp metal={metal} width={connectorWidth}/>
      </>}
    </g>
  </svg>;
}

function Clasp({ metal, width }: { metal: string; width: number }) {
  return <><rect x="-.65" y="-5.1" width="1.3" height="1.6" rx=".4" fill={metal}/><path d="M0 -3.8 C-1.1 -3.8 -2 -1.6 -1.2 -.5 Q0 .5 1.2 -.5 C2 -1.6 1.1 -3.8 0 -3.8Z" fill="none" stroke={metal} strokeWidth={width}/><path d="M.8 -3.1 L1.1 -1.1" stroke="#dadbd2" strokeWidth=".25"/></>;
}
