# 識別牌生活場景與開槽

## 製作設定
- 識別牌預設厚度 3 mm，規格 50×90、60×90、80×80 mm。
- 開槽可關閉；開啟時預設槽長 12 mm、槽寬 3 mm，以 1 mm 為單位輸入。
- 槽在目前方向的上方置中，槽頂離成品頂邊 5 mm；圓角半徑為 1 mm 或短邊一半（取較小者）。
- 旋轉直橫式時，位置重新計算於上方；超出新尺寸的槽長寬會縮至安全範圍。
- 畫布顯示槽位；成品預覽及彩色列印 PNG 的槽內透明，UV 遮罩槽內為黑。
- 製作包保留 design.json 的 slot 設定、manufacturing.json 中的實際位置，另含 slot-cut-path.svg（毫米單位；只有開槽路徑）。
- 槽邊界需由加工端依工具與配件確認；圖上的金屬扣與生活情境僅供視覺參考，不會印入製作圖。

## 圖片資產
使用內建 image_gen 工具產生原始寫實照片，再由網頁疊加即時設計；沒有預先合成客戶圖稿。
- `public/scenes/badge-backpack-v1.png`
- `public/scenes/badge-lanyard-v1.png`

### 背包場景 prompt
Photorealistic square close-up product mockup background of a dark olive canvas backpack on a cafe wooden chair, soft daylight, tactile realistic woven fabric. Camera front-facing nearly parallel to the front pocket, central large smooth uninterrupted fabric panel. At exactly horizontal center and 32 percent from top, a small silver swivel lobster clasp hangs down from a short black webbing loop attached to the bag. Its bottom ends at 38 percent image height. Leave the large area from x28-72 percent and y38-86 percent completely empty of objects, only uninterrupted bag fabric, to digitally composite a dangling acrylic tag later. No tag, no badge, no card, no text, no logo, no people. Natural shallow depth of field, realistic photographic lighting, no graphic illustration. Output save file.

### 配戴場景 prompt
Photorealistic square editorial close-up of a person's upper torso wearing a soft light beige cotton shirt and a dark teal neck lanyard, face and head entirely cropped out. Front-facing nearly parallel camera. Lanyard two straps converge at horizontal center and 30 percent from top with a small silver lobster badge clip ending at 38 percent image height. No badge or card attached yet: leave x28-72 percent y38-86 percent completely empty except smooth beige shirt fabric for later live digital acrylic ID badge overlay. Subtle natural fabric folds outside this central zone, soft office window light, background softly blurred, believable lifestyle photography. No text, no logos, no tag, no badge, no card. Output save file.

## 配件預設與圓角（更新）
配件按鈕位於編輯側邊，使用使用者提供的照片作為辨識縮圖。

| 配件 | 孔槽 |
| --- | --- |
| 織帶扣 | 34 × 4 mm 長槽 |
| 珠鍊 | Ø3 mm 圓孔 |
| 鑰匙圈 | Ø3 mm 圓孔 |
| 識別證掛繩 | 15 × 3 mm 長槽 |
| 皮繩掛扣 | Ø5 mm 圓孔 |
| 原款掛扣 | Ø5 mm 圓孔 |

保留不開孔與自訂長槽。牌身圓角可選 R3 或 R4 mm，預設 R3。圓孔尺寸為直徑；所有孔槽頂端距上緣 5 mm，直橫式均置中於上方。配件型號與圓角寫入 JSON；後端檢查配件與孔槽是否一致。

製作包新增 badge-cut-path.svg，黑線是圓角牌身外框，紅線是孔槽。slot-cut-path.svg 仍提供獨立孔槽路徑。兩檔供選擇使用，勿重複加工相同路徑。PNG 同步處理圓角與孔槽；UV 遮罩在孔與外框之外為黑。已確認版本依當時快照的圓角值輸出。

生活情境照片目前仍為通用金屬扣示意，不會因配件選擇變成該配件的實拍；所選配件名稱、孔槽與牌身外形即時同步。
圓孔新增 left／center／right 定位，左右孔的孔邊距側邊 5 mm，頂邊距上緣 5 mm；長槽保持上方置中。manufacturing.json 的 placement 與 SVG 實際座標同步。情境預覽依實際孔位對齊掛扣，透明底材減少霧灰覆蓋，加入玻璃薄邊與反光；掛扣前景僅遮罩金屬邊緣，避免覆蓋一整塊背景。
