// Original editable quote layouts and generic fan expressions for Wanshi designs.
import type { FontId } from './fonts';
export const quoteStyleIds = ['banner', 'quote', 'speech', 'caption', 'impact'] as const;
export type QuoteStyle = typeof quoteStyleIds[number];

export const quoteStyles: Record<QuoteStyle, { name: string; width: number; height: number; fontSize: number; textColor: string }> = {
  banner: { name: '應援橫幅', width: 100, height: 29, fontSize: 8, textColor: '#fff9eb' },
  quote: { name: '名言框', width: 94, height: 42, fontSize: 6.5, textColor: '#3f564c' },
  speech: { name: '漫畫對話框', width: 91, height: 42, fontSize: 6.5, textColor: '#344b49' },
  caption: { name: '旁白標籤', width: 88, height: 27, fontSize: 6.5, textColor: '#624c52' },
  impact: { name: '重點爆發框', width: 91, height: 44, fontSize: 8, textColor: '#644c39' },
};

export const quotePresets: readonly { id: string; name: string; text: string; style: QuoteStyle; fontId?: FontId; tags: readonly string[] }[] = [
  { id: 'this-is-my-oshi', name: '這是我推', text: '這是我推', style: 'banner', tags: ['動漫', '應援', '我推'] },
  { id: 'favorite-arrives', name: '本命登場', text: '本命登場', style: 'banner', tags: ['動漫', '應援', '本命'] },
  { id: 'cheer-today', name: '今日份應援', text: '今日份應援', style: 'banner', tags: ['動漫', '應援'] },
  { id: 'favorite-quote', name: '喜歡的心情', text: '喜歡的心情，永遠不嫌多。', style: 'quote', fontId: 'hand-thin', tags: ['名言', '收藏'] },
  { id: 'keep-this-line', name: '這句我要收藏', text: '這句我要收藏。', style: 'quote', fontId: 'brush', tags: ['名言', '收藏'] },
  { id: 'dont-ask', name: '別問就是本命', text: '別問，問就是本命。', style: 'speech', tags: ['動漫', '玩梗', '本命'] },
  { id: 'rewatch-scene', name: '這段我要重播', text: '這段我要重播！', style: 'speech', tags: ['動漫', '玩梗'] },
  { id: 'high-energy', name: '前方高能', text: '前方高能！', style: 'impact', fontId: 'mono', tags: ['動漫', '玩梗'] },
  { id: 'i-can-do-this', name: '我可以', text: '我可以！', style: 'impact', tags: ['動漫', '玩梗'] },
  { id: 'iconic-moment', name: '名場面預定', text: '名場面預定', style: 'caption', fontId: 'iansui', tags: ['動漫', '玩梗'] },
  { id: 'watch-again', name: '再看億遍', text: '再看億遍', style: 'caption', tags: ['動漫', '玩梗'] },
  { id: 'fell-in-love', name: '一秒入坑', text: '一秒入坑', style: 'caption', tags: ['動漫', '玩梗'] },
];

export function quoteInsets(style: QuoteStyle, width: number, height: number) {
  const ratios: Record<QuoteStyle, [number, number, number, number]> = {
    banner: [.15, .15, .18, .18], quote: [.12, .12, .16, .16],
    speech: [.11, .11, .12, .28], caption: [.10, .08, .14, .14], impact: [.18, .18, .18, .18],
  };
  const [left, right, top, bottom] = ratios[style];
  return { left: width * left, right: width * right, top: height * top, bottom: height * bottom };
}

export function drawQuoteFrame(ctx: CanvasRenderingContext2D, style: QuoteStyle, width: number, height: number) {
  const w = width, h = height;
  ctx.save();
  ctx.lineJoin = 'round';
  if (style === 'banner') {
    ctx.beginPath();
    ctx.moveTo(0, h * .17); ctx.lineTo(w * .12, h * .17); ctx.lineTo(w * .12, 0);
    ctx.lineTo(w * .88, 0); ctx.lineTo(w * .88, h * .17); ctx.lineTo(w, h * .17);
    ctx.lineTo(w * .93, h * .5); ctx.lineTo(w, h * .83); ctx.lineTo(w * .88, h * .83);
    ctx.lineTo(w * .88, h); ctx.lineTo(w * .12, h); ctx.lineTo(w * .12, h * .83);
    ctx.lineTo(0, h * .83); ctx.lineTo(w * .07, h * .5); ctx.closePath();
    ctx.fillStyle = '#315d56'; ctx.fill(); ctx.strokeStyle = '#abc4ac'; ctx.lineWidth = .4; ctx.stroke();
    ctx.strokeStyle = '#d6c597'; ctx.lineWidth = .32;
    ctx.beginPath(); ctx.moveTo(w * .16, h * .13); ctx.lineTo(w * .84, h * .13); ctx.moveTo(w * .16, h * .87); ctx.lineTo(w * .84, h * .87); ctx.stroke();
  } else if (style === 'quote') {
    ctx.fillStyle = '#f7f3e8'; ctx.strokeStyle = '#b8ad91'; ctx.lineWidth = .55;
    ctx.beginPath(); ctx.roundRect(.4, .4, w - .8, h - .8, Math.min(h * .12, 4)); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#d8ccb2'; ctx.lineWidth = .25;
    ctx.beginPath(); ctx.roundRect(w * .045, h * .09, w * .91, h * .82, Math.min(h * .07, 2)); ctx.stroke();
    ctx.fillStyle = '#b2aa91'; ctx.font = `${Math.max(4, h * .26)}px serif`;
    ctx.fillText('“', w * .065, h * .22); ctx.fillText('”', w * .89, h * .89);
  } else if (style === 'speech') {
    ctx.fillStyle = '#f3f7f2'; ctx.strokeStyle = '#78918b'; ctx.lineWidth = .65;
    ctx.beginPath(); ctx.moveTo(w * .09, h * .02); ctx.quadraticCurveTo(w * .02, h * .02, w * .02, h * .16);
    ctx.lineTo(w * .02, h * .65); ctx.quadraticCurveTo(w * .02, h * .78, w * .13, h * .78);
    ctx.lineTo(w * .29, h * .78); ctx.lineTo(w * .23, h * .98); ctx.lineTo(w * .45, h * .78);
    ctx.lineTo(w * .89, h * .78); ctx.quadraticCurveTo(w * .98, h * .78, w * .98, h * .65);
    ctx.lineTo(w * .98, h * .16); ctx.quadraticCurveTo(w * .98, h * .02, w * .89, h * .02); ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else if (style === 'caption') {
    ctx.fillStyle = '#f1e2e1'; ctx.strokeStyle = '#bf9c9c'; ctx.lineWidth = .55;
    ctx.beginPath(); ctx.roundRect(.4, .4, w - .8, h - .8, Math.min(4, h * .18)); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c89fa0'; ctx.fillRect(w * .06, h * .18, Math.max(.6, w * .012), h * .64);
    ctx.strokeStyle = '#fff9f3'; ctx.lineWidth = .25;
    ctx.beginPath(); ctx.moveTo(w * .12, h * .18); ctx.lineTo(w * .88, h * .18); ctx.stroke();
  } else {
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 12;
      const r = i % 2 ? .42 : .5;
      const x = w / 2 + Math.cos(angle) * w * r;
      const y = h / 2 + Math.sin(angle) * h * r;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fillStyle = '#fff1cd'; ctx.strokeStyle = '#b8986d'; ctx.lineWidth = .65; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * .3, h * .28, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#d7bc8c'; ctx.lineWidth = .27; ctx.stroke();
  }
  ctx.restore();
}
