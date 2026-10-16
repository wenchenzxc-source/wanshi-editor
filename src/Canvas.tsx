import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Group, Rect, Line, Shape, Transformer } from 'react-konva';
import Konva from 'konva';
import { drawLayer, drawDesign } from '../shared/draw';
import { dimensions, zones, type Design, type DesignLayer, type Template, type Asset } from '../shared/model';

export function useImages(assets: Asset[]) {
  const [images, setImages] = useState(new Map<string, HTMLImageElement>());
  const [failed, setFailed] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    for (const a of assets) if (!images.has(a.id)) {
      const img = new Image(); img.src = `/api/assets/${a.id}`;
      img.onload = () => { if (active) setImages(old => new Map(old).set(a.id, img)); };
      img.onerror = () => { if (active) setFailed(old => [...old.filter(id => id !== a.id), a.id]); };
    }
    return () => { active = false; };
  }, [assets]); // Loaded assets are immutable; only load when inventory changes.
  return { images, failed };
}
type Props = { design: Design; template: Template; images: Map<string, HTMLImageElement>; selected: string | null; select: (id: string | null) => void; commit: (layer: DesignLayer) => void; live: (layer: DesignLayer | null) => void; zoom: number; guides: boolean; disabled: boolean };
export function EditorCanvas({ design, template, images, selected, select, commit, live, zoom, guides, disabled }: Props) {
  const transformRef = useRef<Konva.Transformer>(null), nodes = useRef(new Map<string, Konva.Shape>());
  const [snapLines, setSnapLines] = useState<{ x?: number; y?: number }>({});
  const { w, h, fullW, fullH } = dimensions(design, template), b = template.bleedMm, pad = 12, scale = 2.6 * zoom;
  const current = design.layers.find(l => l.id === selected);
  useEffect(() => {
    const node = selected ? nodes.current.get(selected) : null;
    transformRef.current?.nodes(node && current?.visible && !current.locked && !disabled ? [node] : []);
    transformRef.current?.getLayer()?.batchDraw();
  }, [selected, current, disabled, design]);
  function updated(l: DesignLayer, node: Konva.Node): DesignLayer {
    return { ...l, x: node.x(), y: node.y(), rotation: node.rotation(), width: Math.max(0.1, node.width() * node.scaleX()), height: Math.max(0.1, node.height() * node.scaleY()), ...(l.kind === 'text' ? { fontSize: Math.max(1, (l.fontSize || 10) * node.scaleX()) } : {}) };
  }
  function snap(node: Konva.Node) {
    const bounds = node.getClientRect({ relativeTo: node.getParent()! });
    const targetsX = [0, w / 2, w, template.safeMm, w - template.safeMm], targetsY = [0, h / 2, h, template.safeMm, h - template.safeMm];
    for (const [id, n] of nodes.current) if (id !== selected && n.visible()) { const r = n.getClientRect({ relativeTo: n.getParent()! }); targetsX.push(r.x, r.x + r.width / 2, r.x + r.width); targetsY.push(r.y, r.y + r.height / 2, r.y + r.height); }
    const closest = (from: number[], to: number[]) => from.flatMap(a => to.map(v => ({ delta: v - a, v }))).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
    const sx = closest([bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width], targetsX), sy = closest([bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height], targetsY);
    const lines: { x?: number; y?: number } = {};
    if (Math.abs(sx.delta) < 5 / scale) { node.x(node.x() + sx.delta); lines.x = sx.v; }
    if (Math.abs(sy.delta) < 5 / scale) { node.y(node.y() + sy.delta); lines.y = sy.v; }
    setSnapLines(lines);
  }
  return <div className="canvas-scroll" data-testid="editor-canvas">
    <Stage width={(fullW + pad * 2) * scale} height={(fullH + pad * 2) * scale} onMouseDown={e => { if (e.target === e.target.getStage()) select(null); }} onTouchStart={e => { if (e.target === e.target.getStage()) select(null); }}>
      <Layer><Group x={pad * scale} y={pad * scale} scaleX={scale} scaleY={scale}>
        <Rect width={fullW} height={fullH} fill="#ffffff" shadowColor="#183d39" shadowBlur={12} shadowOpacity={0.12} listening={false}/>
        <Group clipX={0} clipY={0} clipWidth={fullW} clipHeight={fullH}>
          <Rect width={fullW} height={fullH} fill={design.background} opacity={design.backgroundOpacity} onMouseDown={() => select(null)} onTouchStart={() => select(null)}/>
          <Group x={b} y={b}>
            {design.layers.map(l => <Shape key={l.id} ref={n => { if (n) nodes.current.set(l.id, n); else nodes.current.delete(l.id); }} id={l.id} x={l.x} y={l.y} width={l.width} height={l.height} rotation={l.rotation} visible={l.visible} draggable={!l.locked && !disabled} listening={!disabled}
              sceneFunc={ctx => drawLayer(ctx._context, l, images.get(l.assetId || ''))}
              hitFunc={(ctx, shape) => { ctx.beginPath(); ctx.rect(0, 0, l.width, l.height); ctx.closePath(); ctx.fillStrokeShape(shape); }}
              onClick={() => select(l.id)} onTap={() => select(l.id)} onDragStart={() => select(l.id)}
              onDragMove={e => { if (guides) snap(e.target); live(updated(l, e.target)); }}
              onDragEnd={e => { commit(updated(l, e.target)); live(null); setSnapLines({}); }}
              onTransform={() => live(updated(l, nodes.current.get(l.id)!))}
              onTransformEnd={() => { const node = nodes.current.get(l.id)!; const next = updated(l, node); node.scale({ x: 1, y: 1 }); commit(next); live(null); }}
            />)}
          </Group>
        </Group>
        {guides && <Group listening={false}>
          <Rect x={b} y={b} width={w} height={h} stroke="#b67b52" strokeWidth={0.35} dash={[2, 2]}/>
          <Rect x={b + template.safeMm} y={b + template.safeMm} width={w - 2 * template.safeMm} height={h - 2 * template.safeMm} stroke="#438a80" strokeWidth={0.35} dash={[2, 2]}/>
          {zones(design, template).map((z, i) => <Rect key={i} x={b + z.x} y={b + z.y} width={z.width} height={z.height} fill="#e75d5d44" stroke="#cf4444" strokeWidth={0.4}/>)}
          {snapLines.x !== undefined && <Line points={[b + snapLines.x, 0, b + snapLines.x, fullH]} stroke="#df5a95" strokeWidth={0.45}/>}
          {snapLines.y !== undefined && <Line points={[0, b + snapLines.y, fullW, b + snapLines.y]} stroke="#df5a95" strokeWidth={0.45}/>}
        </Group>}
        <Transformer ref={transformRef} flipEnabled={false} keepRatio={true} rotateAnchorOffset={26} anchorSize={12} anchorCornerRadius={3} borderStroke="#255f55" anchorStroke="#255f55" anchorFill="#ffffff" enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']} boundBoxFunc={(old, next) => Math.abs(next.width) < 8 || Math.abs(next.height) < 8 || Math.abs(next.width) > 2500 || Math.abs(next.height) > 2500 ? old : next}/>
      </Group></Layer>
    </Stage>
  </div>;
}
export function Preview({ design, template, images }: Pick<Props, 'design' | 'template' | 'images'>) {
  const ref = useRef<HTMLCanvasElement>(null), { w, h } = dimensions(design, template), scale = 2.2;
  useEffect(() => { const ctx = ref.current?.getContext('2d'); if (ctx) { ctx.clearRect(0, 0, w * scale, h * scale); drawDesign(ctx, design, template, images, 'preview', scale, false); } }, [design, template, images, w, h]);
  return <canvas ref={ref} width={Math.round(w * scale)} height={Math.round(h * scale)} data-testid="product-preview" aria-label="同步成品預覽，不含編輯控制點"/>;
}
