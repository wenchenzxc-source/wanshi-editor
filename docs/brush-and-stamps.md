# 筆刷與獨立花瓣

左側「筆刷」提供選取、自由筆刷與獨立櫻花瓣／玫瑰花瓣印章。觸控與滑鼠使用 Pointer Events；單筆完成後成為可移動、縮放、旋轉、刪除的獨立圖層。筆畫以正規化座標、比例筆寬、顏色及透明度保存，前端與生產輸出使用相同 drawLayer。每個設計最多 150 圖層，每筆最多 6000 點。

底材與列印效果移至編輯窗口的折疊區。移除左側版本入口及單獨確認版本按鈕，購物車保留不可覆寫的確認版本與製作包。

兩款獨立花瓣以內建 image_gen 生成，透明背景保留，無第三方圖庫素材。已複製進 public/artwork，私人素材匯入仍走既有不可覆寫的 API。

- sakura-single-v1.png：來源 exec-a1a935fe-4e8a-49c9-8982-3d498edd53a6.png
  Prompt: One single isolated cherry blossom PETAL, not a flower, pale blush pink, tiny natural notch at broad tip, gently curved botanical petal, realistic macro photography with fine translucent veins, soft diffuse light, tasteful literary stationery aesthetic. Entire petal centered fills 80% square. No stem no leaves no other petals no text no cast shadow. Transparent background, clean alpha edges.
- rose-single-v1.png：來源 exec-1307b86a-083f-41fb-a5f1-2e2c73ee6052.png
  Prompt: Exactly ONE isolated rose petal, not a flower. Dusty muted rose pink, soft curled broad rim, delicate fine veins and natural translucent velvety texture, realistic macro botanical photography, gentle diffuse light, understated literary stationery aesthetic. Whole single petal centered occupying 80% square. No stems no leaves no other petals no text no shadow on ground. Transparent background with clean alpha.

原始生成目錄：C:/Users/102412/.codex/generated_images/01a14239-c590-7640-b4c9-639a2c84cdfb/

驗證：tests/brush.test.ts（生產像素、透明度、UV 隔離與資料驗證），tests/e2e/brush.spec.ts（繪畫、重複蓋印、撤銷重做、重開、底材、加入購物車）。

## 自然飄落模式
新增原創向量櫻花／玫瑰花瓣，正面、斜側、側緣、捲曲四種輪廓，以柔和漸層與摺痕呈現。每次 3–15 片，可局部點灑或灑落整頁。位置、尺寸、旋轉、透明度與姿態僅在插入時計算隨機值，獨立圖層保存後固定。整批可一次撤銷。tests/petals.test.ts 與 tests/e2e/petals.spec.ts 驗證輸出與存取一致。

## 橡皮擦與清空
橡皮擦以圖層區域遮罩保存擦除區，支持筆畫、圖片與素材的局部擦除，鎖定及隱藏圖層略過。遮罩隨圖層縮放旋轉，預覽與生產輸出使用相同裁切。原始圖片不變。清空畫布需確認，包含鎖定及隱藏圖層；保留商品設定與素材，可一次撤銷。已確認版本不變。tests/eraser.test.ts 與 tests/e2e/eraser.spec.ts 驗證局部擦除、輸出、重開、清空取消及撤銷。

完全擦除的自由筆畫會立即移除，避免透明圖層留下大型選取框；載入舊草稿時也會清理已完全擦空的筆畫。圖層列表以「〰」識別自由筆畫，橡皮擦本身不會建立圖層。

## 框選與素材庫
內建素材 libraryArtworkId 從上傳面板與計數中排除，原檔仍保存供設計與製作包引用。框選採 CAD 方向邏輯，不需要切換模式：在選取工具下由左向右拖曳只選完全包含的圖層（藍色實線），由右向左拖曳則選擇所有接觸圖層（綠色虛線）；Shift 追加。拖動任一已選圖層可整批移動，Delete 整批刪除。鎖定及隱藏圖層略過，移動與刪除均為單次撤銷操作。tests/selection.test.ts 驗證方向判定，tests/e2e/selection.spec.ts 驗證素材篩選、框選、批次位移一致、刪除、撤銷、重開及工具列版面。
