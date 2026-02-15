-- 新增 products.price 欄位並收斂為不可為空、非負
BEGIN;

-- 1) 新增欄位（可為空，避免影響既有資料）
ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);

-- 2) 回填既有資料（將 NULL 設為 0）
UPDATE products SET price = 0 WHERE price IS NULL;

-- 3) 收緊約束：不可為空、非負值
ALTER TABLE products ALTER COLUMN price SET NOT NULL;
ALTER TABLE products
  ADD CONSTRAINT products_price_non_negative CHECK (price >= 0);

COMMIT;
