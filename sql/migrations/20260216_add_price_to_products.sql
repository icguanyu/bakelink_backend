-- =====================================================
-- 遷移腳本：為產品表添加價格欄位
-- =====================================================
-- 功能說明：
-- 1. 為現有的產品表添加一個新的價格欄位
-- 2. 設置預設值為 0
-- 3. 確保價格不能是空值
-- 4. 添加驗證規則：價格必須大於等於 0
-- =====================================================

BEGIN;

-- 創建 price 欄位（如果還沒有的話）
-- 欄位類型：NUMERIC(10,2) 表示最多 10 位數字，小數點後 2 位
ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);

-- 將現有的空值設為 0
UPDATE products SET price = 0 WHERE price IS NULL;

-- 設置預設值為 0（未來新增產品時自動填充）
ALTER TABLE products ALTER COLUMN price SET DEFAULT 0;

-- 設置欄位為必填項（不能是空值）
ALTER TABLE products ALTER COLUMN price SET NOT NULL;

-- 添加驗證規則：確保價格不能是負數
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_price_non_negative'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_price_non_negative CHECK (price >= 0);
  END IF;
END $$;

COMMIT;
