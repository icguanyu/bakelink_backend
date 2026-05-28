BEGIN;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS shop_slug VARCHAR(50);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'users' AND indexname = 'users_shop_slug_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_shop_slug_key UNIQUE (shop_slug);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_shop_slug ON users(shop_slug);

COMMIT;
