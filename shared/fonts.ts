export const fontIds = ['sans', 'serif', 'wenkai', 'wenkai-light', 'wenkai-bold', 'mono', 'brush', 'hand-thin', 'iansui'] as const;
export type FontId = typeof fontIds[number];
export const fontGroups = ['基本字體', '機械與等寬', '毛筆書法', '手寫字'] as const;
export type FontGroup = typeof fontGroups[number];
export const fonts: { id: FontId; name: string; family: string; file: string; license: string; group: FontGroup }[] = [
  { id: 'sans', name: '思源黑體 · Noto Sans TC', family: 'Wanshi Sans', file: 'NotoSansTC.ttf', license: 'OFL.txt', group: '基本字體' },
  { id: 'serif', name: '思源宋體 · Noto Serif TC', family: 'Wanshi Serif', file: 'NotoSerifTC.ttf', license: 'NotoSerifTC-OFL.txt', group: '基本字體' },
  { id: 'mono', name: '思源等寬 · 機械字', family: 'Wanshi Mono', file: 'SourceHanMonoTC-Regular.otf', license: 'SourceHanMono-LICENSE.md', group: '機械與等寬' },
  { id: 'brush', name: '莫大毛筆 · 書法', family: 'Wanshi Brush', file: 'Bakudai-Regular.ttf', license: 'Bakudai-OFL.txt', group: '毛筆書法' },
  { id: 'wenkai', name: '霞鶩文楷 · 標準', family: 'Wanshi WenKai', file: 'LXGWWenKaiTC-Regular.ttf', license: 'LXGWWenKaiTC-OFL.txt', group: '手寫字' },
  { id: 'wenkai-light', name: '霞鶩文楷 · 細體', family: 'Wanshi WenKai Light', file: 'LXGWWenKaiTC-Light.ttf', license: 'LXGWWenKaiTC-OFL.txt', group: '手寫字' },
  { id: 'wenkai-bold', name: '霞鶩文楷 · 粗體', family: 'Wanshi WenKai Bold', file: 'LXGWWenKaiTC-Bold.ttf', license: 'LXGWWenKaiTC-OFL.txt', group: '手寫字' },
  { id: 'hand-thin', name: '辰宇落雁 · 纖細手寫', family: 'Wanshi Hand Thin', file: 'ChenYuluoyan-2.0-Thin.ttf', license: 'ChenYuluoyan-OFL.txt', group: '手寫字' },
  { id: 'iansui', name: '芫荽 · 柔和手寫', family: 'Wanshi Iansui', file: 'Iansui-Regular.ttf', license: 'Iansui-OFL.txt', group: '手寫字' },
];
export const getFont = (id?: string) => fonts.find(f => f.id === id) || fonts[0];
