BEGIN;

ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredient_details JSONB;

UPDATE products SET is_active = TRUE WHERE is_active IS NULL;
UPDATE products SET image_urls = '{}'::TEXT[] WHERE image_urls IS NULL;
UPDATE products SET ingredient_details = '[]'::JSONB WHERE ingredient_details IS NULL;

ALTER TABLE products ALTER COLUMN is_active SET DEFAULT TRUE;
ALTER TABLE products ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE products ALTER COLUMN image_urls SET DEFAULT '{}'::TEXT[];
ALTER TABLE products ALTER COLUMN image_urls SET NOT NULL;
ALTER TABLE products ALTER COLUMN ingredient_details SET DEFAULT '[]'::JSONB;
ALTER TABLE products ALTER COLUMN ingredient_details SET NOT NULL;

COMMIT;
