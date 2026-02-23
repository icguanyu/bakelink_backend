BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_no VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_id_order_no_unique
  ON orders(user_id, order_no)
  WHERE order_no IS NOT NULL;

COMMENT ON COLUMN orders.order_no IS '訂單編號，格式: 933-YYYYMMDD-001';

COMMIT;
