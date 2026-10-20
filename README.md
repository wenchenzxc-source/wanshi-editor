# 萬事造物｜獨立商品編輯器

React + TypeScript + React Konva 編輯器，搭配 Express 私有 API。此專案獨立於旁邊的商城原型，不包含商城、付款或物流。

## 安裝與執行

需要 Node.js 22.12+（已在 Node 24、Windows 驗證）以及 pnpm 10/11 或 npm。

```sh
pnpm install
pnpm dev
```

開啟 http://127.0.0.1:5173。Vite 會將 `/api` 代理到 4310。

正式建置及單一服務啟動：

```sh
pnpm build
pnpm start
```

開啟 http://127.0.0.1:4310。若使用 npm，可執行 `npm install`、`npm run build`、`npm start`；可重現的依賴版本以 `pnpm-lock.yaml` 為準。

本次環境沒有全域 npm，已安裝套件，也可以直接執行：

```sh
node --import tsx server/index.ts
```

## 操作

1. 多選或拖入 JPG、PNG、WebP，一次最多 12 張，每張 20 MB、40MP 內，不接受動畫。每張立即加入獨立圖層。
2. 畫布直接拖曳；四個角落可等比例縮放；上方把手旋轉。文字、素材與 UV 圖層相同。手機支援單指拖曳與控制點操作，工作區可縮放、符合寬度與捲動。
3. 右側編輯精確毫米座標、寬高、旋轉、透明度、色彩與文字。圖層面板可排序、鎖定、隱藏；右側可複製與刪除。
4. 拖動時吸附至裁切邊、安全線、中心及其他圖層邊界，右側成品預覽同時更新，不含控制點。
5. 變更後約 0.9 秒自動儲存，也可從版本面板手動儲存。重新整理與「我的設計」可重開；多分頁衝突回傳 409，不覆蓋他人的較新草稿。
6. 「確認與輸出」顯示最終預覽；確認後建立不可覆寫版本與製作 PNG，可下載 ZIP。再編輯草稿或將確認版本載入草稿，都不更動舊版 JSON、模板及圖檔。

快捷鍵：Ctrl/Cmd+Z 撤銷、Ctrl/Cmd+Shift+Z 或 Ctrl+Y 重做、Delete 刪除、方向鍵移動 0.5 mm（Shift 為 5 mm）。數字欄位可逐項修改。鎖定圖層需先解鎖才能調整。

### 模板

`shared/model.ts` 為預設 A5 模板：148 × 210 mm，直／橫式。出血 3 mm、安全區 5 mm、300 DPI 是本階段的**可修改初始設定**，上線前應由加工廠確認。未取得孔位資料，因此 A5 預設沒有不可加工區，沒有捏造孔位。

設定 `TEMPLATES_FILE` 指向 `templates.example.json` 格式的 JSON 陣列即可替換目錄，不需修改前端。`noProcess` 使用直式成品左上角為原點的矩形毫米座標，欄位為 `x/y/width/height/label`，橫式自動旋轉。畫布以紅色標示；它是印前檢查提示，不會自動刪除覆蓋其上的客戶圖層。加工前需檢查該區域。

增加模板時請使用新的版本 ID（例如 `a5-plaque-v2`），並保留舊 ID，以便重開舊草稿。確認版本內已封存完整模板。總輸出限制 40MP，以避免不合理模板耗盡記憶體。

### AI 去背

設定程序環境變數 `REMOVEBG_API_KEY` 後重新啟動，才會啟用 remove.bg。實際呼叫其 API，失敗不會建立假去背結果；去背版本另存，原始位元組不變，介面可還原原圖。未設定時按鈕明確停用，API 回傳 503。啟用服務會把使用者選取的圖片送往 remove.bg 並使用其額度。此次未提供金鑰，未測試真實計費服務呼叫。

## ZIP 製作包

| 檔案 | 內容 |
| --- | --- |
| `originals/{assetId}.jpg/png/webp` | 這個設計確認當下所有上傳原圖，包括已從畫布移除的圖片 |
| `cutouts/{assetId}.png` | 去背衍生檔，若有 |
| `final-preview.png` | 客戶確認成品排版，裁切尺寸，含 UV 示意、不含輔助線 |
| `production-with-bleed.png` | 含出血的彩色加工圖，UV 圖層另行輸出 |
| `design.json` | 完整可編輯圖層、座標、設定與 WooCommerce 預留欄位 |
| `uv-mask.png` | 若有可見 UV 圖層：黑底白形狀，透明度轉灰階強度 |
| `manifest.json` | 版本 ID、時間、模板、素材原始名稱、SHA-256、來源素材與訂單欄位 |
| `README.txt` | 製作檔說明 |

300 DPI 預設直式成品為 1748 × 2480 px，含出血 1819 × 2551 px（毫米 × DPI / 25.4 四捨五入）。PNG 寫入 DPI metadata。UV 遮罩與含出血彩圖同尺寸、同原點，可對位。字型使用隨附 Noto Sans TC；前後端共用 `shared/draw.ts` 路徑、排版與毫米資料。輸出用原始解析度圖片，前端工作圖最多 2000px 長邊，均處理 EXIF 方向。

UV 預覽僅表達區域與相對強度，不模擬實際高度；輸出為 RGB PNG，並未實作印刷設備 ICC/CMYK、專色、RIP 或機台校正。

## 儲存與私有存取

`DATA_DIR`（預設 `data/`）包含 `drafts/`、`assets/`、`files/`、`versions/`、`sessions/`。它不在靜態網站根目錄，所有圖片、版本、ZIP 需持有對應 HttpOnly/SameSite cookie 才能讀取。下載不使用公開靜態網址。請持久掛載並備份整個資料夾；不要只備份 JSON。

本階段為本機／受控部署的**匿名瀏覽器工作階段**，不是會員系統。同一瀏覽器可重開，其他瀏覽器不能存取；清除 cookie 會失去原工作階段存取權。沒有帳號登入、密碼重設、跨裝置設計恢復或正式多租戶權限管理。API 預設只監聽 127.0.0.1。跨裝置測試需自訂 `HOST`／防火牆，且手機會是獨立工作階段。

`.env.example` 是設定參考，不會自動載入。請用 shell、程序管理器或 `node --env-file=.env --import tsx server/index.ts`（建立自己的 `.env` 後）傳入。HTTPS 部署請設 `COOKIE_SECURE=true`、`ALLOWED_ORIGINS`，使用同源反向代理。公開上線前需補會員驗證、配額／限流、稽核、備份與儲存遷移。檔案儲存的串行鎖僅支援單 Node 程序；多實例應換交易式資料庫及私有物件儲存。

## 測試

```sh
pnpm test
pnpm build
pnpm test:e2e
```

E2E 預設使用已安裝的 Chrome（`channel: 'chrome'`）。若環境沒有 Chrome，可安裝瀏覽器或修改 `playwright.config.ts` 為對應 Playwright Chromium。E2E 自動啟動 4311 測試服務，資料在 `test-results/server-data`，與正式 `data/` 分離。截圖及失敗 trace 在 `test-results/`。

整合測試涵蓋原圖 byte equality、私有存取、惡意來源、未設定去背、草稿衝突、精確重載、PNG 尺寸/DPI、UV 灰階值、ZIP 檔案完整性與確認快照不變。瀏覽器測試涵蓋多圖、滑鼠拖動與即時預覽、角落縮放與旋轉、鎖定、文字、UV、下載，以及手機 touch 事件後重開。

## 後續 WooCommerce

參閱 `docs/API.md` 和 `docs/WOOCOMMERCE.md`。目前保留 `wooCommerceProductId`、`design.id`、`orderItemId`，確認後另外取得不可變的 `versionId`。實際購物車／訂單應綁定 `versionId`，不可只綁定可變草稿。

## 字型授權

`public/fonts/NotoSansTC.ttf` 來自 Google Fonts 的 Noto Sans TC，依 SIL Open Font License 散布；授權在同目錄 `OFL.txt`。

### 壓克力磚編輯與尺寸參照
- 尺寸選單只提供迷你飯友、飯友、小立磚與其他尺寸。既有舊規格以「其他尺寸」顯示並保留原排版；未指定厚度需於自訂尺寸填寫。已確認快照不受影響。
- 壓克力磚使用固定高度編輯區，規格／方向切換時自動符合可視範圍。縮放範圍 10%–1000%，只影響編輯顯示，不改變製作尺寸。
- 預覽提供 約 8.56 × 5.4 cm 信用卡示意與公分尺，和產品使用同一比例；參照物不會加入製作輸出，螢幕顯示也不代表實際大小。

壓克力磚採現成底材直噴：出血 0 mm、安全線每邊內縮 1 mm（排版提醒，不自動裁切圖稿）。迷你飯友、飯友、小立磚安全區分別為 18 × 28、28 × 48、58 × 98 mm；自訂尺寸同樣每邊扣除 1 mm。A5 保持出血 3 mm、安全區內縮 5 mm。已確認版本使用當時保存的模板設定。

自訂壓克力磚尺寸：長、高為 20–250 mm，厚為 5–50 mm，皆以 5 mm 為單位。滑桿與輸入框同步；輸入離焦時就近對齊 5 mm 並限制上下限，API 會拒絕不合規尺寸。
厚度上限會隨自訂尺寸更新，為 min(長, 高, 50 mm)。縮小長或高時，厚度同步降到合法上限；直橫切換不影響短邊限制。
商品種類已改為頁面頂端卡片切換。壓克力識別牌提供 50×90、60×90、80×80 mm，支援直橫式、既有底材與圖層流程；暫採 0 mm 出血、1 mm 安全內縮。厚度與孔位尚未指定，模板未加入孔位或厚度。
識別牌已更新為預設厚 3 mm，支援上方置中的自訂開槽與背包／配戴生活情境。製作設定與場景生成紀錄見 docs/badge-scenes-and-slot.md；此設定取代先前未設定厚度與孔位的說明。
識別牌配件可從編輯側邊按鈕選取，孔槽自動套用；牌身提供 R3／R4 mm 圓角，預設 R3，並輸出 badge-cut-path.svg 完整外框與孔槽路徑。詳細對照見 docs/badge-scenes-and-slot.md。
