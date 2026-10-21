# 自然花材與貼合圖框

## 花材
使用內建 image_gen 生成兩款透明背景素材（非攝影實拍）。舊卡通花瓣自素材目錄移除，既有草稿與確認版本中的原始 PNG 保留。

- public/artwork/sakura-natural-v1.png：淡櫻花枝。生成來源 exec-f289e7be-7cf5-4019-92c6-745d8a760186.png。
- public/artwork/rose-natural-v1.png：霧粉玫瑰。生成來源 exec-a37fce14-b44d-499c-8d8a-f39b8374f5f7.png。

內建生成來源目錄：C:/Users/102412/.codex/generated_images/01a14239-c590-7640-b4c9-639a2c84cdfb/ 。專案使用上列 public 檔案，保留 alpha，不需依賴生成目錄。

櫻花 prompt：A delicate airy cluster of three real Japanese cherry blossoms and two detached petals, soft blush pink and ivory, subtly translucent silky petals, fine natural stamens, slightly irregular organic shapes. Fine art botanical macro photography with gentle diffused light, restrained Japanese stationery editorial aesthetic, elegant and understated, NOT cartoon, NOT vector, NO outlines. Isolated transparent background with clean natural alpha edges, no paper, no ground, no border, no lettering. One cohesive decoration, centered with modest padding, square canvas.

玫瑰 prompt：A single real dusty blush rose in three-quarter view, loosely layered delicate petals, one small muted sage leaf and two fallen petals beside it. Fine art botanical macro photography, natural petal texture, soft diffuse light, muted warm ivory and dusty rose palette, tasteful literary stationery mood. NOT cartoon, NOT vector, NO outlines, no glitter. Isolated transparent background, no backdrop, no paper, no ground or cast shadow, no text, no frame. One cohesive centered decoration with modest padding, square canvas.

## 圖框
素材庫的圖框按鈕改為「套用到版面」，建立 kind: frame 與 frameId，而非方形 PNG 圖片。

- A5 等商品以安全區為邊界；照片立掛牌以實際可印影像區為邊界，不覆蓋白邊。
- 所有尺寸、直橫式、照片白邊切換，會由 fitFrames 同步更新圖框的 x/y/width/height。
- 圖框不可拖曳、旋轉、自由縮放或解鎖。可替換、隱藏及移除。
- 邊線按版面比例重畫；角落蜘蛛網、星芒與枝葉保持比例，不把正方形影像拉長。
- 單一版面使用一款圖框，新套用會替換先前 frame；同名且來源相符的舊素材圖框也會替換。
- 舊的自由擺放圖框不強制改寫；在素材庫重新點選同款即可更新。已確認版本不變。
- Canvas 與後端高解析 renderer 共用 shared/frame.ts；後端驗證圖框幾何與鎖定狀態。

測試包含 PNG alpha、圖框直橫式輸出、儲存重載、替換圖框、A5 切至拍立得時貼合影像區。
