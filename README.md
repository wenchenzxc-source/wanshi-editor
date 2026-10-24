# 萬事造物｜獨立商品編輯器

[▶ **開啟 GitHub 線上預覽**](https://wenchenzxc-source.github.io/wanshi-editor/)

[![GitHub Pages 部署狀態](https://github.com/wenchenzxc-source/wanshi-editor/actions/workflows/pages.yml/badge.svg)](https://github.com/wenchenzxc-source/wanshi-editor/actions/workflows/pages.yml)

React + TypeScript + React Konva 編輯器，搭配 Express 私有 API。此專案獨立於旁邊的商城原型，不包含商城、付款或物流。

## GitHub 線上預覽

在 GitHub 專案首頁打開 `README.md`，點最上方的「開啟 GitHub 線上預覽」即可進入。推送 `main` 後，GitHub Actions 會自動建置並部署可操作的 Pages 預覽；旁邊的部署狀態徽章可用來查看建置是否成功。

若預覽尚未出現，請先到 GitHub 專案的 **Settings → Pages**，確認 **Source** 設為 **GitHub Actions**，再到 **Actions → Deploy interactive preview to GitHub Pages** 執行一次 **Run workflow**。預覽網址為 [https://wenchenzxc-source.github.io/wanshi-editor/](https://wenchenzxc-source.github.io/wanshi-editor/)。

線上預覽支援商品切換、直橫式、上傳、排版、素材及瀏覽器本機儲存；資料只留在該瀏覽器的 IndexedDB。確認製作包、正式購物車、AI 去背與私有跨裝置儲存仍需 Express 伺服器，因此在 Pages 預覽中明確停用。

## Vercel + Supabase 正式部署

專案已支援以 Vercel 部署前端及 Express API，並以 Supabase Postgres 保存草稿／版本／購物車、Supabase 私有 Storage 保存原圖與製作檔。未設定 Supabase 時，本機開發仍使用 `data/`，不受影響。

1. 在 Supabase 建立專案，開啟 SQL Editor，執行 [`supabase/migrations/20261022000000_wanshi_storage.sql`](supabase/migrations/20261022000000_wanshi_storage.sql)。這會建立私有 `wanshi-private` bucket 與只允許伺服器 secret key 存取的資料表。
2. 在 Vercel 匯入這個 GitHub repository。專案會讀取 `vercel.json`，執行 `pnpm build`，並把 `api/[...path].ts` 部署為 Node.js Function。
3. 在 Vercel Project Settings → Environment Variables 設定：

   ```text
   SUPABASE_URL=https://你的專案.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_...
   SUPABASE_STORAGE_BUCKET=wanshi-private
   COOKIE_SECURE=true
   ```

4. 重新部署後打開 Vercel 網址。前端與 API 使用同一網域，不需把 Supabase secret key 放進瀏覽器，也不要建立 `VITE_SUPABASE_SECRET_KEY`。

Vercel Function 的請求／回應負載上限為 4.5 MB，因此正式部署會先向 API 取得限時上傳網址，再由瀏覽器把最高 20 MB 的原圖直接傳到 Supabase 私有 Storage。伺服器完成解碼、格式、像素與雜湊檢查後才會把素材加入設計。預覽與 ZIP 下載同樣使用短效簽名網址，檔案不會設為公開。

目前的私有權限仍以 HttpOnly 匿名瀏覽器 session 為單位；換電腦或清除 cookie 後無法恢復原工作階段。若要提供會員跨裝置設計，下一階段再接 Supabase Auth，並把現有 owner 欄位遷移到會員 ID。

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
2. 圖片在畫布直接拖曳；預設四角等比例縮放，按住 Shift 拖曳四角可暫時自由變形，放開後恢復比例鎖。按「解鎖比例」可分別調整寬高，並顯示四邊控制點；再按「鎖定比例」固定目前比例。圖片比例鎖隨各圖層儲存。文字、形狀與 UV 圖層維持四角等比例縮放。上方把手旋轉。手機可用比例鎖按鈕與觸控操作，工作區可縮放、符合寬度與捲動；照片立／掛牌的照片維持專用滿版取景。
3. 右側編輯精確毫米座標、寬高、旋轉、透明度與色彩。文字可調字體、成品毫米字級、顏色、粗體、斜體、底線、左右／置中對齊、字距及行距；介面會換算約略 pt，文字可能超出框時可依實際字寬一鍵縮小到可容納字級。圖片寬高欄位同樣遵守比例鎖，解鎖或按住 Shift 可單獨修改。「恢復圖片比例」可還原原圖或裁切範圍的比例。圖層面板可排序、鎖定、隱藏；右側可複製與刪除。
4. 拖動時吸附至裁切邊、安全線、中心及其他圖層邊界，右側成品預覽同時更新，不含控制點。
5. 變更後約 0.9 秒自動儲存，也可從版本面板手動儲存。重新整理與「我的設計」可重開；多分頁衝突回傳 409，不覆蓋他人的較新草稿。
6. 「確認與輸出」顯示最終預覽；確認後建立不可覆寫版本與製作 PNG，可下載 ZIP。再編輯草稿或將確認版本載入草稿，都不更動舊版 JSON、模板及圖檔。

快捷鍵：Ctrl/Cmd+Z 撤銷、Ctrl/Cmd+Shift+Z 或 Ctrl+Y 重做、Delete 刪除、方向鍵移動 0.5 mm（Shift 為 5 mm）。數字欄位可逐項修改。鎖定圖層需先解鎖才能調整。

### 模板

`shared/model.ts` 為預設 A5 模板：148 × 210 mm，直／橫式。出血 3 mm、安全區 5 mm、600 PPI 圖稿輸出是本階段的**可修改初始設定**，上線前應由加工廠確認。未取得孔位資料，因此 A5 預設沒有不可加工區，沒有捏造孔位。

設定 `TEMPLATES_FILE` 指向 `templates.example.json` 格式的 JSON 陣列即可替換目錄，不需修改前端。為維持本專案的列印品質保證，自訂模板的 `dpi` 必須為 600。`noProcess` 使用直式成品左上角為原點的矩形毫米座標，欄位為 `x/y/width/height/label`，橫式自動旋轉。畫布以紅色標示；它是印前檢查提示，不會自動刪除覆蓋其上的客戶圖層。加工前需檢查該區域。

增加模板時請使用新的版本 ID（例如 `a5-plaque-v2`），並保留舊 ID，以便重開舊草稿。確認版本內已封存完整模板。總輸出限制 40MP，以避免不合理模板耗盡記憶體。

### AI 去背

設定程序環境變數 `REMOVEBG_API_KEY` 後重新啟動，才會啟用 remove.bg。實際呼叫其 API，失敗不會建立假去背結果；去背版本另存，原始位元組不變，介面可還原原圖。未設定時按鈕明確停用，API 回傳 503。啟用服務會把使用者選取的圖片送往 remove.bg 並使用其額度。此次未提供金鑰，未測試真實計費服務呼叫。

## ZIP 製作包

| 檔案 | 內容 |
| --- | --- |
| `originals/{assetId}.jpg/png/webp` | 這個設計確認當下所有上傳原圖，包括已從畫布移除的圖片 |
| `cutouts/{assetId}.png` | 去背衍生檔，若有 |
| `final-preview.png` | 工作室製作包內的無浮水印成品預覽；客戶端不提供下載 |
| `production-with-bleed.png` | 含出血的彩色加工圖，UV 圖層另行輸出 |
| `design.json` | 完整可編輯圖層、座標、設定與 WooCommerce 預留欄位 |
| `uv-mask.png` | 若有可見 UV 圖層：黑底白形狀，透明度轉灰階強度 |
| `manifest.json` | 版本 ID、時間、模板、素材原始名稱、SHA-256、來源素材與訂單欄位 |
| `README.txt` | 製作檔說明 |

600 PPI 預設直式成品為 3496 × 4961 px，含出血 3638 × 5102 px（毫米 × PPI / 25.4 四捨五入）。正式彩圖與 UV 遮罩寫入 600 PPI density metadata，兩者同尺寸、同原點，可精確對位；工作室製作包內的 `final-preview.png` 使用 300 PPI。客戶已確認預覽另外壓到最長邊 1000px、96 PPI metadata，並在伺服器端永久合成重複浮水印。字型使用隨附 Noto Sans TC；前後端共用 `shared/draw.ts` 路徑、排版與毫米資料。輸出用原始解析度圖片，客戶端工作圖最多 1000px 長邊，均處理 EXIF 方向。

印表機的 1440 DPI 是設備噴墨點密度，與圖稿的 PPI 不同。系統會在確認製作前檢查每張可見圖片經裁切、縮放後的有效解析度；低於 300 PPI 時，前端停用確認，伺服器也會拒絕建立製作版本。文字、形狀與合格圖片統一光柵化為 600 PPI 製作檔，再由印表機驅動使用最高品質／1440 DPI 模式輸出。這項檢查保證檔案端解析度門檻；實際成品質感仍受紙材、墨水、ICC、RIP 與機台校正影響。

UV 預覽僅表達區域與相對強度，不模擬實際高度；輸出為 RGB PNG，並未實作印刷設備 ICC/CMYK、專色、RIP 或機台校正。

## 儲存與私有存取

`DATA_DIR`（預設 `data/`）包含 `drafts/`、`assets/`、`files/`、`versions/`、`sessions/`。它不在靜態網站根目錄。客戶只能讀取自己的草稿、上傳原圖與含浮水印低解析確認圖；600 PPI 製作包、工作室素材原檔與無浮水印預覽均需要工作室權限。請持久掛載並備份整個資料夾；不要只備份 JSON。

## 工作室製作後台與私有雲端

在伺服器環境設定長隨機值 `STUDIO_ADMIN_TOKEN`，重新啟動後由 `/studio` 登入。密碼只送到伺服器驗證，成功後使用 12 小時的 HttpOnly、SameSite=Strict 工作室 cookie；客戶購物車不再出現製作包下載連結。後台會列出所有已確認版本，只有後台可以查看無浮水印預覽及下載 600 PPI ZIP。

正式環境設定 `SUPABASE_URL`、`SUPABASE_SECRET_KEY` 與私有 `SUPABASE_STORAGE_BUCKET` 後，原圖、預覽、600 PPI 彩圖、UV 遮罩與製作包都由伺服器寫入鎖定的 Supabase Storage bucket；service-role secret 只能留在伺服器環境變數，不可暴露給瀏覽器。這已符合「工作室後台或鎖定雲端硬碟」的保存需求，不需把 Google Drive 設成公開連結。

畫面浮水印、停用下載與低解析預覽可有效阻止一般另存與截圖挪用，但任何能在螢幕顯示的內容都無法做到絕對 DRM。真正的保護邊界是伺服器不向客戶傳送無浮水印預覽、內建素材原檔與正式製作檔。

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
