# 寫實場景素材 v1

來源：OpenAI 內建 image_gen 工具（非 CLI），2026-10-16 生成。這些是 AI 生成的寫實照片風格場景，不是實拍攝影。沒有使用客戶上傳圖片生成場景。

`bedside-photo-v1.png`、`computer-photo-v1.png` 為原始輸出（1254 × 1254）。同名 WebP 是供網頁載入的品質 90 壓縮版本。空白相框內襯由 `src/PhotoScene.tsx` 的四角透視矩陣覆蓋即時 canvas；場景不寫入客戶設計 JSON 或製作檔。直式與橫式各使用獨立照片與四角校正。橫式使用 `bedside-landscape-v1`、`computer-landscape-v1` 圖檔；照片相框固定為原木款。設計完整保留比例，小幅留白用來補償照片相框實際長寬比差異。

## 床頭櫃最終提示詞

Use case: product-mockup. Generate a photorealistic interior photograph as a background asset for a live product editor, not a UI screenshot. Square composition. A real warm Japanese Scandinavian bedroom bedside corner, pale oak nightstand, linen upholstered bed on left, rumpled ivory bedding, a small ceramic bedside lamp behind-left, subtle warm daylight from left, authentic wood pores and woven linen, restrained lived-in detail. MAIN SUBJECT: one empty thin natural oak portrait picture frame standing on the nightstand at right-center, clearly large and unobstructed, front face nearly parallel to camera with minimal perspective, matte ivory blank insert with A5 portrait aspect 148:210. Frame inner opening should occupy approximately x=48% to 78%, y=36% to 78% of image. Entire frame and feet visible. No objects overlap insert or frame. Realistic optical shadows under frame, soft daylight, 50mm architectural lifestyle photography, naturally imperfect materials, believable real room, no CGI, no illustration, no lettering, no logo, no watermarks. Blank insert is intentionally empty so live artwork can be overlaid by code later.

## 電腦桌最終提示詞

Use case: product-mockup. Create a square photorealistic natural interior photograph for a product editor. A real sophisticated home computer desk in soft window daylight, pale oak desktop with believable wood pores, large monitor with abstract muted blue landscape desktop wallpaper on left, compact off-white keyboard in left foreground, mouse, subtle green plant in far background. Main subject one thin natural oak picture frame standing on desk on right, front nearly parallel to camera, portrait A5 aspect inner opening. Blank matte ivory insert, no text or artwork. Large unobstructed frame opening roughly x=53% to 84%, y=31% to 76%, entire frame visible and its bottom sits on tabletop with real contact shadow. Monitor stays behind-left, never overlaps frame. Honest photographic materials, 50mm lens, subtle depth of field, bounced daylight, realistic soft shadows, warm calm contemporary home office. Camera looks very slightly down at desk, frame faces camera almost frontally with only very subtle perspective. Not CGI, not illustration, no visible brands, no words, no watermark. This scene will be used as a real-looking backdrop with a live editable design composited over blank frame insert.

## 橫式修正提示詞（內建 image_gen 編輯模式）

電腦桌：Use case: precise-object-edit. Edit the provided computer desk photograph. Change ONLY the upright portrait oak picture frame into a LANDSCAPE HORIZONTAL oak picture frame standing on the same desktop, with a completely blank ivory insert whose inner width:height ratio is exactly 210:148 (about 1.419:1). This is a landscape orientation variant of the same scene for a live product editor. Preserve monitor, plant, keyboard, mouse, room, light, wood surface, photographic realism, and square image dimensions. Frame must be noticeably WIDER than TALL, frontal almost parallel to camera, fully visible, unobstructed, realistic contact shadow; do not rotate or crop the entire photo. Position frame roughly across x=42%-91%, y=44%-82%, with its bottom resting on same desk. Use natural oak frame same trim thickness; inside is blank plain ivory, no illustration, no lettering. No extra frames, no hands, no labels, no watermarks.

床頭櫃：Use case: precise-object-edit. Edit the supplied bedside photograph into the LANDSCAPE frame variant of this exact scene. Change ONLY the upright oak picture frame to a wider-than-tall HORIZONTAL A5 landscape frame with blank ivory inner opening width:height 210:148. Preserve bed, pillows, lamp, vase, bedside cabinet, lighting, composition and square image dimensions. Frame is standing on same tabletop in right half, roughly x=42%-92%, y=39%-78%. Almost frontal face, only subtle perspective, fully visible wood rim, natural contact shadow. Match original oak wood grain and trim thickness. No objects may overlap the inner blank panel; panel entirely plain ivory. Do not rotate the whole photograph. Photorealistic interior photograph; no text, logos, watermarks or new objects.

## 2026-10-19: desk / shelf / wall / gallery
Generated with built-in imagegen, eight independent 1254-square images; PNG masters and quality-88 WebP copies in this directory. These are AI-generated photographic scenes, not photographs of actual merchandise. Same live design canvas is projected into each measured aperture. Material reflectance/transparency is illustrative, not optical simulation.

Prompt base: Create a photorealistic premium interior product mockup photograph, square composition. A single thin natural oak picture frame with blank pure off-white artwork aperture, A5 PORTRAIT aspect ratio 148:210. Frame is prominent at center, aperture takes about 35% image width and 50% image height, complete frame visible, front nearly parallel to camera, no props overlap frame or blank aperture. Real contact shadows, subtle wood grain, editorial interior photography, natural daylight, no text, no logos, no graphics inside frame.

Landscape variant replaces PORTRAIT 148:210 with LANDSCAPE 210:148, and aperture coverage with 55% width and 39% height.
Scene suffixes:
- desk: warm minimal desk with wood tabletop, ceramic coffee cup and small plant positioned to the sides. Frame standing on desk.
- shelf: oak wall shelf with a few linen books and small ceramic vase placed to the sides. Frame standing on shelf.
- wall: warm minimalist living room plaster wall, partial sofa edge far below. Frame hanging on wall.
- gallery: quiet art gallery, muted charcoal wall and pale stone pedestal. Frame standing on pedestal.
Each suffix ends with Save as <scene>-<portrait|landscape>.

## Model cabinet and plush doll wall
Built-in imagegen; four independent AI-generated photographic mockups, PNG masters plus WebP quality 88 copies. Used only as scene backgrounds; editable artwork is rendered live.
Prompt base: Photorealistic square interior product mockup photograph, 1254x1254 composition. One prominent natural oak picture frame centered, front exactly parallel to camera, complete frame visible, blank off-white artwork aperture with no mat, no text or design. Aperture A5 portrait ratio 148:210, about 35% image width and 50% image height. Nothing overlaps frame or aperture. Real materials, editorial photography, soft shadows, no logos. Scene:
Models suffix: collector's illuminated glass model display cabinet, original unbranded robot models and miniature cars on shelves around the frame, tasteful dark charcoal cabinet and warm LED strips. Frame standing on main shelf, focus on frame, models remain clearly recognizable in surrounding shelves.
Dolls suffix: cozy plush toy collection wall, pale oak cubby shelves with adorable original teddy bears, bunny dolls and pastel plush animals, warm cream and blush palette. Frame standing on central shelf, plush toys arranged around it, soft daylight, authentic cozy collector room.
Landscape variant replaces portrait ratio 148:210 with landscape ratio 210:148, and coverage with 50% image width and 35% image height.
