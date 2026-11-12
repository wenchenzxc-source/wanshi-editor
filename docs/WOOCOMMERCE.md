# WooCommerce 整合邊界

目前尚未建立 WooCommerce 商店，也未安裝 WordPress 外掛、接通購物車／訂單或金流。編輯器伺服器已提供付款 Webhook 接口與 Google Drive 同步佇列；完成以下版本綁定後才能啟用。

## 已提供的付款通知接口

- `POST /api/integrations/woocommerce/webhook` 接收 WooCommerce 的 `order.updated` 或 `order.created` Webhook，使用 `X-WC-Webhook-Signature` 對原始內容驗證 HMAC-SHA256。Secret 設為伺服器端 `WOOCOMMERCE_WEBHOOK_SECRET`，並在 WooCommerce Webhook 設定相同值。
- 只接受有 `date_paid`／`date_paid_gmt`、狀態為 `processing` 或 `completed` 的訂單。每個需要製作的訂單項目必須提供 `_wanshi_version_id`，指向編輯器已確認的版本；商品 ID 與版本商品 ID 若有設定，亦須相符。
- 每筆付款訂單只建立一個私有同步工作，製作原圖、設計 JSON、成品 PNG 會存入 `訂單-{orderId}/項目-{orderItemId}-{versionId}`。可在 `/studio` 查看、重試與進入 Drive 資料夾。Cron 是意外中斷時的補跑機制。
- 付款事件的來源真值是 WooCommerce；請勿在瀏覽器直接呼叫 Webhook 或把 Webhook Secret 放在前端。

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
5. 訂單建立後，在 adapter 的獨立 binding table 寫入 `{orderItemId, productId, versionId}`，不要回寫／修改已確認快照。快照中 `orderItemId` 可在已知時填入；一般首次結帳為 null，綁定表是訂單來源真值。Webhook 同步前必須能從 WooCommerce 訂單項目的 `meta_data` 讀到 `_wanshi_version_id`。
6. 管理員透過經授權的後端下載封存製作包。不可將匿名 browser cookie 複製到 WooCommerce 後端，也不可直接公開磁碟資料夾。正式 adapter 需新增服務對服務驗證（簽名與過期、重放保護、最小權限）及會員 owner mapping。
7. 客戶回來修改時編輯原草稿，確認成新 version。既有訂單繼續保留原 version；更換製作版本必須有明確訂單變更流程及稽核。

## 部署建議

讓 WordPress 與 editor API 經同源反向代理，或建立有完整驗證的獨立 editor 網域。若以 iframe 整合，需明確處理 cookie、CSP/frame-ancestors、允許來源與登入換票；不要廣泛開啟第三方 cookie 或 wildcard CORS。

正式整合前仍需完成 WooCommerce 商品、付款、會員 owner mapping、版本綁定與短效簽名 reference；並增加租戶配額、rate limit、稽核及備份還原。目前 API 的編輯者身分是匿名瀏覽器 session，不具備 WooCommerce 會員對應。
