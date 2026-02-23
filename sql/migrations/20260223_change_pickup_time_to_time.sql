-- 將 orders 表的 pickup_time 從 TIMESTAMPTZ 改為 TIME 類型

-- 先將現有的 timestamptz 資料轉換為 time 格式
ALTER TABLE orders 
  ALTER COLUMN pickup_time TYPE TIME USING pickup_time::TIME;

-- 更新註解說明這個欄位只儲存時間 (HH:mm)
COMMENT ON COLUMN orders.pickup_time IS '取貨時間 (格式: HH:mm)';
