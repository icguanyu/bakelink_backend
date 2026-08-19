-- 訂單編號改為每排程（每日）重算後，unique constraint 需從
-- (user_id, order_no) 改為 (schedule_id, order_no)
-- 否則不同排程都產生 0001 時會衝突

DROP INDEX IF EXISTS idx_orders_user_id_order_no_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_schedule_id_order_no_unique
  ON orders(schedule_id, order_no)
  WHERE order_no IS NOT NULL;

COMMENT ON COLUMN orders.order_no IS '訂單編號，格式: 0001（每排程獨立流水號，4 碼補零）';
