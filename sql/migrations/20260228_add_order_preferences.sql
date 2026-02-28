BEGIN;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS bring_own_bag BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS pickup_method VARCHAR(20) NOT NULL DEFAULT 'PICKUP';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_pickup_method_check'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_pickup_method_check
    CHECK (pickup_method IN ('PICKUP', 'DELIVERY'));
  END IF;
END $$;

COMMIT;
