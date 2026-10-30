import { useEffect, useRef, useState } from 'react';
import { artCatalog, artCategories, holidayCategories, motifTypes } from '../shared/artwork';
import { quotePresets, quoteStyles } from '../shared/quotes';
import { newLayer } from '../shared/model';
import { drawLayer } from '../shared/draw';
import { publicUrl, svgDataUrl } from './urls';
import { loadFont } from './fontLoader';
function QuoteThumbnail({ preset }: { preset: (typeof quotePresets)[number] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let active = true;
    const draw = () => {
      if (!active) return;
      const style = quoteStyles[preset.style], scale = Math.min(220 / style.width, 130 / style.height);
      canvas.width = 240; canvas.height = 150;
      ctx.setTransform(scale, 0, 0, scale, (240 - style.width * scale) / 2, (150 - style.height * scale) / 2);
      drawLayer(ctx, newLayer('text', { quoteStyle: preset.style, text: preset.text, width: style.width, height: style.height,
        fontSize: style.fontSize, fill: style.textColor, fontId: preset.fontId || 'sans', fontWeight: (preset.fontId || preset.style === 'quote') ? 'normal' : 'bold', textAlign: 'center' }));
    };
    void loadFont(preset.fontId || 'sans').then(draw, draw);
    return () => { active = false; };
  }, [preset]);
  return <canvas ref={ref} width="240" height="150" aria-hidden="true"/>;
}
export function ArtLibrary({ add, addQuote, disabled }: { add: (id: string) => void; addQuote: (id: string) => void; disabled: boolean }) {
  const [category, setCategory] = useState<string>(() => {
    const saved = sessionStorage.getItem('wanshi:art-category');
    return artCategories.some(value => value === saved && value !== '圖框') ? saved! : '全部';
  });
  const [query, setQuery] = useState(() => sessionStorage.getItem('wanshi:art-query') || '');
  useEffect(() => { sessionStorage.setItem('wanshi:art-category', category); sessionStorage.setItem('wanshi:art-query', query); }, [category, query]);
  const term = query.trim().toLocaleLowerCase();
  const matchesCategory = (art: (typeof artCatalog)[number], value: string) => {
    if (value === '全部') return true;
    if (value === '節慶') return art.category === '節慶' || art.category === '萬聖節';
    return art.category === value || !!art.tags?.includes(value);
  };
  const countFor = (value: string) => artCatalog.filter(art => art.category !== '圖框' && matchesCategory(art, value)).length + (value === '全部' || value === '動漫用語' ? quotePresets.length : 0);
  const items = artCatalog.filter(art => art.category !== '圖框' && matchesCategory(art, category) && (!term || [art.name, art.category, ...(art.tags || [])].some(text => text.toLocaleLowerCase().includes(term))));
  const quotes = (category === '全部' || category === '動漫用語' ? quotePresets : []).filter(preset => !term || [preset.name, preset.text, quoteStyles[preset.style].name, ...preset.tags].some(value => value.toLocaleLowerCase().includes(term)));
  const generalCategories = artCategories.filter(value => value !== '全部' && value !== '節慶' && value !== '圖框' && value !== '圖騰紋樣' && !holidayCategories.some(holiday => holiday === value) && !motifTypes.some(type => type === value));
  return <section aria-label="原創素材庫">
    <p className="muted">手繪素材可自由排版；四角圖框請到左側「四角」設定。</p>
    <div className="art-search"><input aria-label="搜尋素材" type="search" placeholder="搜尋圖案、動漫用語或節日" value={query} onChange={event => { setQuery(event.target.value); if (event.target.value) setCategory('全部'); }}/><span aria-live="polite">{items.length + quotes.length} 款</span></div>
    <label className="art-category-picker">素材分類<select aria-label="素材分類" value={category} onChange={event => { setCategory(event.target.value); setQuery(''); }}><option value="全部">全部素材（{countFor('全部')}）</option><optgroup label="日常與裝飾">{generalCategories.map(value => <option key={value} value={value}>{value}（{countFor(value)}）</option>)}</optgroup><optgroup label="圖騰類型"><option value="圖騰紋樣">全部圖騰（{countFor('圖騰紋樣')}）</option>{motifTypes.map(value => <option key={value} value={value}>{value}（{countFor(value)}）</option>)}</optgroup><optgroup label="節日素材"><option value="節慶">全部節慶（{countFor('節慶')}）</option>{holidayCategories.map(value => <option key={value} value={value}>{value}（{countFor(value)}）</option>)}</optgroup></select></label>
    {category === '動漫用語' && <p className="muted">點選版型後會打開「調字」；預設文案、字體、大小及顏色都能修改。</p>}
    <div className="art-grid">{items.map(art => <button key={art.id} disabled={disabled} onClick={() => add(art.id)}><span className={`art-thumb ${art.category === '光影星芒' ? 'dark' : ''}`}><img src={art.file ? publicUrl(`artwork/${art.file}`) : svgDataUrl(art.svg || '')} alt=""/></span><b>{art.name}{art.category === '圖騰紋樣' && <small aria-hidden="true">{motifTypes.find(type => art.tags?.includes(type)) || '自由圖案'}</small>}</b></button>)}{quotes.map(preset => <button key={preset.id} disabled={disabled} onClick={() => addQuote(preset.id)}><span className="art-thumb quote-thumb"><QuoteThumbnail preset={preset}/></span><b>{preset.name}<small aria-hidden="true">{quoteStyles[preset.style].name}・可改字</small></b></button>)}</div>
    {!items.length && !quotes.length && <p className="empty-note">找不到符合的素材。可換個關鍵字或選「全部」。</p>}
    <p className="muted">本庫素材為原創繪製或本專案生成，可用於工作室及客戶商品製作。</p>
  </section>;
}
