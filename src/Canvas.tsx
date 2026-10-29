import { cadSelect, layerBounds, type SelectionPoint } from '../shared/selection';
import { eraseLayers } from '../shared/eraser';
import { scatterPetals } from '../shared/petals';
import { clampCoverPosition, scaleLayerAtPoint, validLayerSize } from '../shared/transform';
import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Group, Rect, Line, Shape, Transformer } from 'react-konva';
import Konva from 'konva';
import { drawLayer, drawDesign, drawSubstrate, drawPhotoBorder } from '../shared/draw';
import { newLayer, dimensions, zones, photoImageArea, slotGeometry, badgeRadius, type Design, type DesignLayer, type Template, type Asset } from '../shared/model';
import { assetUrl } from './urls';

export function useImages(assets: Asset[]) {
  const [images, setImages] = useState(new Map<string, HTMLImageElement>());
  const [failed, setFailed] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    for (const a of assets) if (!images.has(a.id)) {
      const img = new Image(); img.src = assetUrl(a);
      img.onload = () => { if (active) setImages(old => new Map(old).set(a.id, img)); };
      img.onerror = () => { if (active) setFailed(old => [...old.filter(id => id !== a.id), a.id]); };
    }
    return () => { active = false; };
  }, [assets]); // Loaded assets are immutable; only load when inventory changes.
  return { images, failed };
}
export type PaintTool = { mode: 'pen' | 'stamp' | 'petals' | 'eraser'; flowerType?: 'sakura' | 'rose'; count?: number; color: string; size: number; opacity: number; assetId?: string; rotation: number };
export type CropBox = { x: number; y: number; width: number; height: number };
type Props = { photoAssetIds?: Set<string>; cropBox?: CropBox | null; setCropBox?: (box: CropBox) => void; liveMany: (layers: DesignLayer[] | null) => void; marquee?: boolean; contained?: boolean; selectedIds: string[]; selectMany: (ids: string[]) => void; replaceLayers: (layers: DesignLayer[]) => void; createBatch: (layers: DesignLayer[]) => void; paint?: PaintTool; create: (layer: DesignLayer) => void; design: Design; template: Template; images: Map<string, HTMLImageElement>; selected: string | null; select: (id: string | null) => void; commit: (layer: DesignLayer) => void; live: (layer: DesignLayer | null) => void; zoom: number; guides: boolean; disabled: boolean };
type Marquee={start:SelectionPoint;end:SelectionPoint;add:boolean};
type GroupDrag={id:string;startX:number;startY:number;original:Map<string,{x:number;y:number}>};
type PinchZoom={id:string;startDistance:number;startLayer:DesignLayer;anchor:SelectionPoint;pending?:DesignLayer};
export function EditorCanvas({ design, template, images, selected, select, commit, live, zoom, guides, disabled, paint, create, createBatch, replaceLayers, selectedIds, selectMany, liveMany, cropBox, setCropBox, photoAssetIds }: Props) {
  const [erased, setErased] = useState<DesignLayer[] | null>(null);
  const drawing = useRef<number[]>([]);
  const [ink, setInk] = useState<DesignLayer | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const marqueeRef = useRef<Marquee | null>(null), groupDrag = useRef<GroupDrag | null>(null), pinchZoom = useRef<PinchZoom | null>(null), shrinkFeedbackAt = useRef(new Map<string, number>());
  function stroke(points: number[]) {
    const xs = points.filter((_, i) => i % 2 === 0), ys = points.filter((_, i) => i % 2 === 1), r = paint!.size / 2;
    const x = Math.min(...xs) - r, y = Math.min(...ys) - r, width = Math.max(...xs) - x + r, height = Math.max(...ys) - y + r;
    return newLayer('stroke', { name: '自由筆畫', x, y, width, height, fill: paint!.color, opacity: paint!.opacity, brushRatio: paint!.size / Math.min(width, height), points: points.map((n, i) => (n - (i % 2 ? y : x)) / (i % 2 ? height : width)) });
  }
  const photoArea = photoImageArea(design, template);
  const proxyRef = useRef<Konva.Rect>(null);
  const transformRef = useRef<Konva.Transformer>(null), nodes = useRef(new Map<string, Konva.Shape>());
  const [snapLines, setSnapLines] = useState<{ x?: number; y?: number }>({});
  const { w, h, fullW, fullH } = dimensions(design, template), b = template.bleedMm, pad = 12, requestedScale = 2.6 * zoom;
  const slot = slotGeometry(design, template), radius = badgeRadius(design, template);
  const current = design.layers.find(l => l.id === selected);
  const isPhoto = (layer?: DesignLayer) => !!(photoArea && layer?.kind === 'image' && layer.assetId && photoAssetIds?.has(layer.assetId));
  const currentPhoto = isPhoto(current);
  function constrainPhoto(layer: DesignLayer, next: DesignLayer) {
    if (!isPhoto(layer) || !photoArea) return next;
    const image = layer.assetId ? images.get(layer.assetId) : undefined;
    const ratio = image?.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : layer.width / layer.height;
    const baseWidth = Math.max(photoArea.width, photoArea.height * ratio), baseHeight = baseWidth / ratio;
    const zoom = Math.max(1, next.width / baseWidth, next.height / baseHeight);
    const width = baseWidth * zoom, height = baseHeight * zoom;
    return { ...next, x: clampCoverPosition(next.x, photoArea.x, photoArea.width, width), y: clampCoverPosition(next.y, photoArea.y, photoArea.height, height), width, height, rotation: 0 };
  }
  // Keep the product at the chosen zoom. Only the controls use a bounded proxy.
  const scale = requestedScale;
  const angle = (current?.rotation || 0) * Math.PI / 180;
  const corners = current ? [[0, 0], [current.width, 0], [0, current.height], [current.width, current.height]].map(([x, y]) => ({
    x: b + current.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: b + current.y + x * Math.sin(angle) + y * Math.cos(angle),
  })) : [];
  const left = Math.min(...corners.map(p => p.x)), top = Math.min(...corners.map(p => p.y));
  const right = Math.max(...corners.map(p => p.x)), bottom = Math.max(...corners.map(p => p.y));
  const bounded = !!current && !currentPhoto && current.visible && !current.locked && (left < 0 || top < 0 || right > fullW || bottom > fullH);
  const px = Math.max(0, Math.min(fullW - 1, left)), py = Math.max(0, Math.min(fullH - 1, top));
  const pw = Math.max(1, Math.min(fullW, right) - px), ph = Math.max(1, Math.min(fullH, bottom) - py);
  const stageW = (fullW + pad * 2) * scale, stageH = (fullH + pad * 2) * scale;
  useEffect(() => {
    if (bounded) proxyRef.current?.setAttrs({ x: px, y: py, width: pw, height: ph, rotation: 0, scaleX: 1, scaleY: 1 });
    const node = bounded ? proxyRef.current : selected ? nodes.current.get(selected) : null;
    transformRef.current?.nodes(node && !currentPhoto && current?.visible && !current.locked && !disabled && !paint && !cropBox && !selectedIds.length ? [node] : []);
    transformRef.current?.getLayer()?.batchDraw();
  }, [selected, current, currentPhoto, disabled, paint, cropBox, selectedIds, bounded, px, py, pw, ph]);
  function transformProxy(done = false) {
    const proxy = proxyRef.current;
    if (!proxy || !current) return;
    const scaleX = proxy.scaleX(), scaleY = proxy.scaleY(), rotation = proxy.rotation(), a = rotation * Math.PI / 180;
    const dx = (b + current.x - px) * scaleX, dy = (b + current.y - py) * scaleY;
    const next = { ...current, x: proxy.x() + dx * Math.cos(a) - dy * Math.sin(a) - b,
      y: proxy.y() + dx * Math.sin(a) + dy * Math.cos(a) - b, width: current.width * scaleX, height: current.height * scaleY,
      rotation: current.rotation + rotation, ...(current.kind === 'text' ? { fontSize: Math.max(1, Math.min(200, (current.fontSize || 10) * scaleX)), letterSpacing: Math.max(-20, Math.min(100, (current.letterSpacing || 0) * scaleX)) } : {}) };
    const node = nodes.current.get(current.id);
    node?.setAttrs({ x: next.x, y: next.y, rotation: next.rotation, scaleX, scaleY });
    if (done) {
      node?.scale({ x: 1, y: 1 }); proxy.scale({ x: 1, y: 1 }); proxy.rotation(0);
      commit(next); live(null);
    } else live(next);
  }
  function updated(l: DesignLayer, node: Konva.Node): DesignLayer {
    return { ...l, x: node.x(), y: node.y(), rotation: node.rotation(), width: Math.max(0.1, node.width() * node.scaleX()), height: Math.max(0.1, node.height() * node.scaleY()), ...(l.kind === 'text' ? { fontSize: Math.max(1, Math.min(200, (l.fontSize || 10) * node.scaleX())), letterSpacing: Math.max(-20, Math.min(100, (l.letterSpacing || 0) * node.scaleX())) } : {}) };
  }
  function snap(node: Konva.Node) {
    const bounds = node.getClientRect({ relativeTo: node.getParent()! });
    const targetsX = photoArea ? [photoArea.x, photoArea.x + photoArea.width / 2, photoArea.x + photoArea.width] : [0, w / 2, w, template.safeMm, w - template.safeMm], targetsY = photoArea ? [photoArea.y, photoArea.y + photoArea.height / 2, photoArea.y + photoArea.height] : [0, h / 2, h, template.safeMm, h - template.safeMm];
    for (const [id, n] of nodes.current) if (id !== selected && n.visible()) { const r = n.getClientRect({ relativeTo: n.getParent()! }); targetsX.push(r.x, r.x + r.width / 2, r.x + r.width); targetsY.push(r.y, r.y + r.height / 2, r.y + r.height); }
    const closest = (from: number[], to: number[]) => from.flatMap(a => to.map(v => ({ delta: v - a, v }))).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
    const sx = closest([bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width], targetsX), sy = closest([bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height], targetsY);
    const lines: { x?: number; y?: number } = {};
    if (Math.abs(sx.delta) < 5 / scale) { node.x(node.x() + sx.delta); lines.x = sx.v; }
    if (Math.abs(sy.delta) < 5 / scale) { node.y(node.y() + sy.delta); lines.y = sy.v; }
    setSnapLines(lines);
  }
  function pointer(stage:Konva.Stage){ const p=stage.getPointerPosition()!;return{x:p.x/scale-pad-b,y:p.y/scale-pad-b}; }
  function showImageZoom(layer: DesignLayer) {
    const node = nodes.current.get(layer.id); node?.setAttrs({ x: layer.x, y: layer.y, width: layer.width, height: layer.height, rotation: layer.rotation }); node?.getLayer()?.batchDraw(); live(layer);
  }
  function showMinimumShrinkFeedback(layer: DesignLayer) {
    const now = performance.now(), previous = shrinkFeedbackAt.current.get(layer.id) || 0;
    if (now - previous < 420) return;
    shrinkFeedbackAt.current.set(layer.id, now);
    const node = nodes.current.get(layer.id); if (!node) return;
    const insetX = layer.width * .018, insetY = layer.height * .018;
    node.setAttrs({ x: layer.x + insetX, y: layer.y + insetY, width: layer.width - insetX * 2, height: layer.height - insetY * 2 });
    node.to({ x: layer.x, y: layer.y, width: layer.width, height: layer.height, duration: .2, easing: Konva.Easings.BackEaseOut });
  }
  function touchPosition(stage: Konva.Stage, touch: Touch) { const rect = stage.container().getBoundingClientRect(); return { stage: { x: touch.clientX - rect.left, y: touch.clientY - rect.top }, design: { x: (touch.clientX - rect.left) / scale - pad - b, y: (touch.clientY - rect.top) / scale - pad - b } }; }
  function beginPinch(e: Konva.KonvaEventObject<TouchEvent>) {
    if (disabled || paint || cropBox || e.evt.touches.length !== 2) return false;
    const stage = e.target.getStage()!, first = touchPosition(stage, e.evt.touches[0]), second = touchPosition(stage, e.evt.touches[1]);
    const firstId = stage.getIntersection(first.stage)?.id(), secondId = stage.getIntersection(second.stage)?.id();
    if (!firstId || firstId !== secondId) return false;
    const layer = design.layers.find(item => item.id === firstId);
    if (!layer || layer.kind !== 'image' || layer.locked) return false;
    nodes.current.get(layer.id)?.stopDrag();
    pinchZoom.current = { id: layer.id, startDistance: Math.hypot(e.evt.touches[1].clientX - e.evt.touches[0].clientX, e.evt.touches[1].clientY - e.evt.touches[0].clientY), startLayer: layer, anchor: { x: (first.design.x + second.design.x) / 2, y: (first.design.y + second.design.y) / 2 } };
    selectMany([]); select(layer.id); e.evt.preventDefault(); e.cancelBubble = true; return true;
  }
  function movePinch(e: Konva.KonvaEventObject<TouchEvent>) {
    const gesture = pinchZoom.current; if (!gesture || e.evt.touches.length < 2) return false;
    const distance = Math.hypot(e.evt.touches[1].clientX - e.evt.touches[0].clientX, e.evt.touches[1].clientY - e.evt.touches[0].clientY);
    const next = constrainPhoto(gesture.startLayer, scaleLayerAtPoint(gesture.startLayer, distance / Math.max(1, gesture.startDistance), gesture.anchor));
    const previous = gesture.pending || gesture.startLayer;
    const blocked = distance < gesture.startDistance && Math.abs(next.width - previous.width) < .01 && Math.abs(next.height - previous.height) < .01;
    gesture.pending = next; nodes.current.get(gesture.id)?.stopDrag(); if (blocked) showMinimumShrinkFeedback(next); else showImageZoom(next); e.evt.preventDefault(); e.cancelBubble = true; return true;
  }
  function finishPinch(e: Konva.KonvaEventObject<TouchEvent>) {
    const gesture = pinchZoom.current; if (!gesture) return false;
    if (gesture.pending) commit(gesture.pending); live(null); pinchZoom.current = null; e.evt.preventDefault(); e.cancelBubble = true; return true;
  }
  useEffect(() => () => { pinchZoom.current = null; shrinkFeedbackAt.current.clear(); }, [design.templateId, design.sizeId, design.orientation]);
  function beginMarquee(e:Konva.KonvaEventObject<MouseEvent|TouchEvent>){
    if(disabled||paint||cropBox||e.target!==e.target.getStage())return;
    const start=pointer(e.target.getStage()!);const next={start,end:start,add:'shiftKey' in e.evt&&e.evt.shiftKey};
    marqueeRef.current=next;setMarquee(next);select(null);
  }
  function moveMarquee(e:Konva.KonvaEventObject<MouseEvent|TouchEvent>){
    if(!marqueeRef.current)return;const next={...marqueeRef.current,end:pointer(e.target.getStage()!)};marqueeRef.current=next;setMarquee(next);
  }
  function finishMarquee(){
    const current=marqueeRef.current;if(!current)return;
    const moved=Math.hypot(current.end.x-current.start.x,current.end.y-current.start.y)>.8;
    const hits=moved?cadSelect(design.layers,current.start,current.end):[];
    selectMany([...new Set([...(current.add?selectedIds:[]),...hits])]);marqueeRef.current=null;setMarquee(null);
  }
  const selectedBounds=design.layers.filter(l=>selectedIds.includes(l.id)&&l.visible&&!l.locked).map(l=>({id:l.id,...layerBounds(l)}));
  const marqueeBox=marquee&&{x:Math.min(marquee.start.x,marquee.end.x),y:Math.min(marquee.start.y,marquee.end.y),width:Math.abs(marquee.end.x-marquee.start.x),height:Math.abs(marquee.end.y-marquee.start.y),crossing:marquee.end.x<marquee.start.x};
  const cropHandles = cropBox ? [
    ['nw', cropBox.x, cropBox.y], ['n', cropBox.x + cropBox.width / 2, cropBox.y], ['ne', cropBox.x + cropBox.width, cropBox.y],
    ['e', cropBox.x + cropBox.width, cropBox.y + cropBox.height / 2], ['se', cropBox.x + cropBox.width, cropBox.y + cropBox.height],
    ['s', cropBox.x + cropBox.width / 2, cropBox.y + cropBox.height], ['sw', cropBox.x, cropBox.y + cropBox.height], ['w', cropBox.x, cropBox.y + cropBox.height / 2],
  ] as const : [];
  function resizeCrop(handle: string, x: number, y: number) {
    if (!cropBox || !current || !setCropBox) return;
    const min = Math.max(.8, 8 / scale), right = cropBox.x + cropBox.width, bottom = cropBox.y + cropBox.height;
    let left = cropBox.x, top = cropBox.y, nextRight = right, nextBottom = bottom;
    if (handle.includes('w')) left = Math.max(0, Math.min(right - min, x));
    if (handle.includes('e')) nextRight = Math.min(current.width, Math.max(left + min, x));
    if (handle.includes('n')) top = Math.max(0, Math.min(bottom - min, y));
    if (handle.includes('s')) nextBottom = Math.min(current.height, Math.max(top + min, y));
    setCropBox({ x: left, y: top, width: nextRight - left, height: nextBottom - top });
  }
  return <><div className="canvas-scroll" data-testid="editor-canvas" data-bounded-controls={bounded}>
    <div style={{ position: 'relative', width: stageW, height: stageH, margin: 'auto' }}><Stage width={stageW} height={stageH} onMouseDown={beginMarquee} onTouchStart={e => { if (!beginPinch(e)) beginMarquee(e); }} onMouseMove={moveMarquee} onTouchMove={e => { if (!movePinch(e)) moveMarquee(e); }} onMouseUp={finishMarquee} onTouchEnd={e => { if (!finishPinch(e)) finishMarquee(); }}>
      <Layer><Group x={pad * scale} y={pad * scale} scaleX={scale} scaleY={scale}>
        <Rect width={fullW} height={fullH} cornerRadius={radius} fill="#ffffff" shadowColor="#183d39" shadowBlur={12} shadowOpacity={0.12} listening={false}/>
        <Group clipFunc={ctx => { ctx.beginPath(); ctx._context.roundRect(0, 0, fullW, fullH, radius); }}>
          <Shape sceneFunc={ctx => drawSubstrate(ctx._context, design, fullW, fullH, template.presentation === 'acrylic-badge' ? 0.035 : 0.16)} listening={false}/>
          <Group x={b} y={b}>
            {(erased || design.layers).map(l => <Shape key={l.id} ref={n => { if (n) nodes.current.set(l.id, n); else nodes.current.delete(l.id); }} id={l.id} x={l.x} y={l.y} width={l.width} height={l.height} rotation={l.rotation} visible={l.visible} draggable={!cropBox && !l.locked && !disabled && !paint} listening={!l.locked && !disabled && !paint}
              sceneFunc={ctx => drawLayer(ctx._context, l, images.get(l.assetId || ''), 'preview', scale)}
              hitFunc={(ctx, shape) => { ctx.beginPath(); ctx.rect(0, 0, l.width, l.height); ctx.closePath(); ctx.fillStrokeShape(shape); }}
              onClick={e => { if(e.evt.shiftKey && !isPhoto(l))selectMany([...new Set([...selectedIds,l.id])]);else{selectMany([]);select(l.id);} }} onTap={() => {selectMany([]);select(l.id);}} onDragStart={e => {
                if(isPhoto(l)){selectMany([]);select(l.id);}
                else if(selectedIds.includes(l.id)){groupDrag.current={id:l.id,startX:e.target.x(),startY:e.target.y(),original:new Map(design.layers.filter(x=>selectedIds.includes(x.id)&&x.visible&&!x.locked).map(x=>[x.id,{x:x.x,y:x.y}]))};}
                else{selectMany([]);select(l.id);}
              }}
              onDragMove={e => { const group=groupDrag.current;if(group){const dx=e.target.x()-group.startX,dy=e.target.y()-group.startY;for(const[id,p]of group.original){if(id!==l.id)nodes.current.get(id)?.position({x:p.x+dx,y:p.y+dy});}liveMany(design.layers.map(x=>{const p=group.original.get(x.id);return p?{...x,x:p.x+dx,y:p.y+dy}:x;}));}else{const next=constrainPhoto(l,updated(l,e.target));if(isPhoto(l))e.target.position({x:next.x,y:next.y});else if(guides)snap(e.target);live(next);} }}
              onDragEnd={e => { const group=groupDrag.current;if(group){const dx=e.target.x()-group.startX,dy=e.target.y()-group.startY;replaceLayers(design.layers.map(x=>{const p=group.original.get(x.id);return p?{...x,x:p.x+dx,y:p.y+dy}:x;}));liveMany(null);groupDrag.current=null;}else{commit(constrainPhoto(l,updated(l,e.target)));live(null);setSnapLines({});} }}
              onTransform={() => live(updated(l, nodes.current.get(l.id)!))}
              onTransformEnd={() => { const node = nodes.current.get(l.id)!; const next = updated(l, node); node.scale({ x: 1, y: 1 }); commit(next); live(null); }}
            />)}
            {ink && <Shape x={ink.x} y={ink.y} listening={false} sceneFunc={ctx => drawLayer(ctx._context, ink)}/>}
            <Shape listening={false} sceneFunc={ctx => drawPhotoBorder(ctx._context, design, template)}/>
            {cropBox && current?.kind === 'image' && <Group x={current.x} y={current.y} rotation={current.rotation}>
              <Rect x={0} y={0} width={current.width} height={cropBox.y} fill="#10201c99" listening={false}/>
              <Rect x={0} y={cropBox.y + cropBox.height} width={current.width} height={Math.max(0, current.height - cropBox.y - cropBox.height)} fill="#10201c99" listening={false}/>
              <Rect x={0} y={cropBox.y} width={cropBox.x} height={cropBox.height} fill="#10201c99" listening={false}/>
              <Rect x={cropBox.x + cropBox.width} y={cropBox.y} width={Math.max(0, current.width - cropBox.x - cropBox.width)} height={cropBox.height} fill="#10201c99" listening={false}/>
              <Rect x={cropBox.x} y={cropBox.y} width={cropBox.width} height={cropBox.height} fill="rgba(255,255,255,0.001)" stroke="#ffffff" strokeWidth={Math.max(.35, 1.5 / scale)} draggable
                dragBoundFunc={pos => ({ x: Math.max(0, Math.min(current.width - cropBox.width, pos.x)), y: Math.max(0, Math.min(current.height - cropBox.height, pos.y)) })}
                onDragMove={e => setCropBox?.({ ...cropBox, x: e.target.x(), y: e.target.y() })}/>
              {[1 / 3, 2 / 3].flatMap(n => [<Line key={`v${n}`} points={[cropBox.x + cropBox.width * n, cropBox.y, cropBox.x + cropBox.width * n, cropBox.y + cropBox.height]} stroke="#ffffff99" strokeWidth={Math.max(.2, .7 / scale)} listening={false}/>, <Line key={`h${n}`} points={[cropBox.x, cropBox.y + cropBox.height * n, cropBox.x + cropBox.width, cropBox.y + cropBox.height * n]} stroke="#ffffff99" strokeWidth={Math.max(.2, .7 / scale)} listening={false}/>])}
              {cropHandles.map(([handle, x, y]) => <Rect key={handle} x={x} y={y} offsetX={Math.max(1.3, 5 / scale)} offsetY={Math.max(1.3, 5 / scale)} width={Math.max(2.6, 10 / scale)} height={Math.max(2.6, 10 / scale)} fill="#ffffff" stroke="#173f36" strokeWidth={Math.max(.25, 1 / scale)} draggable
                onDragMove={e => resizeCrop(handle, e.target.x(), e.target.y())}/>) }
            </Group>}
          </Group>
        </Group>
        {slot && <Rect x={b + slot.x} y={b + slot.y} width={slot.width} height={slot.height} cornerRadius={slot.radius} fill="#dbe3db" stroke="#7a8e82" strokeWidth={0.25} onClick={() => select(null)} onTap={() => select(null)}/>}
        {guides && <Group listening={false}>
          <Rect x={b} y={b} width={w} height={h} cornerRadius={radius} stroke={photoArea ? "#b5bdb1" : "#b67b52"} strokeWidth={0.35} dash={photoArea ? undefined : [2, 2]}/>
          <Rect x={b + (photoArea?.x ?? template.safeMm)} y={b + (photoArea?.y ?? template.safeMm)} width={photoArea?.width ?? w - 2 * template.safeMm} height={photoArea?.height ?? h - 2 * template.safeMm} cornerRadius={Math.max(0, radius - template.safeMm)} stroke="#438a80" strokeWidth={0.35} dash={[2, 2]}/>
          {zones(design, template).map((z, i) => <Rect key={i} x={b + z.x} y={b + z.y} width={z.width} height={z.height} fill="#e75d5d44" stroke="#cf4444" strokeWidth={0.4}/>)}
          {snapLines.x !== undefined && <Line points={[b + snapLines.x, 0, b + snapLines.x, fullH]} stroke="#df5a95" strokeWidth={0.45}/>}
          {snapLines.y !== undefined && <Line points={[0, b + snapLines.y, fullW, b + snapLines.y]} stroke="#df5a95" strokeWidth={0.45}/>}
        </Group>}
        <Group listening={false}>{selectedBounds.map(s=><Rect key={s.id} x={b+s.x} y={b+s.y} width={s.width} height={s.height} stroke="#245f52" strokeWidth={.55} dash={[2,1]}/>)}
          {marqueeBox&&<Rect x={b+marqueeBox.x} y={b+marqueeBox.y} width={marqueeBox.width} height={marqueeBox.height} fill={marqueeBox.crossing?'#65a77d26':'#5c91c626'} stroke={marqueeBox.crossing?'#397b50':'#376e9e'} strokeWidth={.55} dash={marqueeBox.crossing?[2,1]:undefined}/>}</Group>
        {bounded && <Rect ref={proxyRef} x={px} y={py} width={pw} height={ph} listening={false} onTransform={() => transformProxy()} onTransformEnd={() => transformProxy(true)}/>}
        <Transformer ref={transformRef} flipEnabled={false} keepRatio={current?.kind !== 'image' || current.aspectRatioLocked !== false} shiftBehavior={current?.kind === 'image' ? 'inverted' : 'default'} rotateAnchorOffset={26} anchorSize={12} anchorCornerRadius={3} borderStroke="#255f55" anchorStroke="#255f55" anchorFill="#ffffff" enabledAnchors={current?.kind === 'image' && current.aspectRatioLocked === false ? ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'] : ['top-left', 'top-right', 'bottom-left', 'bottom-right']} boundBoxFunc={(old, next) => {
          if (!current || next.width < 8 || next.height < 8 || next.width > 2500 || next.height > 2500) return old;
          // The visible proxy can be much smaller than the actual layer.
          const width = next.width / scale * (bounded ? current.width / pw : 1);
          const height = next.height / scale * (bounded ? current.height / ph : 1);
          return validLayerSize(width, height) ? next : old;
        }}/>
      </Group></Layer>
    </Stage>
    {paint && !disabled && <div aria-label="繪畫區" style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'crosshair' }}
      onPointerDown={e => {
        const rect = e.currentTarget.getBoundingClientRect(), x = (e.clientX - rect.left) / scale - pad - b, y = (e.clientY - rect.top) / scale - pad - b;
        if (x < 0 || y < 0 || x > w || y > h) return;
        select(null); e.currentTarget.setPointerCapture(e.pointerId);
        if (paint.mode === 'petals') { createBatch(scatterPetals(x, y, Math.min(w, paint.size * 6), Math.min(h, paint.size * 7), paint.size, paint.count || 6, paint.flowerType || 'sakura', paint.opacity, w, h)); return; }
        if (paint.mode === 'stamp') { if (paint.assetId) create(newLayer('image', { name: '花瓣印章', assetId: paint.assetId, x: x - paint.size / 2, y: y - paint.size / 2, width: paint.size, height: paint.size, rotation: paint.rotation, opacity: paint.opacity })); return; }
        drawing.current = [x, y, x, y]; if (paint.mode === 'eraser') setErased(eraseLayers(design.layers, drawing.current, paint.size)); else setInk(stroke(drawing.current));
      }}
      onPointerMove={e => {
        if (!drawing.current.length || drawing.current.length >= 12000) return;
        const rect = e.currentTarget.getBoundingClientRect(), x = Math.max(0, Math.min(w, (e.clientX - rect.left) / scale - pad - b)), y = Math.max(0, Math.min(h, (e.clientY - rect.top) / scale - pad - b));
        drawing.current.push(x, y); if (paint.mode === 'eraser') setErased(eraseLayers(design.layers, drawing.current, paint.size)); else setInk(stroke(drawing.current));
      }}
      onPointerUp={() => { if (drawing.current.length) { if (paint.mode === 'eraser') replaceLayers(eraseLayers(design.layers, drawing.current, paint.size)); else create(stroke(drawing.current)); } drawing.current = []; setInk(null); setErased(null); }}
      onPointerCancel={() => { drawing.current = []; setInk(null); setErased(null); }} />}
    </div>
  </div>{bounded && <p className="selection-overview-note">控制框已限制在可見範圍；拖曳角落調整完整圖層，畫布縮放保持不變。</p>}</>;
}
export function Preview({ design, template, images, resolutionScale = 2.2 }: Pick<Props, 'design' | 'template' | 'images'> & { resolutionScale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null), { w, h } = dimensions(design, template), scale = resolutionScale;
  useEffect(() => { const canvas = ref.current, ctx = canvas?.getContext('2d'); if (ctx && canvas) { canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale); ctx.clearRect(0, 0, canvas.width, canvas.height); drawDesign(ctx, design, template, images, 'preview', scale, false); } }, [design, template, images, w, h, scale]);
  return <canvas ref={ref} width={Math.round(w * scale)} height={Math.round(h * scale)} data-testid="product-preview" aria-label="同步成品預覽，不含編輯控制點"/>;
}

