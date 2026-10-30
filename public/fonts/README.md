# Bundled font catalogue

Fonts are bundled locally. The browser loads the base font at startup and other fonts when a design or font preview needs them. The browser canvas and server rasterizer use the same files. No third-party font request is made while editing. Existing text without fontId uses the original Noto Sans TC. A text layer stores fontId; undo/redo, drafts and design JSON preserve it. Confirmed raster outputs remain immutable.

- Noto Sans TC: existing font, OFL.txt.
- Noto Serif TC: Google Fonts ofl/notoseriftc, NotoSerifTC-OFL.txt.
- LXGW WenKai TC Regular / Light / Bold: Google Fonts ofl/lxgwwenkaitc, LXGWWenKaiTC-OFL.txt.
- Source Han Mono TC Regular: Adobe Source Han Mono, SourceHanMono-LICENSE.md; equal-width lettering for mechanical or technical captions.
- Bakudai Regular: max32002/bakudaifont, Bakudai-OFL.txt; Traditional Chinese brush lettering.
- ChenYuluoyan Thin 2.0: Chenyu-otf/chenyuluoyan_thin, ChenYuluoyan-OFL.txt; fine handwritten lettering.
- Iansui Regular: Google Fonts ofl/iansui, Iansui-OFL.txt; soft handwritten lettering.

The earlier downloads are pinned to the Google Fonts commit in SOURCE-COMMIT.txt. Original font bytes were not modified. Exact sources:
https://github.com/google/fonts/tree/main/ofl/notoseriftc
https://github.com/google/fonts/tree/main/ofl/lxgwwenkaitc
https://github.com/adobe-fonts/source-han-mono/tree/master/Regular/OTC
https://github.com/max32002/bakudaifont/tree/master/tw
https://github.com/Chenyu-otf/chenyuluoyan_thin
https://github.com/google/fonts/tree/main/ofl/iansui

The four newer files, exact source commits and SHA-256 hashes are recorded in SOURCE-ADDITIONAL.txt.

All are SIL Open Font License 1.1; retain the supplied copyright/license notices when redistributing font files. Commercial designs and printed artwork are permitted; font software cannot be sold by itself. See each complete license for conditions. Internal canvas family aliases do not rename or modify the font binaries.

ZIP packages include fonts used by text layers, their licenses, and fonts/catalog.json. Keep these versioned filenames immutable when adding/upgrading future fonts, so older editable documents retain their appearance. Unsupported glyphs may fall back to the bundled Noto Sans TC. The nine choices represent seven families. Paid fonts are not included.
