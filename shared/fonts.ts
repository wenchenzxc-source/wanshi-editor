export const fontIds = ['sans', 'serif', 'wenkai', 'wenkai-light', 'wenkai-bold'] as const;
export type FontId = typeof fontIds[number];
export const fonts: { id: FontId; name: string; family: string; file: string; license: string }[] = [
  { id: 'sans', name: '思源黑體 · Noto Sans TC', family: 'Wanshi Sans', file: 'NotoSansTC.ttf', license: 'OFL.txt' },
  { id: 'serif', name: '思源宋體 · Noto Serif TC', family: 'Wanshi Serif', file: 'NotoSerifTC.ttf', license: 'NotoSerifTC-OFL.txt' },
  { id: 'wenkai', name: '霞鶩文楷 · 標準', family: 'Wanshi WenKai', file: 'LXGWWenKaiTC-Regular.ttf', license: 'LXGWWenKaiTC-OFL.txt' },
  { id: 'wenkai-light', name: '霞鶩文楷 · 細體', family: 'Wanshi WenKai Light', file: 'LXGWWenKaiTC-Light.ttf', license: 'LXGWWenKaiTC-OFL.txt' },
  { id: 'wenkai-bold', name: '霞鶩文楷 · 粗體', family: 'Wanshi WenKai Bold', file: 'LXGWWenKaiTC-Bold.ttf', license: 'LXGWWenKaiTC-OFL.txt' },
];
export const getFont = (id?: string) => fonts.find(f => f.id === id) || fonts[0];
