BEGIN;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS is_sliced BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill old order-level flag to each item for existing records.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'is_sliced'
  ) THEN
    UPDATE order_items oi
    SET is_sliced = COALESCE(o.is_sliced, FALSE)
    FROM orders o
    WHERE o.id = oi.order_id
      AND oi.is_sliced = FALSE;
  END IF;
END $$;

COMMIT;
