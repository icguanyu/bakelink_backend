ALTER TABLE products
  ADD COLUMN IF NOT EXISTS slice_price NUMERIC(10,2) DEFAULT NULL,
  ADD CONSTRAINT products_slice_price_non_negative CHECK (slice_price IS NULL OR slice_price >= 0);
