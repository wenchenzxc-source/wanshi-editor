import { scatterPetals } from '../shared/petals';
import { clampCoverPosition, remapImagesToCanvas, resizeLayerDimension } from '../shared/transform';
import { removeEmptyStrokes } from '../shared/eraser';
import { PrintStackPicker } from './PrintStackPicker';
import { fonts, getFont, type FontId } from '../shared/fonts';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, ApiError, uploadAssets } from './api';
import { type CropBox, type PaintTool, EditorCanvas, Preview, useImages } from './Canvas';
import { LayerWindow } from './LayerWindow';
import { ProductScene } from './ProductScene';
import { PhotoHolderOptions, defaultPhotoHolder } from './PhotoHolder';
import { dimensions, fitFrames, emptyDesign, newLayer, materials, supportsDuplex, withPrintStack, stackLabel, resolveTemplate, badgeAccessories, badgeRadius, photoImageArea, type Material, type Asset, type Design, type DesignLayer, type Template, type VersionInfo } from '../shared/model';
import './styles.css';
import './studio.css';
import { ArtLibrary } from './ArtLibrary';
import { artCatalog } from '../shared/artwork';
import { textFont, wrapTextLines } from '../shared/draw';
import { Cart, type CartItem } from './Cart';
import { assetUrl, publicUrl, staticDemo } from './urls';
import { effectiveImagePpi, imageQualityIssues, MIN_IMAGE_PPI, TARGET_PRINTER_DPI } from '../shared/print-quality';
import { StudioApp } from './Studio';

type Loaded = { design: Design; revision: number; assets: Asset[]; versions: VersionInfo[] };
type Config = { templates: Template[]; backgroundRemoval: boolean; directUpload?: boolean };
type Saved = { id: string; name: string; updatedAt: string };
function fitPhotoImageLayer(layer: DesignLayer, asset: Pick<Asset, 'width' | 'height'>, design: Design, template: Template, reset = false) {
  const area = photoImageArea(design, template);
  if (!area || !asset.width || !asset.height) return layer;
  const ratio = asset.width / asset.height;
  const baseWidth = Math.max(area.width, area.height * ratio), baseHeight = baseWidth / ratio;
  const zoom = reset ? 1 : Math.max(1, layer.width / baseWidth, layer.height / baseHeight);
  const width = baseWidth * zoom, height = baseHeight * zoom;
  const x = reset ? area.x + (area.width - width) / 2 : clampCoverPosition(layer.x, area.x, area.width, width);
  const y = reset ? area.y + (area.height - height) / 2 : clampCoverPosition(layer.y, area.y, area.height, height);
  return { ...layer, x, y, width, height, rotation: 0, cropX: undefined, cropY: undefined, cropWidth: undefined, cropHeight: undefined };
}
function normalizePhotoDesign(design: Design, template: Template, assets: Asset[]) {
  if (template.presentation !== 'photo-holder') return design;
  const byId = new Map(assets.filter(asset => !asset.libraryArtworkId).map(asset => [asset.id, asset]));
  const next = { ...design, orientation: 'portrait' as const, photoHolder: { ...defaultPhotoHolder, ...design.photoHolder, paperLayout: 'full' as const } };
  return { ...next, layers: next.layers.map(layer => layer.kind === 'image' && layer.assetId && byId.has(layer.assetId) ? fitPhotoImageLayer(layer, byId.get(layer.assetId)!, next, template) : layer) };
}
function App() {
  const shiftHeld = useRef(false);
  useEffect(() => {
    const update = (event: KeyboardEvent | PointerEvent) => { shiftHeld.current = event.shiftKey; };
    const reset = () => { shiftHeld.current = false; };
    window.addEventListener('keydown', update);
    window.addEventListener('keyup', update);
    window.addEventListener('pointerdown', update);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);
    return () => {
      window.removeEventListener('keydown', update);
      window.removeEventListener('keyup', update);
      window.removeEventListener('pointerdown', update);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset);
    };
  }, []);
  const [cart, setCart] = useState<CartItem[]>([]), [showCart, setShowCart] = useState(false);
  const confirmationCache = useRef<{ revision: number; designId: string; version: VersionInfo } | null>(null);
  const [paintMode, setPaintMode] = useState<'select' | 'pen' | 'stamp' | 'petals' | 'eraser'>('select'), [paintColor, setPaintColor] = useState('#b87987'), [paintSize, setPaintSize] = useState(2), [paintOpacity, setPaintOpacity] = useState(1), [stampAsset, setStampAsset] = useState<string>(), [stampRotation, setStampRotation] = useState(0);
  const [flowerType, setFlowerType] = useState<'sakura' | 'rose'>('sakura'), [petalCount, setPetalCount] = useState(6);
  const [transientMany, setTransientMany] = useState<DesignLayer[] | null>(null);
  const [cropBox, setCropBox] = useState<CropBox | null>(null);
  const [marquee, setMarquee] = useState(false), [contained, setContained] = useState(false), [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fontChoice, setFontChoice] = useState<FontId>('sans');
  const [config, setConfig] = useState<Config>(), [design, setDesign] = useState<Design>(), [assets, setAssets] = useState<Asset[]>([]), [versions, setVersions] = useState<VersionInfo[]>([]);
  const [selected, setSelectedState] = useState<string | null>(null), [transient, setTransient] = useState<DesignLayer | null>(null), [zoom, setZoom] = useState(1), [guides, setGuides] = useState(true);
  const [tab, setTab] = useState('uploads'), [savedList, setSavedList] = useState<Saved[]>([]), [showLibrary, setShowLibrary] = useState(false);
  const [status, setStatus] = useState('連線中…'), [error, setError] = useState(''), [busy, setBusy] = useState(false), [confirmation, setConfirmation] = useState(false), [readyFont, setReadyFont] = useState(false);
  const [history, setHistory] = useState<{ past: Design[]; future: Design[] }>({ past: [], future: [] });
  const designRef = useRef<Design | undefined>(undefined), revision = useRef(1), lastSaved = useRef(''), queue = useRef<Promise<unknown>>(Promise.resolve()), boot = useRef(false), fileInput = useRef<HTMLInputElement>(null), previousTool = useRef('uploads');
  const { images, failed } = useImages(assets);
  const baseTemplate = config?.templates.find(t => t.id === design?.templateId);
  const template = baseTemplate && design ? resolveTemplate(design, baseTemplate) : undefined;
  useEffect(() => { setSelectedIds([]); }, [design?.id, selected]);
  const face = 'front';
  const faceLayers = design?.layers.filter(l => (l.face || 'front') === face) || [];
  const canvasDesign = design && { ...design, layers: faceLayers };
  const chosen = faceLayers.find(l => l.id === selected);
  function setSelected(id: string | null) {
    if (id !== selected) setCropBox(null);
    setSelectedState(id);
    const next = id ? designRef.current?.layers.find(layer => layer.id === id) : undefined;
    const editingTab = tab === 'image' || tab === 'text-edit';
    if (next?.kind === 'image') {
      if (!editingTab) previousTool.current = tab;
      setTab('image'); setPaintMode('select');
      requestAnimationFrame(() => document.querySelector('.asset-panel')?.scrollTo({ top: 0 }));
    } else if (next?.kind === 'text') {
      if (!editingTab) previousTool.current = tab;
      setTab('text-edit'); setPaintMode('select');
      requestAnimationFrame(() => document.querySelector('.asset-panel')?.scrollTo({ top: 0 }));
    } else if (editingTab) setTab(previousTool.current);
  }
  const fitZoom = () => {
    if (!design || !template) return 1;
    const area = document.querySelector('.editor-area');
    const d = dimensions(design, template);
    const widthFit = ((area?.clientWidth || 600) - 104) / ((d.fullW + 24) * 2.6);
    return (template.presentation?.startsWith('acrylic-') || template.presentation === 'photo-holder')
      ? Math.max(0.1, Math.min(10, widthFit, 440 / ((d.fullH + 24) * 2.6)))
      : Math.min(1, widthFit);
  };
  useEffect(() => {
    setZoom(fitZoom());
    const resize = () => setZoom(fitZoom());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [design?.id, design?.orientation, design?.sizeId, design?.customSize?.widthMm, design?.customSize?.heightMm, template?.id]);
  const retiredSize = template?.sizes?.find(size => size.id === design?.sizeId && size.retired);

  const preview = design && transientMany ? { ...design, layers: design.layers.map(l => transientMany.find(v => v.id === l.id) || l) } : design && transient ? { ...design, layers: design.layers.map(l => l.id === transient.id ? transient : l) } : design;
  const applyLoaded = (loaded: Loaded, availableTemplates = config?.templates || []) => { setPaintMode('select'); setStampAsset(undefined); const original = JSON.stringify(loaded.design); const cleaned = { ...loaded.design, layers: removeEmptyStrokes(loaded.design.layers) }; const target = availableTemplates.find(t => t.id === cleaned.templateId); const normalized = target ? normalizePhotoDesign(cleaned, target, loaded.assets) : cleaned; loaded = { ...loaded, design: withPrintStack(normalized, normalized.printStack || (normalized.duplex ? 'cmyk-white-cmyk' : normalized.printView === 'acrylic' ? 'cmyk-white' : 'white-cmyk')) }; designRef.current = loaded.design; revision.current = loaded.revision; lastSaved.current = original; setDesign(loaded.design); setAssets(loaded.assets); setVersions(loaded.versions); setSelected(null); setHistory({ past: [], future: [] }); setStatus('所有變更已儲存'); localStorage.setItem('wanshi:last-design', loaded.design.id); };
  const report = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
  const save = useCallback((target?: Design) => {
    const task = async () => {
      const d = target || designRef.current; if (!d) throw new Error('尚未載入設計');
      if (lastSaved.current === JSON.stringify(d)) return revision.current;
      setStatus('儲存中…');
      try { const r = await api<{ revision: number }>(`/designs/${d.id}`, { method: 'PUT', body: JSON.stringify({ design: d, baseRevision: revision.current }) }); revision.current = r.revision; lastSaved.current = JSON.stringify(d); setStatus(JSON.stringify(designRef.current) === lastSaved.current ? '所有變更已儲存' : '有變更 · 等待儲存'); return r.revision; }
      catch (e) { setStatus('儲存失敗 · 請重試'); throw e; }
    };
    const next = queue.current.catch(() => {}).then(task); queue.current = next; return next;
  }, []);
  useEffect(() => {
    if (boot.current) return; boot.current = true;
    (async () => {
      await api('/session', { method: 'POST' }); const c = await api<Config>('/config'); setConfig(c); setCart(await api<CartItem[]>('/cart'));
      await Promise.all(fonts.map(async f => { const font = new FontFace(f.family, `url(${publicUrl(`fonts/${f.file}`)})`, { weight: f.id === 'sans' || f.id === 'serif' ? '100 900' : '400' }); await font.load(); document.fonts.add(font); })); setReadyFont(true);
      const id = localStorage.getItem('wanshi:last-design');
      if (id) { try { applyLoaded(await api<Loaded>(`/designs/${id}`), c.templates); return; } catch (e) { if (!(e instanceof ApiError && e.status === 404)) throw e; } }
      applyLoaded(await api<Loaded>('/designs', { method: 'POST', body: JSON.stringify(emptyDesign(c.templates[0])) }), c.templates);
    })().catch(report);
  }, []);
  useEffect(() => { if (!design || busy) return; const timer = setTimeout(() => { save().catch(report); }, 900); return () => clearTimeout(timer); }, [design, busy, save]);
  useEffect(() => { const leave = (e: BeforeUnloadEvent) => { if (JSON.stringify(designRef.current) !== lastSaved.current) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave); }, []);
  function change(next: Design) {
    next = { ...next, layers: removeEmptyStrokes(next.layers) };
    const old = designRef.current!;
    const target = config?.templates.find(t => t.id === next.templateId);
    const oldTarget = config?.templates.find(t => t.id === old.templateId);
    if (target && oldTarget) {
      const before = dimensions(old, oldTarget), after = dimensions(next, target);
      if (before.w !== after.w || before.h !== after.h || old.templateId !== next.templateId) next = { ...next, layers: remapImagesToCanvas(next.layers, before, after, target.safeMm) };
    }
    if (target?.presentation === 'photo-holder') next = normalizePhotoDesign(next, target, assets);
    if (target) next = fitFrames(next, target);
    if (next.slot?.enabled && target?.presentation === 'acrylic-badge') {
      const size = dimensions(next, target);
      next = { ...next, slot: { ...next.slot, widthMm: Math.min(next.slot.widthMm, Math.floor(size.w - target.safeMm * 2)), heightMm: Math.min(next.slot.heightMm, Math.floor(size.h - 5 - target.safeMm)) } };
    }
 if (next.sizeId === 'custom' && next.customSize) { const c = next.customSize; next = { ...next, customSize: { ...c, thicknessMm: Math.min(c.thicknessMm, c.widthMm, c.heightMm, 50) } }; } if (JSON.stringify(old) === JSON.stringify(next)) return; setHistory(h => ({ past: [...h.past.slice(-79), old], future: [] })); designRef.current = next; setDesign(next); setStatus('有變更 · 等待儲存'); }
  function patchLayer(patch: Partial<DesignLayer>, id = selected) { if (!id || !designRef.current) return; change({ ...designRef.current, layers: designRef.current.layers.map(l => l.id === id ? { ...l, ...patch } : l) }); }
  function undo(redo = false) { const stack = redo ? history.future : history.past; if (!stack.length) return; const next = stack[stack.length - 1], current = designRef.current!; setHistory(h => redo ? { past: [...h.past, current], future: h.future.slice(0, -1) } : { past: h.past.slice(0, -1), future: [...h.future, current] }); designRef.current = next; setDesign(next); setSelected(null); setSelectedIds([]); setStatus('有變更 · 等待儲存'); }
  function fitNewLayer(layer: DesignLayer) { if (!template || !design) return layer; const { w, h } = dimensions(design, template); if (layer.x >= 0 && layer.y >= 0 && layer.x + layer.width <= w && layer.y + layer.height <= h) return layer; const ratio = Math.min(1, (w - 2 * template.safeMm) / layer.width, (h - 2 * template.safeMm) / layer.height); const width = layer.width * ratio, height = layer.height * ratio; return { ...layer, width, height, x: (w - width) / 2, y: (h - height) / 2, ...(layer.kind === 'text' ? { fontSize: Math.max(1, Math.min(200, (layer.fontSize || 10) * ratio)), letterSpacing: (layer.letterSpacing || 0) * ratio } : {}) }; }
  function add(layer: DesignLayer) { const asset = layer.assetId ? assets.find(item => item.id === layer.assetId && !item.libraryArtworkId) : undefined; layer = { ...(template?.presentation === 'photo-holder' && asset ? fitPhotoImageLayer(layer, asset, design!, template, true) : fitNewLayer(layer)), face }; change({ ...designRef.current!, layers: [...designRef.current!.layers, layer] }); setSelected(layer.id); }
  function remove() { if (selectedIds.length) { change({ ...design!, layers: design!.layers.filter(l => !selectedIds.includes(l.id) || l.locked || !l.visible) }); setSelectedIds([]); return; } if (!chosen || (chosen.locked && chosen.kind !== 'frame')) return; change({ ...design!, layers: design!.layers.filter(l => l.id !== chosen.id) }); setSelected(null); }
  function duplicate() { if (chosen) add({ ...chosen, id: crypto.randomUUID(), name: chosen.name + ' 副本', x: chosen.x + 5, y: chosen.y + 5, locked: false }); }
  useEffect(() => { const key = (e: KeyboardEvent) => { if (busy || (e.target as HTMLElement).matches('input, textarea, select')) return; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(e.shiftKey); } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); undo(true); } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); } else if (chosen && !chosen.locked && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); const photoAsset = template?.presentation === 'photo-holder' && chosen.assetId ? assets.find(asset => asset.id === chosen.assetId && !asset.libraryArtworkId) : undefined; const step = e.shiftKey ? 5 : 0.5; if (photoAsset) { const next = fitPhotoImageLayer({ ...chosen, x: chosen.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0), y: chosen.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0) }, photoAsset, design!, template!); patchLayer(next); return; } patchLayer({ x: chosen.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0), y: chosen.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0) }); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); });
  async function run(task: () => Promise<void>) { setBusy(true); setError(''); try { await task(); } catch (e) { report(e); } finally { setBusy(false); } }
  async function upload(files: FileList | File[]) {
    if (!files.length || busy) return;
    await run(async () => {
      const list = await uploadAssets<Asset[]>(design!.id, Array.from(files), config?.directUpload); setAssets(a => [...a, ...list]);
      const layers = list.map((a, i) => { const layer = newLayer('image', { name: a.originalName, assetId: a.id, face, x: 20 + i * 7, y: 25 + i * 7, width: 85, height: 85 * a.height / a.width }); return template?.presentation === 'photo-holder' ? fitPhotoImageLayer(layer, a, design!, template, true) : fitNewLayer(layer); });
      change({ ...designRef.current!, layers: [...designRef.current!.layers, ...layers] }); setSelected(layers.at(-1)!.id);
      await save(designRef.current);
    });
  }
  async function confirm(addToCart = false) { await run(async () => {
    const r = await save(designRef.current);
    let v = confirmationCache.current?.revision === r && confirmationCache.current.designId === design!.id ? confirmationCache.current.version : undefined;
    if (!v) { v = await api<VersionInfo>(`/designs/${design!.id}/confirm`, { method: 'POST', body: JSON.stringify({ revision: r }) }); confirmationCache.current = { revision: r, designId: design!.id, version: v }; setVersions(vs => [...vs, v!]); }
    if (addToCart) { await api('/cart', { method: 'POST', body: JSON.stringify({ versionId: v.id }) }); setCart(await api<CartItem[]>('/cart')); setShowCart(true); }
    else setStatus('確認圖與製作包已保存');
    setConfirmation(false);
  }); }
  async function addArtwork(artworkId: string) { await run(async () => {
    const entry = artCatalog.find(a => a.id === artworkId);
    if (entry?.category === '圖框') {
      let frameAsset = entry.file ? assets.find(a => !a.deletedAt && a.libraryArtworkId === entry.id) : undefined;
      if (entry.file && !frameAsset) {
        frameAsset = await api<Asset>(`/designs/${design!.id}/library`, { method: 'POST', body: JSON.stringify({ artworkId }) });
        setAssets(a => [...a, frameAsset!]);
      }
      const frame = newLayer('frame', { name: entry.name, frameId: artworkId as NonNullable<DesignLayer['frameId']>, ...(frameAsset ? { assetId: frameAsset.id } : {}), locked: true });
      const names = artCatalog.filter(a => a.category === '圖框').map(a => a.name as string);
      change({ ...designRef.current!, layers: [...designRef.current!.layers.filter(l => l.kind !== 'frame' && !(l.kind === 'image' && names.includes(l.name) && assets.some(a => a.id === l.assetId && names.some(n => a.originalName === `${n}.png`)))), frame] });
      setSelected(frame.id); await save(designRef.current); return;
    }
    const asset = await api<Asset>(`/designs/${design!.id}/library`, { method: 'POST', body: JSON.stringify({ artworkId }) });
    setAssets(a => [...a, asset]); const size = dimensions(design!, template!); const edge = Math.min(size.w, size.h) * .65;
    add(newLayer('image', { name: asset.originalName.replace('.png', ''), assetId: asset.id, x: (size.w - edge) / 2, y: (size.h - edge) / 2, width: edge, height: edge })); await save(designRef.current);
  }); }
  async function updateCart(id: string, quantity: number) { await run(async () => { await api(`/cart/${id}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }); setCart(await api<CartItem[]>('/cart')); }); }

  async function openDesign(id: string) { await run(async () => { await save(designRef.current); applyLoaded(await api<Loaded>(`/designs/${id}`)); setShowLibrary(false); }); }
  async function newDesign() { await run(async () => { await save(designRef.current); applyLoaded(await api<Loaded>('/designs', { method: 'POST', body: JSON.stringify(emptyDesign(config!.templates[0])) })); setShowLibrary(false); }); }
  async function restore(id: string) { await run(async () => { const v = await api<{ design: Design }>(`/versions/${id}`); change(withPrintStack(v.design, v.design.printStack || (v.design.duplex ? 'cmyk-white-cmyk' : v.design.printView === 'acrylic' ? 'cmyk-white' : 'white-cmyk'))); setSelected(null); await save(designRef.current); }); }
  async function cutout() { if (!chosen?.assetId) return; await run(async () => { const result = await api<Asset>(`/assets/${chosen.assetId}/remove-background`, { method: 'POST' }); setAssets(a => [...a, result]); patchLayer({ assetId: result.id }); await save(designRef.current); }); }
  const mm = design && template ? dimensions(design, template) : undefined;
  const offCanvasLayerIds = new Set(mm ? faceLayers.filter(layer => layer.visible && layer.kind !== 'frame' && (layer.x + layer.width <= 0 || layer.y + layer.height <= 0 || layer.x >= mm.w || layer.y >= mm.h)).map(layer => layer.id) : []);
  const selectedAsset = assets.find(a => a.id === chosen?.assetId);
  const photoAssetIds = new Set(assets.filter(asset => !asset.libraryArtworkId).map(asset => asset.id));
  const chosenIsPhoto = template?.presentation === 'photo-holder' && !!chosen?.assetId && photoAssetIds.has(chosen.assetId);
  const effectivePpi = selectedAsset && chosen ? effectiveImagePpi(chosen, selectedAsset) : null;
  const qualityIssues = design ? imageQualityIssues(design, assets) : [];
  const startCrop = () => { if (chosen?.kind === 'image') { setCropBox({ x: 0, y: 0, width: chosen.width, height: chosen.height }); setPaintMode('select'); } };
  const cropRatio = (ratio: number | null) => {
    if (!chosen || !cropBox) return;
    if (!ratio) { setCropBox({ x: 0, y: 0, width: chosen.width, height: chosen.height }); return; }
    let width = chosen.width, height = width / ratio;
    if (height > chosen.height) { height = chosen.height; width = height * ratio; }
    setCropBox({ x: (chosen.width - width) / 2, y: (chosen.height - height) / 2, width, height });
  };
  const applyCrop = () => {
    if (!chosen || chosen.kind !== 'image' || !cropBox) return;
    const sourceX = chosen.cropX ?? 0, sourceY = chosen.cropY ?? 0, sourceWidth = chosen.cropWidth ?? 1, sourceHeight = chosen.cropHeight ?? 1;
    const angle = chosen.rotation * Math.PI / 180;
    patchLayer({
      x: chosen.x + cropBox.x * Math.cos(angle) - cropBox.y * Math.sin(angle),
      y: chosen.y + cropBox.x * Math.sin(angle) + cropBox.y * Math.cos(angle),
      width: cropBox.width, height: cropBox.height,
      cropX: sourceX + sourceWidth * cropBox.x / chosen.width,
      cropY: sourceY + sourceHeight * cropBox.y / chosen.height,
      cropWidth: sourceWidth * cropBox.width / chosen.width,
      cropHeight: sourceHeight * cropBox.height / chosen.height,
    });
    setCropBox(null);
  };
  const clearCrop = () => {
    if (chosen?.kind !== 'image') return;
    const sourceRatio = selectedAsset?.width && selectedAsset.height ? selectedAsset.width / selectedAsset.height : chosen.width / chosen.height;
    const area = chosen.width * chosen.height, width = Math.sqrt(area * sourceRatio), height = width / sourceRatio;
    const localX = (chosen.width - width) / 2, localY = (chosen.height - height) / 2, angle = chosen.rotation * Math.PI / 180;
    patchLayer({ x: chosen.x + localX * Math.cos(angle) - localY * Math.sin(angle), y: chosen.y + localX * Math.sin(angle) + localY * Math.cos(angle), width, height, cropX: undefined, cropY: undefined, cropWidth: undefined, cropHeight: undefined });
    setCropBox(null);
  };
  const restoreImageRatio = () => {
    if (chosen?.kind !== 'image' || !selectedAsset?.width || !selectedAsset.height) return;
    const ratio = selectedAsset.width * (chosen.cropWidth ?? 1) / (selectedAsset.height * (chosen.cropHeight ?? 1));
    const area = chosen.width * chosen.height, width = Math.sqrt(area * ratio), height = width / ratio;
    const localX = (chosen.width - width) / 2, localY = (chosen.height - height) / 2, angle = chosen.rotation * Math.PI / 180;
    patchLayer({ x: chosen.x + localX * Math.cos(angle) - localY * Math.sin(angle), y: chosen.y + localX * Math.sin(angle) + localY * Math.cos(angle), width, height });
  };
  useEffect(() => {
    if (!cropBox) return;
    const keyboardCrop = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setCropBox(null); }
      if (event.key === 'Enter') { event.preventDefault(); applyCrop(); }
    };
    window.addEventListener('keydown', keyboardCrop);
    return () => window.removeEventListener('keydown', keyboardCrop);
  }, [cropBox, chosen]);
  function switchProduct(id: string) {
    if (!design || id === design.templateId) return;
 const next = config!.templates.find(t => t.id === id)!; change(withPrintStack({ ...design, templateId: next.id, sizeId: next.sizes?.[0].id, orientation: next.presentation === 'photo-holder' ? 'portrait' : design.orientation, customSize: undefined, slot: undefined, badgeAccessory: undefined, badgeCornerRadiusMm: undefined, photoHolder: next.presentation === 'photo-holder' ? { ...defaultPhotoHolder } : undefined, material: next.allowedMaterials?.[0] || design.material }, next.presentation === 'photo-holder' ? 'white-cmyk' : design.printStack || 'white-cmyk')); setSelected(null); setTransient(null);   }
  if (!design || !template || !readyFont) return <div className="loading"><div className="brand-symbol">萬</div><h1>萬事造物</h1><p>{error || '正在準備你的創作工作室…'}</p>{error && <button onClick={() => location.reload()}>重新連線</button>}</div>;
  return <div className="app">
    <header className="topbar studio-topbar"><div className="studio-wordmark">萬事造物<span>{staticDemo ? 'GitHub 線上預覽' : '設計你的日常'}</span></div><nav className="studio-steps" aria-label="設計流程"><span>01 選商品</span><b>02 自由創作</b><span>03 確認收藏</span></nav><div className="header-actions"><span className="save-state" role="status">{staticDemo ? '預覽資料儲存在這台裝置' : status}</span><button onClick={() => run(async () => { await save(); setSavedList(await api<Saved[]>('/designs')); setShowLibrary(true); })} disabled={busy}>我的設計</button><button disabled={busy || staticDemo} title={staticDemo ? '正式購物車需連接商店伺服器' : undefined} onClick={() => run(async () => { setCart(await api<CartItem[]>('/cart')); setShowCart(true); })}>購物車 {cart.reduce((n, i) => n + i.quantity, 0)}</button><button className="primary" disabled={busy || staticDemo} title={staticDemo ? '線上預覽可完整排版；製作包與購物車需正式伺服器' : undefined} onClick={() => setConfirmation(true)}>{staticDemo ? '線上功能預覽' : '確認設計與加入購物車 ↗'}</button></div></header>
    <nav className="product-switcher" aria-label="商品種類">
      <span className="product-switcher-label">選擇商品</span>
      {config!.templates.map(t => <button key={t.id} className="product-choice" aria-pressed={design.templateId === t.id} disabled={busy} onClick={() => switchProduct(t.id)}>
        <svg viewBox="0 0 40 40" aria-hidden="true"><rect x="8" y="5" width="23" height="30" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>{t.presentation === 'acrylic-block' ? <path d="M31 5 L35 9 V37 H12 L8 35 M31 35 L35 37" fill="none" stroke="currentColor"/> : <path d="M12 10 H27 V30 H12 Z" fill="none" stroke="currentColor"/>}</svg>
        <span><b>{t.name}</b><small>{t.presentation === 'photo-holder' ? '小相紙／拍立得 mini・NFC 選配' : t.presentation === 'acrylic-block' ? '立體透明底材・可選尺寸' : t.presentation === 'acrylic-badge' ? '名片與平牌・三種尺寸' : `${t.widthMm} × ${t.heightMm} mm`}</small></span>
      </button>)}

    </nav>
    {error && <div className="error" role="alert">{error}<button onClick={() => setError('')} aria-label="關閉錯誤">×</button><button onClick={() => save().catch(report)}>重試儲存</button></div>}
    {failed.length > 0 && <div className="error" role="alert">有 {failed.length} 張圖片載入失敗，請重新整理後再確認輸出。</div>}
    <div className="workspace">
      <nav className="rail" aria-label="素材面板">{[['uploads', '↥', '上傳'], ['text', 'T', '文字'], ['elements', '✿', '素材'], ['brush', '〰', '筆刷'], ...(chosen?.kind === 'image' ? [['image', '◐', '調圖']] : chosen?.kind === 'text' ? [['text-edit', 'Aa', '調字']] : [])].map(([id, icon, name]) => <button key={id} aria-label={name} className={tab === id ? 'active' : ''} onClick={() => { setTab(id); setPaintMode('select'); }}><b>{icon}</b><span>{name}</span></button>)}</nav>
      <aside className={`asset-panel ${tab === 'background' ? 'material-panel' : ''} ${tab === 'uploads' && (template.presentation === 'acrylic-badge' || template.presentation === 'photo-holder') ? 'badge-options-visible' : ''}`}><div className="panel-heading"><span>{({ uploads: '你的圖片', text: '加入文字', 'text-edit': '調整文字', elements: '裝飾與效果', brush: '筆刷與花瓣印章', image: '調整圖片', background: '底材與列印效果', layers: '圖層管理', versions: '設計版本' } as Record<string, string>)[tab]}</span><small>{tab === 'image' || tab === 'text-edit' ? '已選取' : tab === 'layers' ? `${design.layers.length} 個圖層` : '創作工具'}</small></div>
        {tab === 'image' && chosen?.kind === 'image' && <section className="image-edit-panel" aria-label="已選圖片編輯">
          <div className="selected-image-card">{selectedAsset && <img src={assetUrl(selectedAsset)} alt=""/>}<span><b>{chosen.name}</b><small>{selectedAsset ? `${selectedAsset.width} × ${selectedAsset.height} px` : '圖片素材'}</small></span></div>
          {chosenIsPhoto && selectedAsset ? <PhotoImageControls layer={chosen} asset={selectedAsset} design={design} template={template} patch={patchLayer}/> : <><TransformControls layer={chosen} patch={patchLayer} disabled={busy || chosen.locked || !!cropBox} restore={selectedAsset ? restoreImageRatio : undefined}/><ImageCropControls layer={chosen} active={!!cropBox} start={startCrop} ratio={cropRatio} apply={applyCrop} cancel={() => setCropBox(null)} reset={clearCrop}/></>}
          <ImageCornerControls layer={chosen} patch={patchLayer}/>
          <ImageAdjustments layer={chosen} patch={patchLayer}/>
          <button className="ai-button" disabled={!config?.backgroundRemoval} onClick={cutout}>✧ {config?.backgroundRemoval ? 'AI 一鍵去背' : 'AI 去背未啟用'}</button>
          <small className="muted">{config?.backgroundRemoval ? '將圖片送往 remove.bg 處理；原圖完整保留。' : '需在伺服器設定 remove.bg 金鑰。'}</small>
          {selectedAsset?.sourceAssetId && <button onClick={() => patchLayer({ assetId: selectedAsset.sourceAssetId })}>還原原始圖片</button>}
          {effectivePpi !== null && <p className={effectivePpi < MIN_IMAGE_PPI ? 'resolution-warning' : 'muted'}>目前有效解析度：約 {effectivePpi} PPI {effectivePpi < MIN_IMAGE_PPI ? `（低於 ${MIN_IMAGE_PPI} PPI 最低標準）` : '（符合印前標準）'}</p>}
          <button className="return-tool" onClick={() => setTab(previousTool.current)}>返回{({ uploads: '上傳', text: '文字', elements: '素材', brush: '筆刷' } as Record<string, string>)[previousTool.current] || '工具'}</button>
        </section>}
        {tab === 'text-edit' && chosen?.kind === 'text' && <section className="image-edit-panel text-edit-panel" aria-label="已選文字編輯">
          <div className="selected-image-card"><span><b>{chosen.name}</b><small>文字圖層・即時同步</small></span></div>
          <TextControls layer={chosen} patch={patchLayer}/>
          <button className="return-tool" onClick={() => setTab(previousTool.current)}>返回{({ uploads: '上傳', text: '文字', elements: '素材', brush: '筆刷' } as Record<string, string>)[previousTool.current] || '工具'}</button>
        </section>}
        {tab === 'uploads' && template.presentation === 'photo-holder' && <PhotoHolderOptions design={design} change={change} disabled={busy}/>}
        {tab === 'uploads' && template.presentation === 'acrylic-badge' && <section className="badge-accessory-panel" aria-label="識別牌配件與孔槽"><h3>配件與孔槽</h3><div className="badge-accessory-buttons">{badgeAccessories.map(a => <button key={a.id} disabled={busy} aria-pressed={design.badgeAccessory === a.id} onClick={() => change({ ...design, badgeAccessory: a.id, slot: { enabled: true, widthMm: a.widthMm, heightMm: a.heightMm, shape: a.shape, ...(a.shape === 'circle' ? { position: design.slot?.position || 'center' } : {}) } })}>{a.image ? <img src={`/accessories/${a.image}`} alt=""/> : <span className="accessory-symbol" aria-hidden="true">♧</span>}<span><b>{a.name}</b><small>{a.shape === 'circle' ? `圓孔 Ø${a.widthMm} mm` : `長槽 ${a.widthMm} × ${a.heightMm} mm`}</small></span></button>)}</div><div className="badge-extra-options"><button disabled={busy} aria-pressed={design.badgeAccessory === 'none' || (!design.badgeAccessory && !design.slot?.enabled)} onClick={() => change({ ...design, badgeAccessory: 'none', slot: undefined })}>不開孔</button><button disabled={busy} aria-pressed={design.badgeAccessory === 'custom' || (!design.badgeAccessory && !!design.slot?.enabled)} onClick={() => change({ ...design, badgeAccessory: 'custom', slot: { enabled: true, widthMm: design.slot?.widthMm || 12, heightMm: design.slot?.heightMm || 3, shape: 'slot' } })}>自訂長槽</button></div>
        {design.badgeAccessory === 'custom' && <section className="badge-custom-slot" aria-label="識別牌開槽設定"><label className="slot-toggle"><input type="checkbox" checked={!!design.slot?.enabled} onChange={e => change({ ...design, badgeAccessory: 'custom', slot: { shape: 'slot', widthMm: design.slot?.widthMm || 12, heightMm: design.slot?.heightMm || 3, enabled: e.target.checked } })}/>開槽</label>{design.slot?.enabled && <div className="slot-dimensions"><Numeric label="槽長 (mm)" value={design.slot.widthMm} min={1} max={Math.floor(mm!.w - template.safeMm * 2)} step={1} snapOnBlur onChange={value => change({ ...design, badgeAccessory: 'custom', slot: { ...design.slot!, shape: 'slot', widthMm: value } })}/><Numeric label="槽寬 (mm)" value={design.slot.heightMm} min={1} max={Math.floor(mm!.h - 5 - template.safeMm)} step={1} snapOnBlur onChange={value => change({ ...design, badgeAccessory: 'custom', slot: { ...design.slot!, shape: 'slot', heightMm: value } })}/></div>}<small>厚 3 mm・槽頂離上緣 5 mm、置中・每次 1 mm<br/>直橫切換保持上方；槽內不列印，製作包附開槽路徑。</small></section>}
          {design.slot?.enabled && design.slot.shape === 'circle' && <div className="badge-radius-picker hole-position-picker" role="group" aria-label="圓孔位置"><span>圓孔位置</span>{([['left', '左'], ['center', '中'], ['right', '右']] as const).map(([position, label]) => <button key={position} disabled={busy} aria-pressed={(design.slot?.position || 'center') === position} onClick={() => change({ ...design, slot: { ...design.slot!, position } })}>{label}</button>)}</div>}
          <div className="badge-radius-picker" role="group" aria-label="牌身圓角"><span>牌身圓角</span>{([3, 4] as const).map(r => <button key={r} disabled={busy} aria-pressed={badgeRadius(design, template) === r} onClick={() => change({ ...design, badgeCornerRadiusMm: r })}>R{r} mm</button>)}</div><p className="muted">長槽上方置中；圓孔可選左／中／右。<br/>孔槽頂端離邊 5 mm，側孔離側邊 5 mm。<br/>直橫切換保持在上方，孔內不列印。</p></section>}
        {tab === 'brush' && <div className="brush-tools"><p className="muted">拖曳自由繪畫，或點一下蓋上花瓣。每一筆都可撤銷、移動及刪除。</p><div className="brush-modes"><button aria-pressed={paintMode === 'select'} onClick={() => setPaintMode('select')}>選取／移動</button><button aria-pressed={paintMode === 'pen'} onClick={() => { setPaintMode('pen'); setPaintSize(2); setSelected(null); }}>自由筆刷</button><button aria-pressed={paintMode === 'eraser'} onClick={() => { setPaintMode('eraser'); setPaintSize(8); setSelected(null); }}>橡皮擦</button></div>{paintMode === 'eraser' && <p className="muted">拖曳擦除筆畫、圖片或花瓣的局部；鎖定圖層不受影響。擦除可撤銷，原始圖片保留。</p>}<label>筆刷顏色<input aria-label="筆刷顏色" type="color" value={paintColor} onChange={e => setPaintColor(e.target.value)}/></label><label>{paintMode === 'eraser' ? '橡皮擦大小' : paintMode === 'pen' ? '筆刷粗細' : '花瓣大小'}（mm）<input aria-label="筆刷大小" type="range" min="0.5" max="30" step="0.5" value={paintSize} onChange={e => setPaintSize(+e.target.value)}/><output>{paintSize} mm</output></label><label>透明度<input aria-label="筆刷透明度" type="range" min="0.1" max="1" step="0.05" value={paintOpacity} onChange={e => setPaintOpacity(+e.target.value)}/><output>{Math.round(paintOpacity * 100)}%</output></label><h3>自然飄落花瓣</h3><div className="brush-modes"><button aria-pressed={paintMode === 'petals' && flowerType === 'sakura'} onClick={() => { setFlowerType('sakura'); setPaintMode('petals'); setPaintSize(10); setSelected(null); }}>飄落櫻花</button><button aria-pressed={paintMode === 'petals' && flowerType === 'rose'} onClick={() => { setFlowerType('rose'); setPaintMode('petals'); setPaintSize(12); setSelected(null); }}>飄落玫瑰</button></div>{paintMode === 'petals' && <><label>每次花瓣數量<input aria-label="花瓣數量" type="range" min="3" max="15" value={petalCount} onChange={e => setPetalCount(+e.target.value)}/><output>{petalCount} 片</output></label><button disabled={busy} onClick={() => { const room = 150 - design.layers.length; if (room < petalCount) { setError('圖層已達上限，請先移除部分圖層。'); return; } change({ ...design, layers: [...design.layers, ...scatterPetals(mm!.w / 2, mm!.h / 2, mm!.w, mm!.h, paintSize, petalCount, flowerType, paintOpacity)] }); }}>灑落整個版面</button><p className="muted">點擊畫布灑下一小簇。正面、側面、翻轉與捲曲姿態隨機混合；每次位置、角度、大小都不同，保存後不再變動。</p></>}<h3>單片寫實印章</h3><div className="asset-grid">{artCatalog.filter(a => a.id.endsWith('-single')).map(a => <button key={a.id} disabled={busy} aria-pressed={paintMode === 'stamp' && assets.find(x => x.id === stampAsset)?.libraryArtworkId === a.id} onClick={() => run(async () => { const asset = assets.find(x => !x.deletedAt && x.libraryArtworkId === a.id) || await api<Asset>(`/designs/${design.id}/library`, { method: 'POST', body: JSON.stringify({ artworkId: a.id }) }); setAssets(old => old.some(x => x.id === asset.id) ? old : [...old, asset]); setStampAsset(asset.id); setPaintMode('stamp'); setPaintSize(12); setSelected(null); })}><img src={`/artwork/${a.file}`} alt=""/>{a.name}</button>)}</div>{paintMode === 'stamp' && <label>印章旋轉<input aria-label="印章旋轉" type="range" min="-180" max="180" step="5" value={stampRotation} onChange={e => setStampRotation(+e.target.value)}/><output>{stampRotation}°</output></label>}<p className="muted">{paintMode === 'select' ? '目前可選取圖層。' : paintMode === 'pen' ? '筆刷啟用中：在畫布拖曳開始繪畫。' : paintMode === 'eraser' ? '橡皮擦啟用中：拖曳擦除局部。' : paintMode === 'petals' ? '飄落模式：點擊畫布灑下隨機花瓣。' : '印章啟用中：點擊畫布可連續蓋印。'}完成後按「選取／移動」調整圖層。</p></div>}
        {tab === 'uploads' && <><p className="muted">讓喜歡的畫面，成為日常的一部分。</p><button className="upload-zone" disabled={busy} onClick={() => fileInput.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files); }}><span>＋</span><b>上傳圖片</b><small>點擊或拖入多張圖片<br/>JPG、PNG、WebP · 每張 20 MB</small></button><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-testid="file-upload" onChange={e => { if (e.target.files) upload(e.target.files); e.target.value = ''; }}/><div className="section-label">素材庫 <span>{assets.filter(a => !a.deletedAt && !a.libraryArtworkId).length}</span></div><div className="asset-grid">{assets.filter(a => !a.deletedAt && !a.libraryArtworkId).map(a => <div className="asset-tile" key={a.id}><button disabled={busy} title={a.originalName} onClick={() => add(newLayer('image', { assetId: a.id, name: a.originalName, width: 85, height: 85 * a.height / a.width }))}><img src={`/api/assets/${a.id}`} alt={a.originalName}/><small>{a.variant === 'cutout' ? '已去背' : '原始圖片'}</small></button><button className="asset-delete" aria-label={`刪除素材 ${a.originalName}`} disabled={busy} onClick={() => run(async () => { const updated = await api<Asset>(`/assets/${a.id}`, { method: 'DELETE' }); setAssets(old => old.map(item => item.id === a.id ? updated : item)); })}>×</button></div>)}</div>{!assets.some(a => !a.deletedAt && !a.libraryArtworkId) && <div className="empty-note">刪除只從素材庫移除，已使用圖層與確認版本的原檔保留。<br/>每張圖片都能獨立移動與編輯。</div>}<div className="tip"><b>小提示</b><p>{template.presentation === 'photo-holder' ? '照片會自動鋪滿；放大後可上下左右拖曳取景。' : '選取圖片後，拖曳角落縮放，拖曳上方圓點旋轉。'}</p></div></>}
        {tab === 'text' && <><p className="muted">用一句話，留下你的故事。</p><label>新增文字字體<select aria-label="新增文字字體" value={fontChoice} disabled={busy} onChange={e => setFontChoice(e.target.value as FontId)}>{fonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><div className="font-sample" style={{ fontFamily: getFont(fontChoice).family }}>把喜歡，留在日常<br/>萬事造物 123 ABC</div><button className="text-preset" disabled={busy} onClick={() => add(newLayer('text', { fontId: fontChoice, name: '標題', text: '把喜歡，留在日常', fontSize: 10, width: 110, height: 30, fill: '#284a43', x: 19, y: 90 }))}>加入標題</button><button className="text-preset small" disabled={busy} onClick={() => add(newLayer('text', { fontId: fontChoice, name: '內文', text: '屬於你的美好時刻', fontSize: 5, width: 100, height: 25, fill: '#65736b', x: 24, y: 120 }))}>加入內文</button><p className="muted">內建 3 個開源繁中字體家族、5 種款式，採 SIL OFL 1.1 授權，可用於商業設計。新增或選取文字後，左側會自動開啟細調面板。</p></>}
        {tab === 'elements' && <><ArtLibrary add={addArtwork} disabled={busy}/><details className="basic-elements"><summary>基本形狀與 UV 效果</summary><p className="muted">為設計加上一點個性。</p><div className="section-label">基本裝飾</div><div className="element-grid">{[['petal', '❀', '花瓣'], ['star', '✦', '星芒'], ['circle', '●', '圓形'], ['rect', '■', '方形']].map(([shape, symbol, label]) => <button key={shape} disabled={busy} onClick={() => add(newLayer('shape', { shape: shape as DesignLayer['shape'], name: label }))}><b>{symbol}</b>{label}</button>)}</div>{template.presentation !== 'photo-holder' && <><div className="section-label">UV 微浮雕</div><button className="uv-card" disabled={busy} onClick={() => add(newLayer('uv', { name: 'UV 花瓣', shape: 'petal', fill: '#d7ba89', width: 28, height: 42 }))}><span>✧</span><b>加入 UV 花瓣效果</b><small>獨立效果圖層與灰階遮罩</small></button><p className="muted">預覽為效果位置示意，不代表實際凸起高度。UV 圖層可在右側切換形狀。</p></>}</details></>}
      </aside>
      <main className={`editor-area ${(template.presentation?.startsWith('acrylic-') || template.presentation === 'photo-holder') ? 'block-editor' : ''}`}><LayerWindow layers={faceLayers} selected={selected} select={setSelected} patch={patchLayer} disabled={busy} reorder={(from, to) => { const layers = [...design.layers], a = layers.findIndex(l => l.id === from), b = layers.findIndex(l => l.id === to); if (a < 0 || b < 0 || layers[a].locked) return; const [item] = layers.splice(a, 1); layers.splice(b, 0, item); change({ ...design, layers }); }}/><div className="editor-toolbar"><div className="row"><button title="撤銷 Ctrl+Z" aria-label="撤銷" disabled={!history.past.length || busy} onClick={() => undo()}>↶</button><button title="重做 Ctrl+Shift+Z" aria-label="重做" disabled={!history.future.length || busy} onClick={() => undo(true)}>↷</button><span className="toolbar-separator"/><span className="template-name">{template.name}</span>{template.presentation === 'photo-holder' ? <span className="orientation-toggle fixed-orientation"><span aria-hidden="true">▯</span>固定直式</span> : <button className="orientation-toggle" aria-label={design.orientation === 'portrait' ? '切換為橫式' : '切換為直式'} title="點擊切換直式／橫式" disabled={busy} onClick={() => { change({ ...design, orientation: design.orientation === 'portrait' ? 'landscape' : 'portrait' }); setSelected(null); setTransient(null); }}><span aria-hidden="true">{design.orientation === 'portrait' ? '▯' : '▭'}</span>{design.orientation === 'portrait' ? '直式' : '橫式'}<span aria-hidden="true">⇄</span></button>}</div><button aria-pressed={marquee} disabled={busy} onClick={() => { setMarquee(!marquee); setSelected(null); setSelectedIds([]); setPaintMode('select'); }}>框選／多選</button>{marquee && <><label><input type="checkbox" checked={contained} onChange={e => setContained(e.target.checked)}/>完全包含才選取</label><span>已選 {design.layers.filter(l => selectedIds.includes(l.id) && l.visible && !l.locked).length} 個</span><button disabled={busy || !selectedIds.length} onClick={remove}>刪除選取</button></>}<button disabled={busy || !design.layers.length} onClick={() => { if (window.confirm('清空目前畫布的所有圖層（包含鎖定與隱藏圖層）？商品設定、上傳原圖與購物車確認版本會保留，可用撤銷復原。')) { change({ ...design, layers: [] }); setSelected(null); setTransient(null); setPaintMode('select'); } }}>清空畫布</button><label className="guide-toggle"><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)}/>輔助線</label></div>
<div className="cad-selection-hint" role="status">{paintMode !== 'select' ? '切換「選取／移動」後，可直接在空白處拖曳框選' : selectedIds.length ? `已選 ${selectedIds.length} 個 · 拖動任一選取物件可整批移動 · Delete 刪除` : 'CAD 框選：空白處向右拖＝完全框住　向左拖＝碰到即選　Shift＝追加'}</div>
<details className="canvas-material"><summary>底材與列印效果 · {materials[design.material || 'clear'].name}</summary><div>        {template.presentation === 'photo-holder' && <p className="muted">照片使用白色相紙。此商品不使用壓克力底材或白墨堆疊選項。</p>}
        {template.presentation !== 'photo-holder' && <><p className="muted">{template.presentation === 'acrylic-block' && '壓克力磚固定使用透明底材。'}選擇實際底材；底材色與光澤不會印入油墨製作圖。</p><div className="material-grid">{Object.entries(materials).filter(([id]) => !template.allowedMaterials || template.allowedMaterials.includes(id as Material)).map(([id, m]) => <button key={id} aria-pressed={design.material === id} disabled={busy} onClick={() => { change(withPrintStack({ ...design, material: id as Material }, !supportsDuplex(id as Material) && design.duplex ? 'white-cmyk' : design.printStack || 'white-cmyk')); setSelected(null); }}><i style={{ background: m.color }}/>{m.name}</button>)}</div>{!design.material && <p className="muted">此舊設計保留原背景，選擇底材即可更新。</p>}<PrintStackPicker value={design.printStack || 'white-cmyk'} disabled={busy} duplexAllowed={supportsDuplex(design.material)} onChange={stack => change(withPrintStack(design, stack))}/><p className="muted">同一份圖稿，切換油墨堆疊與觀看效果。雙面為中間白墨、兩側 CMYK，僅透明壓克力與炫彩可用。順序以由底材向外堆疊表示。</p>{design.layers.some(l => l.face === 'back') && <p className="muted">舊背面圖層保留於 JSON 備份，不納入目前這份圖稿的預覽及輸出。</p>}<p className="muted">預覽為效果示意；製作包保存圖稿與堆疊設定，白墨分色與鏡像由印廠依設備處理。</p></>}</div></details>
        {template.presentation === 'photo-holder' && <div className="product-size-bar"><div className="holder-options-row" role="group" aria-label="照片規格">{[...(template.sizes || [])].reverse().map(size => <button key={size.id} disabled={busy} aria-pressed={design.sizeId === size.id} onClick={() => { change({ ...design, sizeId: size.id, orientation: 'portrait' }); setSelected(null); setTransient(null); }}><b>{size.id === 'instax-mini' ? '拍立得' : '相紙'}</b><small>{size.widthMm} × {size.heightMm} mm・直式</small></button>)}</div><small>單面照片・圖片預設滿版，放大後可上下左右取景</small></div>}
        {template.sizes && template.presentation !== 'photo-holder' && <div className="product-size-bar"><label>{template.name}尺寸<select aria-label="商品尺寸" value={design.sizeId || template.sizes[0].id} disabled={busy} onChange={e => { change({ ...design, sizeId: e.target.value, customSize: e.target.value === 'custom' ? design.customSize || { widthMm: template.widthMm, heightMm: template.heightMm, thicknessMm: template.thicknessMm || 20 } : undefined }); setSelected(null); setTransient(null); }}>{template.sizes.filter(size => !size.retired).map(size => <option key={size.id} value={size.id}>{size.name.split(' · ')[0]} · {design.orientation === 'portrait' ? size.widthMm : size.heightMm} × {design.orientation === 'portrait' ? size.heightMm : size.widthMm}{size.thicknessMm ? ` × ${size.thicknessMm}` : ''} mm</option>)}{retiredSize && <option value={retiredSize.id}>其他尺寸（{design.orientation === 'portrait' ? retiredSize.widthMm : retiredSize.heightMm} × {design.orientation === 'portrait' ? retiredSize.heightMm : retiredSize.widthMm} mm・另外報價）</option>}{template.allowCustomSize && <option value="custom">其他尺寸（客人自行輸入・另外報價）</option>}</select></label>{design.sizeId === 'custom' && <small>每次 5 mm・長／高 20–250 mm、厚 5–{Math.min(50, mm!.w, mm!.h)} mm（不超過短邊）；輸入會就近對齊 5 mm・<strong>其他尺寸需另外報價</strong></small>}{retiredSize && <small>已保留既有排版尺寸；厚度未指定，請選「其他尺寸」填寫。</small>}<small>{template.presentation === 'acrylic-badge' ? '長 × 高（mm）' : '長 × 高 × 厚（mm）'}・依目前方向顯示</small></div>}<div className="canvas-heading">{marquee && <p>拖曳框選，拖動選取框可整批移動；Shift 可追加選取，Delete 刪除。鎖定及隱藏圖層略過。</p>}<span>YOUR DESIGN, YOUR EVERYDAY</span><h1>讓喜歡的畫面，成為日常。</h1><p>{mm!.w} × {mm!.h} mm <span>／</span> {template.name}</p></div>

        {offCanvasLayerIds.size > 0 && <div className="off-canvas-warning" role="status"><span>有 {offCanvasLayerIds.size} 個圖層在目前商品畫布外；內容仍完整保留。</span><button disabled={busy} onClick={() => change({ ...design, layers: design.layers.map(layer => offCanvasLayerIds.has(layer.id) ? fitNewLayer(layer) : layer) })}>縮放並移回畫布</button></div>}
        <div className="dimension-workspace">
          <div className="dimension-horizontal"><span aria-hidden="true">↔</span>{design.sizeId === 'custom' && design.customSize ? <DimensionControl axis="長" label="長 (mm)" value={mm!.w} min={20} max={250} onChange={value => change({ ...design, customSize: { ...design.customSize!, [design.orientation === 'portrait' ? 'widthMm' : 'heightMm']: value } })}/> : <span>{template.presentation?.startsWith('acrylic-') ? '長' : '寬'} {mm!.w} mm</span>}</div>
          <div className="dimension-canvas protected-preview"><EditorCanvas photoAssetIds={photoAssetIds} cropBox={cropBox} setCropBox={setCropBox} liveMany={setTransientMany} marquee={marquee} contained={contained} selectedIds={selectedIds} selectMany={setSelectedIds} replaceLayers={layers => change({ ...design, layers: design.layers.map(l => layers.find(v => v.id === l.id) || l) })} createBatch={layers => { if (design.layers.length + layers.length > 150) { setError('圖層已達上限，請先移除部分圖層。'); return; } change({ ...design, layers: [...design.layers, ...layers] }); }} paint={tab === 'brush' && paintMode !== 'select' ? { mode: paintMode, color: paintColor, size: paintSize, opacity: paintOpacity, assetId: stampAsset, rotation: stampRotation, flowerType, count: petalCount } : undefined} create={l => { if (design.layers.length >= 150) { setError('最多 150 個圖層，請先刪除不需要的筆畫。'); return; } change({ ...design, layers: [...design.layers, l] }); }} design={canvasDesign!} template={template} images={images} selected={selected} select={setSelected} commit={l => patchLayer(l, l.id)} live={setTransient} zoom={zoom} guides={guides} disabled={busy || confirmation}/></div>
          <div className="dimension-vertical"><span aria-hidden="true">↕</span>{design.sizeId === 'custom' && design.customSize ? <DimensionControl vertical axis="高" label="高 (mm)" value={mm!.h} min={20} max={250} onChange={value => change({ ...design, customSize: { ...design.customSize!, [design.orientation === 'portrait' ? 'heightMm' : 'widthMm']: value } })}/> : <span>高<br/>{mm!.h} mm</span>}

          </div>
            {template.presentation?.startsWith('acrylic-') && <div className="dimension-thickness">{design.sizeId === 'custom' && design.customSize ? <DimensionControl axis="厚" label="厚 (mm)" value={design.customSize.thicknessMm} min={5} max={Math.min(50, mm!.w, mm!.h)} onChange={value => change({ ...design, customSize: { ...design.customSize!, thicknessMm: value } })}/> : <span>厚<br/>{template.thicknessMm ?? '未指定'} mm</span>}</div>}
        </div>
        {!faceLayers.length && <p className="canvas-empty">← 上傳一張圖片，開始你的設計</p>}
        <div className="canvas-footer"><div className="legend">{template.presentation === 'photo-holder' ? <span>灰線：相紙邊界・綠虛線：可印影像區・白邊不列印</span> : <><span><i className="trim"/>{template.presentation?.startsWith('acrylic-') ? '成品邊界' : '裁切線'}</span><span><i className="safe"/>{template.presentation?.startsWith('acrylic-') ? '列印安全線' : '安全區'}（內縮 {template.safeMm} mm）</span><span>{template.presentation?.startsWith('acrylic-') ? '無出血'  : `出血 ${template.bleedMm} mm`}</span></>}<span>手機：圖片上雙指縮放</span></div><div className="zoom"><button aria-label="縮小工作區" onClick={() => setZoom(z => Math.max(0.1, z / 1.2))}>−</button><button onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><button aria-label="放大工作區" onClick={() => setZoom(z => Math.min(10, z * 1.2))}>＋</button><button onClick={() => setZoom(fitZoom())}>符合</button></div></div>
      </main>
      <aside className={`right-panel ${chosen ? 'has-selection' : ''}`}><div className="panel-heading"><span>成品預覽</span><small className="live-tag">● 即時同步 · 僅供預覽</small></div><div className="protected-preview protected-scene"><ProductScene design={preview!} template={template} images={images}/></div><div className="specs"><span>{template.presentation === 'photo-holder' ? '相紙尺寸' : '成品尺寸'}<b>{mm!.w} × {mm!.h} mm</b></span><span>圖稿輸出<b>{template.dpi} PPI</b></span></div>
        <div className="inspector"><div className="panel-heading"><span>{chosen ? '圖層設定' : '開始你的創作'}</span>{chosen && <small>{chosen.kind === 'uv' ? 'UV 效果' : chosen.kind === 'image' ? '圖片' : chosen.kind === 'text' ? '文字' : '裝飾'}</small>}</div>
          {chosen?.kind === 'frame' ? <><p className="muted">圖框自動貼合版面，隨尺寸與直橫式更新。角落裝飾保持比例，不需拖曳或縮放。</p><button disabled={busy} onClick={() => patchLayer({ visible: !chosen.visible })}>{chosen.visible ? '隱藏圖框' : '顯示圖框'}</button><button className="danger" disabled={busy} onClick={remove}>移除圖框</button></> : chosen ? <><label>圖層名稱<input value={chosen.name} disabled={busy || chosen.locked} onChange={e => patchLayer({ name: e.target.value })}/></label>{chosen.locked && <p className="muted">此圖層已鎖定。<button onClick={() => patchLayer({ locked: false })} disabled={busy}>解鎖</button></p>}<fieldset disabled={busy || chosen.locked}>
            {chosen.kind === 'text' && <p className="muted">文字內容、字體、粗斜體、顏色、字距與行距請在左側「調字」面板修改。</p>}
            {chosenIsPhoto ? <p className="photo-position-note">照片已固定直式滿版。放大後可直接上下左右拖曳取景；電腦請用左側放大滑桿，手機可在照片上雙指縮放。</p> : <div className="input-grid">{(['x', 'y', 'width', 'height', 'rotation'] as const).map((key, i) => <Numeric key={key} label={['X (mm)', 'Y (mm)', '寬 (mm)', '高 (mm)', '旋轉 (°)'][i]} value={chosen[key]} min={key === 'width' || key === 'height' ? 0.1 : -1000} max={1000} onChange={v => patchLayer(chosen.kind === 'image' && (key === 'width' || key === 'height') ? resizeLayerDimension(chosen, key, v, shiftHeld.current) : { [key]: v })}/>)}</div>}
            {chosen.kind !== 'image' && chosen.kind !== 'text' && <label>顏色<input type="color" value={chosen.fill} onChange={e => patchLayer({ fill: e.target.value })}/></label>}
            {(chosen.kind === 'shape' || chosen.kind === 'uv') && <label>形狀<select value={chosen.shape} onChange={e => patchLayer({ shape: e.target.value as DesignLayer['shape'] })}><option value="petal">花瓣</option><option value="star">星芒</option><option value="circle">圓形</option><option value="rect">方形</option></select></label>}
            <label>{chosen.kind === 'uv' ? '效果強度' : '不透明度'} {Math.round(chosen.opacity * 100)}%<input type="range" min="0" max="1" step="0.01" value={chosen.opacity} onChange={e => patchLayer({ opacity: +e.target.value })}/></label>
            {!chosenIsPhoto && <div className="row"><button onClick={() => patchLayer({ x: (mm!.w - chosen.width) / 2, rotation: 0 })}>水平置中</button><button onClick={() => patchLayer({ y: (mm!.h - chosen.height) / 2, rotation: 0 })}>垂直置中</button></div>}
          </fieldset><div className="row layer-actions"><button onClick={duplicate} disabled={busy}>複製</button><button onClick={() => patchLayer({ locked: !chosen.locked })} disabled={busy}>{chosen.locked ? '解鎖' : '鎖定'}</button><button onClick={remove} disabled={busy || chosen.locked} className="danger">刪除</button></div></> : <p className="empty-note">點選畫布上的圖片、文字或裝飾，<br/>就能調整它的位置與樣式。</p>}
        </div>
      </aside>
    </div><footer className="app-footer"><span>萬事皆可造，日常皆有光。</span><span>專屬設計 · 為你製作</span></footer>
    {showCart && <Cart items={cart} busy={busy} close={() => setShowCart(false)} update={updateCart} edit={id => { setShowCart(false); openDesign(id); }}/>}
    {showLibrary && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="我的設計"><div className="panel-heading"><h2>我的設計</h2><button onClick={() => setShowLibrary(false)}>關閉</button></div><label>目前設計名稱<input aria-label="設計名稱" value={design.name} maxLength={160} disabled={busy} onChange={e => change({ ...design, name: e.target.value || '未命名設計' })}/></label><button className="primary" disabled={busy} onClick={newDesign}>＋ 建立新設計</button>{savedList.map(d => <button className="saved-design" key={d.id} disabled={busy} onClick={() => openDesign(d.id)}><b>{d.name}</b><small>{new Date(d.updatedAt).toLocaleString('zh-TW')}</small></button>)}</section></div>}
    {confirmation && <div className="modal-backdrop"><section className="modal confirm-modal" role="dialog" aria-modal="true" aria-label="確認設計"><h2>讓設計，準備成形。</h2><p>{template.presentation === 'photo-holder' ? '確認後會保存不可覆寫的選配與圖稿版本，600 PPI 製作檔只提供工作室後台使用。' : '確認後會保存不可覆寫的製作版本；客戶端只顯示含浮水印的低解析預覽，原圖與製作檔只提供工作室後台使用。'}</p>{template.presentation === 'photo-holder' ? <p>照片立／掛牌 · {design.photoHolder?.photoService === 'print' ? '加購照片列印' : '自備照片，不列印'}<br/>{design.photoHolder?.base ? '加購桌面底座' : '不含底座'} · {design.photoHolder?.nfc ? '背面加裝 NFC' : '無 NFC'}<br/>相紙 {mm!.w} × {mm!.h} mm；外框尺寸待確認。</p> : <p>印刷堆疊：{stackLabel(design)} · 同一份圖稿{template.thicknessMm && <> · 厚 {template.thicknessMm} mm</>}{design.sizeId === 'custom' && <><br/>其他尺寸：需另外報價，設計確認不代表報價已確認。</>}</p>}<div className="confirmation-preview protected-preview"><Preview design={design} template={template} images={images}/></div>{template.presentation === 'photo-holder' ? <p className="muted">以下為含浮水印確認預覽。自備照片不輸出列印檔；NFC 感應內容另行設定。</p> : <p className="muted">成品 {mm!.w} × {mm!.h} mm · 出血 {template.bleedMm} mm · {template.dpi} PPI 圖稿輸出<br/>安全區每邊內縮 {template.safeMm} mm；文字與圖形會以 {template.dpi} PPI 重新繪製。安全線不會印出，也不會自動裁切圖稿。UV 預覽僅為效果示意。</p>}{qualityIssues.length ? <div className="print-quality print-quality-error" role="alert"><b>圖片解析度不足，暫時無法確認</b><ul>{qualityIssues.map(issue => <li key={issue.layerId}>{issue.name}：{issue.ppi} PPI</li>)}</ul><small>請縮小圖片的實際尺寸，或換用更高解析度原圖；最低標準為 {MIN_IMAGE_PPI} PPI。</small></div> : <div className="print-quality print-quality-pass" role="status"><b>✓ 印前解析度檢查通過</b><small>所有可見圖片至少 {MIN_IMAGE_PPI} PPI；製作檔以 {template.dpi} PPI 輸出，可交由最高 {TARGET_PRINTER_DPI} DPI 印表機列印。</small></div>}<div className="row"><button disabled={busy} onClick={() => setConfirmation(false)}>繼續編輯</button><button className="primary" disabled={busy || qualityIssues.length > 0 || failed.length > 0 || design.layers.some(l => l.visible && l.assetId && !images.has(l.assetId))} onClick={() => confirm(true)}>{busy ? '正在加入…' : '確認並加入購物車'}</button></div></section></div>}
  </div>;
}
function TextControls({ layer, patch }: { layer: DesignLayer; patch: (change: Partial<DesignLayer>) => void }) {
  const size = layer.fontSize || 10, lineHeight = layer.lineHeight ?? 1.3;
  const measurementContext = document.createElement('canvas').getContext('2d');
  const estimatedHeight = (fontSize: number) => {
    if (!layer.text || !measurementContext) return 0;
    measurementContext.font = textFont(layer, fontSize);
    const letterSpacing = layer.letterSpacing || 0;
    const measure = (value: string) => measurementContext.measureText(value).width + Math.max(0, Array.from(value).length - 1) * letterSpacing;
    const lines = wrapTextLines(layer.text, layer.width, measure).length;
    return Math.max(0, lines - 1) * fontSize * lineHeight + fontSize * Math.max(lineHeight, 1.12);
  };
  const mayClip = estimatedHeight(size) > layer.height + .1;
  let fittedSize = size;
  if (mayClip) {
    let low = 1, high = size;
    if (estimatedHeight(low) <= layer.height + .1) for (let step = 0; step < 12; step++) {
      const middle = (low + high) / 2;
      if (estimatedHeight(middle) <= layer.height + .1) low = middle; else high = middle;
    }
    fittedSize = Math.floor(low * 10) / 10;
  }
  const displaySize = Math.round(size * 10) / 10;
  return <section className="text-style-controls" aria-label="文字樣式">
    <label>文字字體<select aria-label="文字字體" value={layer.fontId || 'sans'} onChange={e => patch({ fontId: e.target.value as FontId })}>{fonts.map(font => <option key={font.id} value={font.id}>{font.name}</option>)}</select></label>
    <label>文字內容<textarea value={layer.text || ''} onChange={e => patch({ text: e.target.value })}/></label>
    <div className="text-color-size">
      <label>文字顏色<input aria-label="文字顏色" type="color" value={layer.fill} onChange={e => patch({ fill: e.target.value })}/></label>
      <Numeric label="字級 (mm)" value={size} min={1} max={200} step={.5} onChange={fontSize => patch({ fontSize })}/>
    </div>
    <div className="text-size-slider"><input aria-label="字級滑桿" type="range" min="1" max="60" step="0.5" value={Math.min(60, size)} onChange={e => patch({ fontSize: +e.target.value })}/><output>{displaySize} mm · 約 {Math.round(size * 2.835)} pt</output></div>
    <div className="text-size-presets" role="group" aria-label="常用字級">{[3, 5, 8, 12, 20].map(value => <button type="button" key={value} aria-pressed={Math.abs(size - value) < .05} onClick={() => patch({ fontSize: value })}>{value} mm</button>)}</div>
    <div className="text-format-row">
      <div className="text-toggle-group" role="group" aria-label="字體樣式">
        <button type="button" aria-label="粗體" aria-pressed={layer.fontWeight === 'bold'} onClick={() => patch({ fontWeight: layer.fontWeight === 'bold' ? 'normal' : 'bold' })}><b>B</b></button>
        <button type="button" aria-label="斜體" aria-pressed={layer.fontStyle === 'italic'} onClick={() => patch({ fontStyle: layer.fontStyle === 'italic' ? 'normal' : 'italic' })}><i>I</i></button>
        <button type="button" aria-label="底線" aria-pressed={layer.textDecoration === 'underline'} onClick={() => patch({ textDecoration: layer.textDecoration === 'underline' ? 'none' : 'underline' })}><u>U</u></button>
      </div>
      <div className="text-toggle-group" role="group" aria-label="文字對齊">
        {([['left', '靠左對齊', '≡'], ['center', '置中對齊', '≣'], ['right', '靠右對齊', '≡']] as const).map(([value, label, symbol]) => <button type="button" key={value} className={`align-${value}`} aria-label={label} aria-pressed={(layer.textAlign || 'left') === value} onClick={() => patch({ textAlign: value })}>{symbol}</button>)}
      </div>
    </div>
    <div className="text-spacing-controls">
      <Numeric label="字距 (mm)" value={layer.letterSpacing ?? 0} min={-2} max={10} step={.1} onChange={letterSpacing => patch({ letterSpacing })}/>
      <label>行距 <output>{lineHeight.toFixed(1)}×</output><input aria-label="文字行距" type="range" min="0.8" max="3" step="0.1" value={lineHeight} onChange={e => patch({ lineHeight: +e.target.value })}/></label>
    </div>
    {mayClip && <div className="text-overflow-warning" role="status"><span>目前字級、字距或行距可能超出文字框，成品會裁切。</span>{fittedSize < size ? <button type="button" onClick={() => patch({ fontSize: fittedSize })}>自動縮小至 {fittedSize} mm</button> : <small>請增加文字框高度或減少文字內容。</small>}</div>}
    <small className="text-size-note">字級以成品毫米計算；拖曳文字角落會等比例調整文字與文字框。</small>
  </section>;
}
function PhotoImageControls({ layer, asset, design, template, patch }: { layer: DesignLayer; asset: Asset; design: Design; template: Template; patch: (change: Partial<DesignLayer>) => void }) {
  const area = photoImageArea(design, template)!;
  const ratio = asset.width / asset.height;
  const baseWidth = Math.max(area.width, area.height * ratio), baseHeight = baseWidth / ratio;
  const zoom = Math.max(100, Math.min(300, Math.round(layer.width / baseWidth * 100)));
  const minX = area.x + area.width - layer.width, maxX = area.x;
  const minY = area.y + area.height - layer.height, maxY = area.y;
  const positionX = maxX === minX ? 0 : Math.round(((layer.x - minX) / (maxX - minX) * 200) - 100);
  const positionY = maxY === minY ? 0 : Math.round(((layer.y - minY) / (maxY - minY) * 200) - 100);
  const setZoom = (value: number) => {
    const width = baseWidth * value / 100, height = baseHeight * value / 100;
    const oldRangeX = maxX - minX, oldProgressX = oldRangeX ? (layer.x - minX) / oldRangeX : .5;
    const oldRangeY = maxY - minY, oldProgressY = oldRangeY ? (layer.y - minY) / oldRangeY : .5;
    const nextMinX = area.x + area.width - width, nextMinY = area.y + area.height - height;
    patch({ width, height, x: nextMinX + (area.x - nextMinX) * oldProgressX, y: nextMinY + (area.y - nextMinY) * oldProgressY, rotation: 0 });
  };
  const setPositionX = (value: number) => {
    const progress = (value + 100) / 200;
    patch({ x: minX + (maxX - minX) * progress, rotation: 0 });
  };
  const setPositionY = (value: number) => patch({ y: minY + (maxY - minY) * ((value + 100) / 200), rotation: 0 });
  return <section className="photo-image-controls" aria-label="照片取景">
    <div className="photo-fit-status"><span aria-hidden="true">✓</span><b>已自動吸附{design.sizeId === 'instax-mini' ? '拍立得影像框' : '相紙滿版框'}</b></div>
    <div className="image-adjustment-heading"><b>照片取景</b><button type="button" disabled={zoom === 100 && Math.abs(positionX) < 2 && Math.abs(positionY) < 2} onClick={() => patch(fitPhotoImageLayer(layer, asset, design, template, true))}>重新吸附</button></div>
    <label>左右位置 <output>{positionX === 0 ? '置中' : positionX < 0 ? `左 ${Math.abs(positionX)}%` : `右 ${positionX}%`}</output><input aria-label="照片左右位置" type="range" min="-100" max="100" step="1" value={positionX} onChange={e => setPositionX(+e.target.value)}/></label>
    <label>上下位置 <output>{positionY === 0 ? '置中' : positionY < 0 ? `上 ${Math.abs(positionY)}%` : `下 ${positionY}%`}</output><input aria-label="照片上下位置" type="range" min="-100" max="100" step="1" value={positionY} onChange={e => setPositionY(+e.target.value)}/></label>
    <label>放大 <output>{zoom}%</output><input aria-label="照片放大" type="range" min="100" max="300" step="1" value={zoom} onChange={e => setZoom(+e.target.value)}/></label>
    <small>採用類似 mini Link 的取景邏輯：照片保持原比例並鋪滿{design.sizeId === 'instax-mini' ? '拍立得影像區' : '整張相紙'}。放大後可直接上下左右拖曳，不會露出空白。</small>
  </section>;
}
function ImageCornerControls({ layer, patch }: { layer: DesignLayer; patch: (change: Partial<DesignLayer>) => void }) {
  const maxRadius = Math.min(layer.width, layer.height) / 2;
  const radius = Math.min(layer.cornerRadiusMm ?? 0, maxRadius);
  const displayRadius = Math.round(radius * 10) / 10;
  const setRadius = (value: number) => patch({ cornerRadiusMm: Math.max(0, Math.min(maxRadius, value)) });
  const presets = [0, 2, 4, 8, maxRadius].filter((value, index, values) => value <= maxRadius && values.indexOf(value) === index);
  return <section className="image-corner-controls" aria-label="圖片 R 角">
    <div className="image-adjustment-heading"><b>圖片 R 角</b><output>{radius ? `R${displayRadius} mm` : '直角'}</output></div>
    <div className="corner-radius-input"><Numeric label="半徑 (mm)" value={radius} min={0} max={maxRadius} step={0.1} onChange={setRadius}/><input aria-label="R 角滑桿" type="range" min="0" max={maxRadius} step="0.1" value={radius} onChange={e => setRadius(+e.target.value)}/></div>
    <div className="corner-radius-presets" role="group" aria-label="常用 R 角">{presets.map(value => <button type="button" key={value} className={Math.abs(radius - value) < .05 ? 'active' : ''} onClick={() => setRadius(value)}>{value === 0 ? '直角' : value === maxRadius ? '全圓' : `R${value}`}</button>)}</div>
    <small>每張圖片可獨立設定；畫布、成品預覽與輸出檔會同步套用。</small>
  </section>;
}
function ImageAdjustments({ layer, patch }: { layer: DesignLayer; patch: (change: Partial<DesignLayer>) => void }) {
  const brightness = layer.brightness ?? 1, contrast = layer.contrast ?? 1, saturation = layer.saturation ?? 1, blurMm = layer.blurMm ?? 0;
  const changed = brightness !== 1 || contrast !== 1 || saturation !== 1 || blurMm !== 0;
  const slider = (label: string, key: 'brightness' | 'contrast' | 'saturation', value: number, min: number, max: number) => <label>{label} <output>{Math.round(value * 100)}%</output><input aria-label={label} type="range" min={min} max={max} step="0.01" value={value} onChange={e => patch({ [key]: +e.target.value })}/></label>;
  return <section className="image-adjustments" aria-label="圖片微調">
    <div className="image-adjustment-heading"><b>圖片微調</b><button type="button" disabled={!changed} onClick={() => patch({ brightness: 1, contrast: 1, saturation: 1, blurMm: 0 })}>還原</button></div>
    {slider('亮度', 'brightness', brightness, .25, 2)}
    {slider('對比', 'contrast', contrast, .25, 2)}
    {slider('飽和度', 'saturation', saturation, 0, 2)}
    <label>模糊 <output>{blurMm ? `${blurMm.toFixed(1)} mm` : '關閉'}</output><input aria-label="模糊" type="range" min="0" max="10" step="0.1" value={blurMm} onChange={e => patch({ blurMm: +e.target.value })}/></label>
    <small>效果會同步套用到成品預覽與製作檔；模糊限制在圖片框內。</small>
  </section>;
}
function ImageCropControls({ layer, active, start, ratio, apply, cancel, reset }: { layer: DesignLayer; active: boolean; start: () => void; ratio: (ratio: number | null) => void; apply: () => void; cancel: () => void; reset: () => void }) {
  const cropped = layer.cropWidth !== undefined || layer.cropHeight !== undefined;
  return <section className="image-crop-controls" aria-label="圖片裁切">
    <div className="image-adjustment-heading"><b>裁切與取景</b>{cropped && !active && <button type="button" onClick={reset}>還原完整圖片</button>}</div>
    {!active ? <><button type="button" className="crop-start" onClick={start}>{cropped ? '重新裁切' : '開始裁切'}</button><small>進入後直接拖曳畫布上的框線、四邊或四角；原始素材不會被修改。</small></> : <>
      <div className="crop-ratios" role="group" aria-label="裁切比例">
        <button type="button" onClick={() => ratio(null)}>自由</button>
        <button type="button" onClick={() => ratio(1)}>1:1</button>
        <button type="button" onClick={() => ratio(4 / 3)}>4:3</button>
        <button type="button" onClick={() => ratio(3 / 4)}>3:4</button>
        <button type="button" onClick={() => ratio(16 / 9)}>16:9</button>
      </div>
      <small className="crop-live-help">深色區域會被裁掉；拖框內移動整個範圍。</small>
      <div className="crop-actions"><button type="button" onClick={cancel}>取消</button><button type="button" className="primary" onClick={apply}>套用裁切</button></div>
    </>}
  </section>;
}
function DimensionControl({ axis, vertical = false, ...props }: { axis: string; vertical?: boolean; label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return <div className={`dimension-control ${vertical ? 'vertical' : ''}`}>
    <Numeric {...props} step={5} snapOnBlur/>
    <input className="dimension-range" type="range" aria-label={`${axis}滑桿`} aria-orientation={vertical ? 'vertical' : 'horizontal'} aria-valuetext={`${props.value} mm`} min={props.min} max={props.max} step={5} value={props.value} onChange={e => props.onChange(Number(e.target.value))}/>
  </div>;
}
function TransformControls({ layer, patch, disabled = false, restore }: { layer: DesignLayer; patch: (patch: Partial<DesignLayer>) => void; disabled?: boolean; restore?: () => void }) {
  const locked = layer.aspectRatioLocked !== false;
  return <section className="image-transform-controls" aria-label={layer.kind === 'image' ? '圖片自由變形' : '圖層自由變形'}>
    <div><b>{locked ? '等比例縮放' : '自由變形'}</b><small>{locked ? '拖曳四角或輸入寬高維持比例；按住 Shift 可暫時自由變形。' : '比例已解鎖；拖曳四邊或四角、輸入寬高可自由變形。'}</small></div>
    <button type="button" aria-label="鎖定長寬比例" aria-pressed={locked} disabled={disabled} onClick={() => patch({ aspectRatioLocked: !locked })}>{locked ? '解鎖比例' : '鎖定比例'}</button>
    {restore && <button className="restore-image-ratio" type="button" disabled={disabled} onClick={restore}>恢復圖片比例</button>}
  </section>;
}
function Numeric({ label, value, min, max, onChange, step = 0.1, snapOnBlur = false }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; step?: number; snapOnBlur?: boolean }) {
  const [text, setText] = useState(value.toFixed(2).replace(/\.?0+$/, ''));
  useEffect(() => setText(String(Math.round(value * 100) / 100)), [value]);
  return <label>{label}<input type="number" step={step} min={min} max={max} value={text} onChange={e => { setText(e.target.value); const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n) && n >= min && n <= max && (!snapOnBlur || n % step === 0)) onChange(n); }} onBlur={() => { if (snapOnBlur && text.trim() && Number.isFinite(Number(text))) { const n = Math.max(min, Math.min(max, Math.round(Number(text) / step) * step)); setText(String(n)); if (n !== value) onChange(n); } else setText(String(Math.round(value * 100) / 100)); }}/></label>;
}
const root = location.pathname.replace(/\/$/, '').endsWith('/studio') ? <StudioApp/> : <App/>;
createRoot(document.getElementById('root')!).render(<React.StrictMode>{root}</React.StrictMode>);





