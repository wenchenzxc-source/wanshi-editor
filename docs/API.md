# API 合約 v1

所有路由前綴 `/api`。JSON 使用 UTF-8。請先 `POST /session` 取得 HttpOnly cookie，瀏覽器 fetch 同源自動攜帶。除 session 外全部路由需同一工作階段，對其他工作階段的私有 ID 回傳 404。不提供公開可猜測素材網址。

| Method / Path | 輸入 | 輸出 |
| --- | --- | --- |
| POST `/session` | 無 | `{ok:true}` + cookie |
| GET `/config` | 無 | `{templates,backgroundRemoval,maxFileBytes}` |
| GET `/font` | 無 | 共用中文字型 |
| GET `/designs` | 無 | 自有草稿列表 |
| POST `/designs` | `Design` | `{design,revision:1,assets:[],versions:[]}` |
| GET `/designs/:id` | 無 | `{design,revision,assets,versions}` |
| PUT `/designs/:id` | `{design,baseRevision}` | `{revision}` |
| POST `/designs/:id/assets` | multipart `files`（最多12張） | `Asset[]` |
| GET `/assets/:id` | 可選 `?original=1` | 工作圖 PNG；指定 original 時為原始位元組 |
| POST `/assets/:id/remove-background` | 無 | 新 `Asset`，含 `sourceAssetId`，原圖不改動 |
| POST `/designs/:id/confirm` | `{revision}` | `{id,createdAt,revision,orderItemId}`，id 為 versionId |
| GET `/versions/:id` | 無 | 完整封存 `{id,design,template,assets,revision,createdAt,updatedAt}` |
| GET `/versions/:id/preview.png` | 無 | 確認當下保存的成品圖 |
| GET `/versions/:id/package.zip` | 無 | ZIP 製作包 |

`Design` / `DesignLayer` / `Asset` TypeScript 型別與 Zod 驗證定義在 `shared/model.ts`。單位均為 mm，位置原點為裁切成品左上角，旋轉為順時針角度，圖層陣列由底到頂。圖片引用自有 UUID，不能引用外部 URL；服務端不抓取任意客戶 URL。可見圖層超出畫布會裁切。

建立範例：

```json
{
  "schemaVersion": 1,
  "id": "d5d0abc1-8738-44a1-9c02-614174f50d4e",
  "name": "我的 A5 飾牌",
  "templateId": "a5-plaque-v1",
  "orientation": "portrait",
  "background": "#faf6ef",
  "backgroundOpacity": 1,
  "layers": [],
  "wooCommerceProductId": 123,
  "orderItemId": null
}
```

重編輯：將 `/versions/:id` 的 `design` 透過 `PUT /designs/:designId` 儲存至草稿（帶當前 `baseRevision`），再修改、確認成新 version。ZIP `design.json` 可用相同方式載回原設計，引用素材必須仍存在相同設計與工作階段；尚未提供跨帳號 ZIP 匯入／素材 UUID 重映射器。

錯誤為 `{error: string}`：400 驗證／檔案限制，401 無工作階段，403 來源不允許，404 不存在或非自有，409 草稿版本衝突，503 去背服務未設定，502 上游去背失敗，500 內部處理錯誤。收到 409 需重讀最新草稿並由使用者處理，不能偷偷以新的 revision 重試覆蓋。

已確認版本沒有 PUT/DELETE 接口，製作圖檔在確認當下渲染與保存；後續重新下載 ZIP 使用原封存圖檔，不依新字型或新模板重新渲染。
