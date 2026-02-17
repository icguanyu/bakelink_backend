-- =====================================================
-- 遷移腳本：為產品表添加額外欄位
-- =====================================================
-- 功能說明：
-- 1. description：產品描述
-- 2. ingredients：簡單的食材列表（文字形式）
-- 3. is_active：產品是否上架（是/否）
-- 4. image_urls：產品圖片網址清單
-- 5. ingredient_details：詳細的食材資訊（複雜資料結構）
-- =====================================================

BEGIN;

-- 添加產品描述欄位
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;

-- 添加食材列表欄位（簡單文字)
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients TEXT;

-- 添加上架狀態欄位（是否對外販售）
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

-- 添加圖片網址陣列欄位（可以儲存多個網址）
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls TEXT[];

-- 添加詳細食材資訊欄位（使用 JSONB 格式儲存複雜資料）
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredient_details JSONB;

-- 將現有的空值設為預設值
-- is_active 設為 TRUE（預設上架）
UPDATE products SET is_active = TRUE WHERE is_active IS NULL;

-- image_urls 設為空陣列
UPDATE products SET image_urls = '{}'::TEXT[] WHERE image_urls IS NULL;

-- ingredient_details 設為空陣列
UPDATE products SET ingredient_details = '[]'::JSONB WHERE ingredient_details IS NULL;

-- 設置 is_active 的預設值為 TRUE
ALTER TABLE products ALTER COLUMN is_active SET DEFAULT TRUE;
ALTER TABLE products ALTER COLUMN is_active SET NOT NULL;

-- 設置 image_urls 的預設值為空陣列
ALTER TABLE products ALTER COLUMN image_urls SET DEFAULT '{}'::TEXT[];
ALTER TABLE products ALTER COLUMN image_urls SET NOT NULL;

-- 設置 ingredient_details 的預設值為空陣列
ALTER TABLE products ALTER COLUMN ingredient_details SET DEFAULT '[]'::JSONB;
ALTER TABLE products ALTER COLUMN ingredient_details SET NOT NULL;

COMMIT;
