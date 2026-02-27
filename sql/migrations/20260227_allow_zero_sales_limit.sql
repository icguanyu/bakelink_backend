-- Allow sales_limit to be 0 (representing no limit)
-- Change constraint from sales_limit > 0 to sales_limit >= 0

BEGIN;

-- Drop the old constraint
ALTER TABLE schedule_items
DROP CONSTRAINT IF EXISTS schedule_items_sales_limit_check;

-- Add the new constraint allowing 0
ALTER TABLE schedule_items
ADD CONSTRAINT schedule_items_sales_limit_check
  CHECK (sales_limit IS NULL OR sales_limit >= 0);

COMMIT;
