-- 補上熱點查詢缺少的索引，改善下列常見查詢：
--   1. sold_qty 子查詢：orders.status IN ('PLACED','COMPLETED') 且指定 schedule_id
--   2. shop 端 listOrdersByPhone：以 user_id + customer_phone 過濾 + 依 created_at 排序
--   3. shop 端 listProducts：以 user_id + is_active 過濾

BEGIN;

-- 1. 支援 shopController.listSchedules / createOrder 中的 sold_qty 子查詢
CREATE INDEX IF NOT EXISTS idx_orders_schedule_id_status
  ON orders(schedule_id, status);

-- 2. 支援 listOrdersByPhone 查詢
CREATE INDEX IF NOT EXISTS idx_orders_user_phone_created_at
  ON orders(user_id, customer_phone, created_at DESC);

-- 3. 支援公開商品列表查詢（僅索引 is_active = true）
CREATE INDEX IF NOT EXISTS idx_products_user_active
  ON products(user_id)
  WHERE is_active = true;

COMMIT;
