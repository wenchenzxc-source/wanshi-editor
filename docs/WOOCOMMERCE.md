# WooCommerce 整合邊界

第一階段不安裝 WordPress 外掛、不建立購物車／訂單，也不操作金流。以下合約可供下一階段 adapter 實作。

## 必須綁定的識別值

```ts
type ConfirmedDesignReference = {
  wooCommerceProductId: number;
  designId: string;       // 可編輯草稿的穩定 ID
  versionId: string;      // POST /confirm 回傳的 id；訂單製作必用此版本
  orderItemId: string | null;
};
```

1. 商品進入編輯器時，由可信 adapter 查驗商品 ID 與可用模板，再建立 Design。使用者提供的商品 ID、價格與模板不應作為 WooCommerce 訂價依據。
2. 瀏覽器 `PUT` 儲存後 `POST /confirm`，取得 versionId；可讀 `GET /versions/:id` 查驗 template 及草稿 ID。
3. 「加入購物車」由將來的 adapter 驗證此 version 屬於登入客戶，簽發短效單次使用的 reference。不得直接相信 URL query、postMessage 或客戶填寫的 orderItemId。
4. WooCommerce 在 `woocommerce_add_cart_item_data` 保存經驗證的 `designId/versionId`，在 `woocommerce_checkout_create_order_line_item` 將其寫入 order item metadata，例如 `_wanshi_design_id` 與 `_wanshi_version_id`。
5. 訂單建立後，在 adapter 的獨立 binding table 寫入 `{orderItemId, productId, versionId}`，不要回寫／修改已確認快照。快照中 `orderItemId` 可在已知時填入；一般首次結帳為 null，綁定表是訂單來源真值。
6. 管理員透過經授權的後端下載封存製作包。不可將匿名 browser cookie 複製到 WooCommerce 後端，也不可直接公開磁碟資料夾。正式 adapter 需新增服務對服務驗證（簽名與過期、重放保護、最小權限）及會員 owner mapping。
7. 客戶回來修改時編輯原草稿，確認成新 version。既有訂單繼續保留原 version；更換製作版本必須有明確訂單變更流程及稽核。

## 部署建議

讓 WordPress 與 editor API 經同源反向代理，或建立有完整驗證的獨立 editor 網域。若以 iframe 整合，需明確處理 cookie、CSP/frame-ancestors、允許來源與登入換票；不要廣泛開啟第三方 cookie 或 wildcard CORS。

正式整合前需將檔案索引與 revision CAS 移入交易式資料庫，素材放私有 object storage，下載使用短效授權；增加租戶配額、rate limit、登入、稽核、備份還原及生產工作佇列。目前 API 是匿名單程序工作室，不是可直接公開的多商戶服務。
