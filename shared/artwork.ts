// Original artwork authored or generated for Wanshi. No third-party images or fonts.
// Permission: use, modify and reproduce commercially within Wanshi designs/products.
export const artCategories = ['全部', '花瓣', '植物花草', '手繪小物', '光影星芒', '萬聖節', '圖框'] as const;
const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 100 100"><defs><radialGradient id="glow"><stop stop-color="#fffef4"/><stop offset=".15" stop-color="#ffe2a4" stop-opacity=".85"/><stop offset="1" stop-color="#ffd48a" stop-opacity="0"/></radialGradient><linearGradient id="petal" x2=".8" y2="1"><stop stop-color="#fff2ef"/><stop offset=".5" stop-color="#f4b5be"/><stop offset="1" stop-color="#d97699"/></linearGradient></defs>${body}</svg>`;
const petal = `<path d="M0 0 C-22 -8 -22 -37 0 -27 C22 -37 22 -8 0 0Z" fill="url(#petal)"/><path d="M0 -2 Q-3 -15 0 -23" stroke="#fff0ed" stroke-width=".6" fill="none"/>`;
const star = `<circle r="23" fill="url(#glow)"/><path d="M0 -18 Q2 -2 18 0 Q2 2 0 18 Q-2 2 -18 0 Q-2 -2 0 -18Z" fill="#fff6db"/><circle r="2" fill="#fff"/>`;
const web = `<g fill="none" stroke="#c3c9d8" stroke-width=".55" stroke-linecap="round"><path d="M2 2L55 2M2 2L53 22M2 2L42 42M2 2L22 53M2 2L2 55"/>${[12,24,36,48].map(r=>`<path d="M${r+2} 2 Q${r*.7} 6 ${r*.92+2} ${r*.38+2} Q${r*.62} ${r*.42} ${r*.71+2} ${r*.71+2} Q${r*.42} ${r*.62} ${r*.38+2} ${r*.92+2} Q6 ${r*.7} 2 ${r+2}"/>`).join('')}</g>`;
const pumpkin = `<path d="M50 30 Q46 17 55 16" stroke="#617843" stroke-width="5" fill="none"/><ellipse cx="50" cy="55" rx="31" ry="29" fill="#e68c3b"/><ellipse cx="50" cy="55" rx="17" ry="29" fill="#f9ad4b"/><path d="M32 45 L43 48 L32 52Z M68 45L57 48L68 52Z M33 63 Q50 79 67 63 L57 67 L53 62 L48 69 L43 64Z" fill="#533d49"/>`;
export type Artwork = { id: string; name: string; category: string; tags?: readonly string[]; svg?: string; file?: string };
export const artCatalog: readonly Artwork[] = [
  { id: 'sakura-single', name: '獨立櫻花瓣', category: '花瓣', file: 'sakura-single-v1.png' },
  { id: 'rose-single', name: '獨立玫瑰花瓣', category: '花瓣', file: 'rose-single-v1.png' },
  { id: 'sakura-natural', name: '淡櫻花枝', category: '花瓣', file: 'sakura-natural-v1.png' },
  { id: 'rose-natural', name: '霧粉玫瑰', category: '花瓣', file: 'rose-natural-v1.png' },
  { id: 'eucalyptus-handpaint', name: '霧青尤加利', category: '植物花草', file: 'eucalyptus-handpaint-v1.png' },
  { id: 'cosmos-handpaint', name: '淡粉波斯菊', category: '植物花草', file: 'cosmos-handpaint-v1.png' },
  { id: 'lavender-handpaint', name: '薰衣草小束', category: '植物花草', file: 'lavender-handpaint-v1.png' },
  { id: 'ginkgo-handpaint', name: '暖秋銀杏', category: '植物花草', file: 'ginkgo-handpaint-v1.png' },
  { id: 'linen-bow-handpaint', name: '霧藍布緞結', category: '手繪小物', file: 'linen-bow-handpaint-v1.png' },
  { id: 'letter-flower-handpaint', name: '乾燥花小信封', category: '手繪小物', file: 'letter-flower-handpaint-v1.png' },
  { id: 'star-glow', name: '暖光星芒', category: '光影星芒', svg: svg(`<g transform="translate(50 50) scale(1.8)">${star}</g>`) },
  { id: 'stardust', name: '細碎星光', category: '光影星芒', svg: svg([[25,25,1],[67,42,.65],[40,75,.45],[80,80,.3]].map(([x,y,s])=>`<g transform="translate(${x} ${y}) scale(${s})">${star}</g>`).join('')) },
  { id: 'bokeh', name: '金色光點', category: '光影星芒', svg: svg([[25,30,20],[60,50,28],[75,83,13],[24,80,10]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="url(#glow)"/>`).join('')) },
  { id: 'spiderweb', name: '角落蜘蛛網', category: '萬聖節', svg: svg(`<g transform="scale(1.7)">${web}</g><path d="M70 51V72" stroke="#747185" stroke-width=".5"/><g stroke="#51455a" stroke-width="1.2" fill="none"><path d="M70 77L62 70M70 77L60 77M70 77L62 84M70 77L78 70M70 77L80 77M70 77L78 84"/></g><ellipse cx="70" cy="77" rx="3" ry="5" fill="#51455a"/>`) },
  { id: 'pumpkin', name: '南瓜燈', category: '萬聖節', svg: svg(pumpkin) },
  { id: 'bat', name: '月夜蝙蝠', category: '萬聖節', svg: svg(`<path d="M49 43L43 31L42 44Q25 26 8 33Q25 38 15 59Q31 50 34 68Q43 58 50 67Q57 58 66 68Q69 50 85 59Q75 38 92 33Q75 26 58 44L57 31L51 43Z" fill="#51435f"/><circle cx="46" cy="48" r="1.4" fill="#ffce89"/><circle cx="54" cy="48" r="1.4" fill="#ffce89"/>`) },
  { id: 'halloween-frame', name: '蛛網相框', category: '圖框', tags: ['萬聖節'], svg: svg(`<rect x="3" y="3" width="94" height="94" rx="3" fill="none" stroke="#776787" stroke-width="1.5"/>${web}<g transform="translate(100 100) rotate(180)">${web}</g>`) },
  { id: 'starlight-frame', name: '星光相框', category: '圖框', tags: ['光影星芒'], svg: svg(`<rect x="7" y="7" width="86" height="86" rx="2" fill="none" stroke="#dac291" stroke-width=".7"/><g transform="translate(10 10) scale(.6)">${star}</g><g transform="translate(90 90) scale(.6)">${star}</g>`) },
  { id: 'petal-frame', name: '花瓣邊框', category: '圖框', tags: ['花瓣'], svg: svg(`<rect x="6" y="6" width="88" height="88" rx="3" fill="none" stroke="#e6b3bb" stroke-width=".5"/>${[[12,25,20],[86,94,-160],[15,88,-45],[86,24,155]].map(([x,y,r])=>`<g transform="translate(${x} ${y}) rotate(${r}) scale(.65)">${petal}</g>`).join('')}`) },
] as const;
