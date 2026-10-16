# 第一階段驗證記錄

日期：2026-10-16。環境：Windows、Node.js 24.19.0、已安裝 Chrome、Playwright。

## 結果

- TypeScript `tsc --noEmit`：通過。
- Vite 正式建置：通過。現有前端 JS 約 681 KB（gzip 約 210 KB），建置有 bundle 大小提示，非錯誤。
- `tests/api.test.ts`：2 個整合測試通過，涵蓋下列 API 與輸出檢查。
- `tests/e2e/editor.spec.ts`：2 個真實瀏覽器測試通過，桌面完整操作與手機觸控模擬共約 34 秒。
- 正式建置本機服務 `http://127.0.0.1:4310/`：HTTP 200。
- 已檢視桌面與 390px 手機截圖；手機畫布預設符合寬度，頁面沒有橫向溢出。

## 覆蓋項目

| 驗收項目 | 實際驗證 |
| --- | --- |
| 多張圖獨立圖層 | API 同時上傳 PNG/JPG/WebP；瀏覽器上傳兩張並檢查圖層數 |
| 直接拖曳、縮放、旋轉 | 真實滑鼠拖動圖層、Konva 角落把手及旋轉把手，檢查座標、尺寸、角度 |
| 預覽立即更新 | 滑鼠尚未放開時讀取預覽 canvas，確認像素內容已改變 |
| 文字、裝飾與 UV | 加入中文字標題、多行內容與獨立 UV 花瓣，完成確認 |
| 圖層操作 | 鎖定、隱藏、撤銷、重做、排序、複製與刪除，確認保存狀態 |
| 自動儲存與重載 | 頁面 reload 後完整 JSON deep equality |
| 手機 | 390 × 844、hasTouch/isMobile、Chrome CDP 真實 touch 事件移動；重載 JSON 相同 |
| 原圖保留 | API 原圖下載與 ZIP 中 PNG/JPG/WebP 逐位元相同 |
| 精確輸出 | A5 直橫式 PNG 尺寸、300 DPI metadata；自訂 150 DPI/7mm 出血與旋轉矩形像素位置 |
| UV 遮罩 | 與含出血圖相同尺寸；黑底、50% UV 中心灰階值約 128 |
| 版本不被破壞 | 草稿移位、換方向、變更訂單欄位後，舊版快照及 ZIP 每一個檔案仍相同 |
| ZIP 端到端 | 瀏覽器確認、取得版本、下載完整 ZIP；API 解壓驗證完整內容 |
| 私有存取 | 無 cookie 為 401；不同工作階段無法讀取設計、素材、版本或製作包 |
| 驗證與衝突 | 偽裝 PNG 被拒絕、跨來源寫入 403、過期草稿與確認 revision 409 |
| AI 未設定 | UI 停用且標示未啟用；API 503，不建立去背素材 |

## 尚未驗證／第一階段限制

- 手機為 Chrome 觸控模擬，尚未在實體 iPhone/Safari 或 Android 裝置驗收。
- 未配置 remove.bg 金鑰，未執行真實去背供應商請求。
- 未與實際 UV 機台、ICC/CMYK、RIP 或工廠生產流程比對；3mm 出血、5mm 安全區與 300 DPI 是可調初始值。
- 未接 WooCommerce 或建立真實訂單。資料與 API 接口已預留，整合合約見 `WOOCOMMERCE.md`。
- 使用匿名 cookie 工作階段與單程序檔案儲存；不是已完成正式會員權限與多實例部署的商城系統。

執行方式見主 README。瀏覽器截圖為 `test-results/desktop.png`、`test-results/mobile.png`，測試資料與正式 `data/` 分開。
